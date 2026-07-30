'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Centrifuge, Subscription } from 'centrifuge';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

const CENTRIFUGO_URL = 'wss://binly-centrifugo-service-production.up.railway.app/connection/websocket';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

export type CentrifugoStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── Context ───────────────────────────────────────────────────────────────────

interface CentrifugoContextValue {
  status: CentrifugoStatus;
  /** Subscribe to a channel. Multiple callers can subscribe to the same channel
   *  — all handlers receive every publication (fan-out). Returns an unsubscribe fn. */
  subscribe: (channel: string, handler: (data: unknown) => void) => () => void;
  isConnected: boolean;
  /**
   * The org-wide operational feed channel for THIS tenant, or null while the
   * organization is still being resolved.
   *
   * Never hardcode 'company:events' again. That channel is shared across every
   * tenant and is authorized on role alone, so any admin of any organization
   * receives every organization's feed. It is being removed; consumers must
   * read this value and skip their effect while it is null.
   */
  companyChannel: string | null;
}

const CentrifugoContext = createContext<CentrifugoContextValue | null>(null);

export function useCentrifugoContext(): CentrifugoContextValue {
  const ctx = useContext(CentrifugoContext);
  if (!ctx) throw new Error('useCentrifugoContext must be used inside <CentrifugoProvider>');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface CentrifugoProviderProps {
  token?: string;
  children: React.ReactNode;
}

export function CentrifugoProvider({ token, children }: CentrifugoProviderProps) {
  const [status, setStatus] = useState<CentrifugoStatus>('disconnected');

  const organization = useAuthStore((s) => s.organization);
  const setOrganization = useAuthStore((s) => s.setOrganization);
  // null = not yet known. Distinguished from "known to be absent" so we do not
  // subscribe to the wrong channel and immediately switch.
  const [orgResolved, setOrgResolved] = useState(organization !== null);

  // Backfill the organization for sessions that predate it being stored.
  // Without this, everyone already signed in when this shipped would have a null
  // organization forever — the dashboard persists auth to localStorage and never
  // re-validates — so companyChannel would stay null and the dashboard would go
  // SILENT rather than degrade. Runs once per session.
  useEffect(() => {
    if (!token || organization) {
      if (organization) setOrgResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${BACKEND_URL}/api/auth/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setOrganization(data.organization ?? null);
      } catch {
        // Non-fatal: leave orgResolved true so we fall back to the legacy
        // channel rather than going silent.
      } finally {
        if (!cancelled) setOrgResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, organization, setOrganization]);

  // During the migration the backend publishes to BOTH names, so the scoped
  // channel is live and safe to use. A null organization after resolution means
  // a pre-tenancy backend, where the legacy channel is the only one that exists.
  const companyChannel = !orgResolved
    ? null
    : organization
      ? `company:${organization.id}:events`
      : 'company:events';

  // Single Centrifuge client for the entire app session
  const clientRef = useRef<Centrifuge | null>(null);

  // Ref-shadowed status — lets subscribe() check connection state without
  // being a dep, so its reference stays stable across status changes.
  const statusRef = useRef<CentrifugoStatus>('disconnected');
  statusRef.current = status;

  // channel → Set<handler>  (fan-out: many handlers per channel)
  const handlersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  // channel → Centrifuge Subscription
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const fetchCentrifugoToken = useCallback(async (): Promise<string> => {
    if (!token) throw new Error('Auth token required for Centrifugo');
    const response = await apiFetch(`${BACKEND_URL}/api/centrifugo/token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Centrifugo token fetch failed: ${response.status}`);
    const data = await response.json();
    return data.token;
  }, [token]);

  const parsePublication = (raw: unknown): unknown => {
    if (raw instanceof Uint8Array) {
      return JSON.parse(new TextDecoder().decode(raw));
    }
    return raw;
  };

  /** Create a Centrifuge channel subscription and wire up the fan-out publication handler. */
  const createChannelSubscription = useCallback((client: Centrifuge, channel: string) => {
    if (subscriptionsRef.current.has(channel)) return; // already tracked — nothing to do

    // Defensive: the Centrifuge client may still hold a subscription we've lost track of
    // (e.g. an 'unsubscribed' event cleared our ref but didn't remove it from the client).
    // Reuse it instead of calling newSubscription() which would throw "already exists".
    const existing = client.getSubscription(channel);
    if (existing) {
      console.log(`♻️  [Centrifugo] Re-syncing lost subscription for ${channel}`);
      subscriptionsRef.current.set(channel, existing);
      if (existing.state === 'unsubscribed') existing.subscribe();
      return;
    }

    const sub = client.newSubscription(channel);

    sub.on('publication', (ctx) => {
      const data = parsePublication(ctx.data);
      handlersRef.current.get(channel)?.forEach((h) => h(data));
    });

    sub.on('subscribed', () =>
      console.log(`✅ [Centrifugo] Subscribed to ${channel}`)
    );

    sub.on('unsubscribed', (ctx) => {
      console.log(`❌ [Centrifugo] Unsubscribed from ${channel} (code: ${ctx.code})`);
      subscriptionsRef.current.delete(channel);
      // Remove from the Centrifuge client's internal map too, so the channel
      // can be cleanly re-created next time a component subscribes.
      clientRef.current?.removeSubscription(sub);
    });

    sub.on('error', (ctx) =>
      console.error(`❌ [Centrifugo] Subscription error on ${channel}:`, ctx.error)
    );

    sub.subscribe();
    subscriptionsRef.current.set(channel, sub);
  }, []);

  // ── subscribe API (stable ref — safe as a useEffect dependency) ─────────────

  // subscribe is intentionally stable (no status dep) — uses statusRef so its
  // reference never changes across status transitions, preventing spurious
  // useEffect cleanup/re-run cycles in consumers that would otherwise cause
  // "Subscription already exists" errors in the Centrifuge client.
  const subscribe = useCallback(
    (channel: string, handler: (data: unknown) => void): (() => void) => {
      // Register handler in the fan-out map
      if (!handlersRef.current.has(channel)) {
        handlersRef.current.set(channel, new Set());
      }
      handlersRef.current.get(channel)!.add(handler);

      // If already connected, wire up the channel subscription immediately
      if (clientRef.current && statusRef.current === 'connected') {
        createChannelSubscription(clientRef.current, channel);
      }
      // If not yet connected, the 'connected' handler below will create it

      // Return per-handler unsubscribe
      return () => {
        const handlers = handlersRef.current.get(channel);
        if (!handlers) return;
        handlers.delete(handler);

        // Tear down the Centrifuge subscription when the last handler leaves
        if (handlers.size === 0) {
          handlersRef.current.delete(channel);
          const sub = subscriptionsRef.current.get(channel);
          if (sub) {
            sub.unsubscribe();
            clientRef.current?.removeSubscription(sub);
            subscriptionsRef.current.delete(channel);
          }
        }
      };
    },
    [createChannelSubscription]  // stable — statusRef is a ref, not state
  );

  // ── Connection lifecycle ────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    let client: Centrifuge | null = null;

    const connect = async () => {
      try {
        const centrifugoToken = await fetchCentrifugoToken();

        client = new Centrifuge(CENTRIFUGO_URL, {
          token: centrifugoToken,
          minReconnectDelay: 500,
          maxReconnectDelay: 20_000,
          getToken: () => fetchCentrifugoToken(),
        });

        client.on('connecting', () => {
          console.log('🟡 [Centrifugo] Connecting…');
          setStatus('connecting');
        });

        client.on('connected', (ctx) => {
          console.log('🟢 [Centrifugo] Connected (client:', ctx.client, ')');
          setStatus('connected');

          // Re-create subscriptions for any channels that were registered
          // before the connection was ready (e.g. components mounted early)
          handlersRef.current.forEach((handlers, channel) => {
            if (handlers.size > 0) {
              createChannelSubscription(client!, channel);
            }
          });
        });

        client.on('disconnected', (ctx) => {
          console.log(`⚫ [Centrifugo] Disconnected (code: ${ctx.code}, reason: ${ctx.reason})`);
          setStatus('disconnected');
        });

        client.on('error', (ctx) => {
          console.error('❌ [Centrifugo] Client error:', ctx.error);
          setStatus('error');
        });

        client.connect();
        clientRef.current = client;
      } catch (err) {
        console.error('❌ [Centrifugo] Failed to initialize:', err);
        setStatus('error');
      }
    };

    connect();

    return () => {
      console.log('🧹 [Centrifugo] Cleaning up connection…');
      subscriptionsRef.current.forEach((sub) => {
        sub.unsubscribe();
        client?.removeSubscription(sub);
      });
      subscriptionsRef.current.clear();
      client?.disconnect();
      clientRef.current = null;
    };
  }, [token, fetchCentrifugoToken, createChannelSubscription]);

  return (
    <CentrifugoContext.Provider
      value={{ status, subscribe, isConnected: status === 'connected', companyChannel }}
    >
      {children}
    </CentrifugoContext.Provider>
  );
}
