import { useEffect, useRef, useState, useCallback } from 'react';
import { Centrifuge, Subscription, State } from 'centrifuge';

const CENTRIFUGO_URL = 'wss://binly-centrifugo-service-production.up.railway.app/connection/websocket';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

export type CentrifugoStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseCentrifugoOptions {
  token?: string;
  enabled?: boolean;
}

export function useCentrifugo({ token, enabled = true }: UseCentrifugoOptions = {}) {
  const [status, setStatus] = useState<CentrifugoStatus>('disconnected');
  const clientRef = useRef<Centrifuge | null>(null);
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());

  // Fetch Centrifugo token from backend
  const fetchCentrifugoToken = useCallback(async (): Promise<string> => {
    console.log('🔑 [Centrifugo] Fetching token from backend...');

    if (!token) {
      throw new Error('Backend authentication token is required');
    }

    const response = await fetch(`${BACKEND_URL}/api/centrifugo/token`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Centrifugo token: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [Centrifugo] Token fetched successfully');
    return data.token;
  }, [token]);

  // Connect to Centrifugo
  useEffect(() => {
    if (!enabled || !token) {
      console.log('⏭️  [Centrifugo] Connection disabled or no token');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔌 [Centrifugo] Initializing connection...');
    console.log('   URL:', CENTRIFUGO_URL);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let client: Centrifuge | null = null;

    const connect = async () => {
      try {
        // Fetch initial token
        const centrifugoToken = await fetchCentrifugoToken();

        // Create Centrifuge client with production configuration
        client = new Centrifuge(CENTRIFUGO_URL, {
          token: centrifugoToken,
          minReconnectDelay: 500,     // Start with 500ms
          maxReconnectDelay: 20000,   // Cap at 20 seconds
          // Token refresh callback
          getToken: async (ctx) => {
            console.log('🔑 [Centrifugo] Token expiring, refreshing...');
            try {
              const newToken = await fetchCentrifugoToken();
              console.log('✅ [Centrifugo] Token refreshed');
              return newToken;
            } catch (error) {
              console.error('❌ [Centrifugo] Token refresh failed:', error);
              throw error;
            }
          },
        });

        // Connection state listeners
        client.on('connecting', (ctx) => {
          console.log('🟡 [Centrifugo] Connecting...');
          setStatus('connecting');
        });

        client.on('connected', (ctx) => {
          console.log('🟢 [Centrifugo] Connected!');
          console.log('   Client ID:', ctx.client);
          setStatus('connected');
        });

        client.on('disconnected', (ctx) => {
          console.log('⚫ [Centrifugo] Disconnected');
          console.log('   Code:', ctx.code);
          console.log('   Reason:', ctx.reason);
          setStatus('disconnected');
        });

        client.on('error', (ctx) => {
          console.error('❌ [Centrifugo] Error:', ctx.error);
          setStatus('error');
        });

        // Connect
        client.connect();
        clientRef.current = client;

        console.log('✅ [Centrifugo] Client initialized');
      } catch (error) {
        console.error('❌ [Centrifugo] Failed to initialize:', error);
        setStatus('error');
      }
    };

    connect();

    // Cleanup
    return () => {
      console.log('🧹 [Centrifugo] Cleaning up...');

      // Unsubscribe from all channels
      subscriptionsRef.current.forEach((sub, channel) => {
        console.log(`   Unsubscribing from ${channel}`);
        sub.unsubscribe();
      });
      subscriptionsRef.current.clear();

      // Disconnect client
      if (client) {
        client.disconnect();
      }
      clientRef.current = null;

      console.log('✅ [Centrifugo] Cleanup complete');
    };
  }, [enabled, token, fetchCentrifugoToken]);

  // Subscribe to a channel
  const subscribe = useCallback((
    channel: string,
    onData: (data: unknown) => void
  ): (() => void) => {
    if (!clientRef.current) {
      console.warn('⚠️  [Centrifugo] Client not connected, cannot subscribe');
      return () => {};
    }

    // Check if already subscribed
    if (subscriptionsRef.current.has(channel)) {
      console.log(`⏭️  [Centrifugo] Already subscribed to ${channel}`);
      return () => {};
    }

    console.log(`🔄 [Centrifugo] Subscribing to ${channel}...`);

    const sub = clientRef.current.newSubscription(channel);

    // Publication event (data received)
    sub.on('publication', (ctx) => {
      console.log(`📍 [Centrifugo] Data received on ${channel}`);
      try {
        // Check if data is Uint8Array (binary) or already an object
        let data: unknown;
        if (ctx.data instanceof Uint8Array) {
          // Binary data - decode it
          const decoder = new TextDecoder();
          const jsonString = decoder.decode(ctx.data);
          data = JSON.parse(jsonString);
        } else {
          // Already an object - use it directly
          data = ctx.data;
        }
        onData(data);
      } catch (error) {
        console.error(`❌ [Centrifugo] Failed to parse data from ${channel}:`, error);
      }
    });

    // Subscription state listeners
    sub.on('subscribed', (ctx) => {
      console.log(`✅ [Centrifugo] Subscribed to ${channel}`);
    });

    sub.on('unsubscribed', (ctx) => {
      console.log(`❌ [Centrifugo] Unsubscribed from ${channel}`);
      console.log('   Code:', ctx.code);
      console.log('   Reason:', ctx.reason);
      subscriptionsRef.current.delete(channel);
    });

    sub.on('error', (ctx) => {
      console.error(`❌ [Centrifugo] Subscription error on ${channel}:`, ctx.error);
    });

    // Subscribe
    sub.subscribe();
    subscriptionsRef.current.set(channel, sub);

    // Return unsubscribe function
    return () => {
      console.log(`🔄 [Centrifugo] Unsubscribing from ${channel}...`);
      sub.unsubscribe();
      subscriptionsRef.current.delete(channel);
    };
  }, []);

  // Get current connection state
  const getState = useCallback((): State | null => {
    return clientRef.current?.state ?? null;
  }, []);

  return {
    status,
    subscribe,
    getState,
    isConnected: status === 'connected',
  };
}
