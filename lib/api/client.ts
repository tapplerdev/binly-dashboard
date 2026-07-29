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

/**
 * fetch() with the JWT attached and central 401 handling.
 * Drop-in replacement: same arguments, returns the same Response.
 */
export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has('Authorization')) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    handleUnauthorized();
  }

  return response;
}
