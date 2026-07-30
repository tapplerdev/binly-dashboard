/**
 * Shared authenticated fetch for all ropacal-backend calls.
 *
 * The backend requires `Authorization: Bearer <token>` on every endpoint
 * except /health and /api/auth/login. Route every backend request through
 * apiFetch() so the JWT is attached in ONE place instead of per-file
 * copy-pasted helpers.
 *
 * - Token source: the Zustand auth store (live state first, then its
 *   localStorage persistence under `binly-auth-storage`) — the same token
 *   the login flow saves via useAuthStore.setAuth().
 * - 401 handling: an expired/invalid session triggers the app's existing
 *   logout behavior (clearAuth() — which also clears the `binly-auth-token`
 *   cookie the middleware reads — then a redirect to /login), exactly like
 *   the manual sign-out in top-nav-bar.tsx / profile-pill.tsx.
 *
 * apiFetch preserves the caller's init untouched (method, body, headers,
 * cache, signal, ...) and only adds Authorization when the caller didn't
 * already set one, so existing call semantics are unchanged.
 */

import { useAuthStore } from '@/lib/auth/store';

/**
 * Get auth token — live Zustand state first, persisted storage as fallback
 * (covers the window before the store rehydrates on a hard reload).
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const liveToken = useAuthStore.getState().token;
    if (liveToken) return liveToken;

    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;

    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Standard JSON headers + Authorization — same shape the old per-file
 * getAuthHeaders() helpers produced, for call sites that build their own init.
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Only redirect once even if many in-flight requests 401 together.
let isRedirectingToLogin = false;

/** Expired/invalid session → reuse the app's existing logout + login redirect. */
function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  if (isRedirectingToLogin) return;
  if (window.location.pathname === '/login') return;

  isRedirectingToLogin = true;
  try {
    // Clears token/user state AND the binly-auth-token cookie the middleware
    // reads — without this the middleware would bounce /login back to /.
    useAuthStore.getState().clearAuth();
  } catch (error) {
    console.error('Failed to clear auth state:', error);
  }
  window.location.assign('/login');
}

// Origins the JWT may be sent to: our backend (both env spellings in use) plus
// relative URLs (same-origin). Guards against a future copy-paste handing apiFetch
// a third-party URL and silently leaking the token cross-origin.
const BACKEND_ORIGINS = [
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  'https://ropacal-backend-production.up.railway.app', // hardcoded in a few call sites
  'http://localhost:8080',
]
  .filter((u): u is string => Boolean(u))
  .map((u) => new URL(u).origin);

function isBackendUrl(input: string | URL): boolean {
  const s = input.toString();
  if (s.startsWith('/')) return true; // relative → same-origin
  try {
    return BACKEND_ORIGINS.includes(new URL(s).origin);
  } catch {
    return false;
  }
}

/**
 * fetch() with the JWT attached and central 401 handling.
 * Drop-in replacement: same arguments, returns the same Response.
 * The token is only ever attached to backend origins (see BACKEND_ORIGINS).
 */
/**
 * Redirect a tenant API call onto the platform act-as surface when the current
 * session is a cross-tenant operator one.
 *
 * This is the ENTIRE client-side cost of operator mode, and it works because
 * apiFetch is a genuine chokepoint: every file that talks to the backend goes
 * through it. The only raw fetch to our own API is the login call itself, which
 * is pre-auth and must stay raw.
 *
 * A platform token carries no org_id and is REJECTED by every /api route, so
 * without this rewrite an operator's dashboard would 401 everywhere rather than
 * degrade. `/api/platform/*` calls are left alone — they are already platform
 * routes and must not be rewritten into `/api/platform/act/platform/...`.
 */
function platformRewrite(input: string | URL, headers: Headers): string | URL {
  const { isPlatform, actingOrg } = useAuthStore.getState();
  if (!isPlatform || !actingOrg) return input;

  // Only OUR backend. Substring-matching the whole URL rewrote third-party
  // calls too: a Google Maps request became
  // maps.googleapis.com/maps/api/platform/act/geocode/... with the tenant slug
  // attached as a header to Google.
  if (!isBackendUrl(input)) return input;

  const asString = typeof input === 'string' ? input : input.toString();
  const url = new URL(asString, typeof window !== 'undefined' ? window.location.origin : undefined);

  // Match on the PATHNAME, not the whole string — a query parameter containing
  // '/api/' must not trigger or suppress the rewrite, and String.replace only
  // swaps the first occurrence, so a path prefix containing '/api/' would
  // otherwise be the part that got rewritten.
  if (!url.pathname.startsWith('/api/')) return input;
  if (url.pathname.startsWith('/api/platform/')) return input; // already a platform route

  headers.set('X-Act-As-Org', actingOrg.slug);
  url.pathname = url.pathname.replace(/^\/api\//, '/api/platform/act/');
  return url.toString();
}

export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has('Authorization') && isBackendUrl(input)) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(platformRewrite(input, headers), { ...init, headers });

  if (response.status === 401) {
    // An operator who has signed in but not yet chosen an organization is a
    // LEGITIMATE state, not a dead session. In it, platformRewrite leaves URLs
    // alone, so every tenant query 401s with a perfectly valid platform token —
    // and logging them out here made operator mode impossible to use: the
    // dashboard mounts, fires ~11 requests, and the first 401 hard-navigates
    // back to /login before the org switcher can be touched.
    //
    // Suppressed only for that exact window. Once an organization is selected,
    // requests are rewritten onto /api/platform/act and a 401 means what it
    // always meant.
    const { isPlatform, actingOrg } = useAuthStore.getState();
    if (!(isPlatform && !actingOrg)) {
      handleUnauthorized();
    }
  }

  return response;
}
