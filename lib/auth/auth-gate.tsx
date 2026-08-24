'use client';

/**
 * Client-side route protection — what `middleware.ts` used to do.
 *
 * WHY IT MOVED: the dashboard is now a STATIC EXPORT (`output: 'export'`) served
 * from S3 behind CloudFront, and Next refuses to build a static export that has
 * middleware at all. There is no server left to run a redirect on.
 *
 * NOTHING GOT LESS SECURE, and it is worth being precise about why. The old
 * middleware read `binly-auth-token`, a cookie written by client-side JS in
 * `lib/auth/store.ts` — not httpOnly, not signed, forgeable from the console in
 * about four seconds. It was never an authorization boundary; it decided which
 * screen you land on. **The real boundary is the API**, which verifies a JWT on
 * every request and re-reads `users.role` from Postgres for admin routes. A
 * forged cookie got you a dashboard shell that 401s on every call, before and
 * after this change alike.
 *
 * What IS lost: the redirect now happens after first paint instead of before,
 * so an unauthenticated visitor may glimpse a frame of layout. The gate renders
 * a neutral screen rather than `children` while it decides, so that frame is
 * empty chrome, never real data.
 *
 * GATED ON `token`, NOT `isAuthenticated`. The cookie the middleware read held
 * the token, so this is the same signal and the behaviour is unchanged. The two
 * flags agree today — `setPlatformAuth` sets both — but a platform operator with
 * a token and no tenant identity is exactly the case where they could drift, and
 * that operator must not be bounced to /login.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth/store';

/**
 * Has zustand finished reading localStorage?
 *
 * LOAD-BEARING. `persist` hydrates ASYNCHRONOUSLY, so on the very first render
 * `token` is null even for a signed-in user. Redirecting on that would throw
 * every returning user to /login on every hard refresh — a bug that looks like
 * broken sessions and is really a race.
 */
function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => hasHydratedNow());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist?.onFinishHydration(() => setHydrated(true));
    // Re-check on mount: hydration can finish between the initial render and
    // this effect, in which case onFinishHydration never fires for us.
    setHydrated(hasHydratedNow());
    return unsubscribe;
  }, []);

  return hydrated;
}

/**
 * `useAuthStore.persist` IS UNDEFINED DURING THE BUILD, and reading through it
 * unguarded fails the export outright:
 *
 *   TypeError: Cannot read properties of undefined (reading 'hasHydrated')
 *   Error occurred prerendering page "/operations/routes"
 *
 * zustand's `persist` only attaches its API when it can reach a storage. Static
 * generation runs in Node, there is no `localStorage`, so it warns and hands
 * back a plain store with no `.persist` at all. Every protected page prerenders,
 * so every protected page hit this.
 *
 * Answering `false` is the right answer rather than a workaround: at build time
 * nothing IS hydrated. The prerendered HTML for a protected route is therefore
 * the neutral screen below — no chrome, no data baked into the static artifact —
 * and the real decision happens in the browser a tick later.
 */
function hasHydratedNow(): boolean {
  return useAuthStore.persist?.hasHydrated?.() ?? false;
}

function Deciding() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

/** Wrap protected trees. Unauthenticated visitors are sent to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useHasHydrated();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);

  if (!hydrated || !token) return <Deciding />;
  return <>{children}</>;
}

/** Wrap /login. An already-authenticated visitor is sent to the dashboard. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const hydrated = useHasHydrated();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && token) router.replace('/');
  }, [hydrated, token, router]);

  if (!hydrated || token) return <Deciding />;
  return <>{children}</>;
}
