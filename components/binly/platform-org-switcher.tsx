'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import type { Organization } from '@/lib/auth/types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ropacal-backend-production.up.railway.app';

/**
 * Organization switcher for a cross-tenant Binly operator.
 *
 * Renders NOTHING for a normal tenant session, so it is safe to mount
 * unconditionally in the dashboard chrome.
 *
 * Switching organizations changes one value in the auth store; apiFetch reads it
 * and redirects every subsequent call onto /api/platform/act with the right
 * header. The react-query cache is cleared on switch — without that, the
 * previous tenant's bins and shifts would stay on screen under the new
 * organization's name, which is exactly the confusion that leads to editing the
 * wrong customer's data.
 */
export function PlatformOrgSwitcher() {
  const queryClient = useQueryClient();
  const { isPlatform, platformEmail, platformOrgs, actingOrg, token, setPlatformOrgs, setActingOrg } =
    useAuthStore();
  const [loading, setLoading] = useState(false);

  // Load the operator's reachable organizations once per session.
  useEffect(() => {
    // Deliberately NOT gated on platformOrgs.length: the store is persisted, so
    // gating on it meant the list was fetched once and never refreshed for the
    // life of localStorage — a newly provisioned tenant would never appear.
    if (!isPlatform || !token) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`${BACKEND_URL}/api/platform/whoami`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPlatformOrgs(data.organizations ?? []);
      } catch {
        // Non-fatal: the switcher simply stays empty and the operator sees the
        // "select an organization" state rather than a broken page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatform, token, setPlatformOrgs]);

  if (!isPlatform) return null;

  const onSwitch = (slug: string) => {
    const next = platformOrgs.find((o) => o.slug === slug) ?? null;
    setActingOrg(next);

    // Clearing the cache is NOT enough on its own. queryClient.clear() removes
    // the entries and cancels retries, but it notifies cache listeners rather
    // than the observers that back useQuery — so the previous tenant's bins and
    // shifts stay RENDERED under the new tenant's name until some refetch
    // interval happens to fire. That is worse than doing nothing, because the
    // banner lends confidence to stale data from another customer.
    //
    // A full reload is deliberate and cheap here: it guarantees no component
    // anywhere is still holding another organization's rows, which matters more
    // than the switching animation. Every in-flight request dies with the page.
    queryClient.clear();
    window.location.assign('/');
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Binly Operator
      </span>
      <select
        aria-label="Act as organization"
        value={actingOrg?.slug ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 disabled:opacity-50"
      >
        <option value="">
          {loading ? 'Loading organizations…' : 'Select an organization…'}
        </option>
        {platformOrgs.map((o: Organization) => (
          <option
            key={o.id}
            value={o.slug}
            // ActAsOrg 403s every request for a non-active organization, and a
            // 403 does not trigger the logout path — so selecting one just
            // renders an empty dashboard under a banner promising full access.
            disabled={o.status !== undefined && o.status !== 'active'}
          >
            {o.name}
            {o.status && o.status !== 'active' ? ` (${o.status} — unavailable)` : ''}
          </option>
        ))}
      </select>
      {platformEmail && (
        <span className="hidden text-xs text-gray-500 md:inline">{platformEmail}</span>
      )}
    </div>
  );
}

/**
 * Persistent banner shown while an operator is acting as a tenant.
 *
 * Deliberately loud and always visible. With write access enabled, the realistic
 * accident is not a breach — it is editing the wrong customer's bins because you
 * forgot which organization you were in. It also states that changes are
 * attributed to "Binly Support", so the consequence of a write is not a surprise.
 */
export function PlatformActingBanner() {
  const { isPlatform, actingOrg } = useAuthStore();
  if (!isPlatform) return null;

  if (!actingOrg) {
    return (
      <div className="w-full bg-gray-800 px-4 py-2 text-center text-sm text-white">
        Select an organization to begin — no tenant is currently loaded.
      </div>
    );
  }

  return (
    <div className="w-full bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      ⚠ Acting as <span className="uppercase">{actingOrg.name}</span> — you have full
      read and write access. Changes are recorded as “Binly Support”.
    </div>
  );
}
