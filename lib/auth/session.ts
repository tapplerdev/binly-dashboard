/**
 * Session boundaries — the two moments where one organization's data must not
 * survive into another's view.
 *
 * THE BUG THIS EXISTS TO KILL. Logging out used to be:
 *
 *     clearAuth();
 *     router.push('/login');
 *
 * `router.push` is a CLIENT-SIDE navigation. The React tree never unmounts, so
 * the React Query cache survives the whole logout → login cycle. Sign out of
 * one organization, sign into another in the same tab, and the dashboard mounts
 * with the PREVIOUS tenant's bins already cached — they render instantly, under
 * the new tenant's name, until a background refetch happens to replace them.
 *
 * Observed exactly that: the Home map drew a Toronto org's bins while the
 * Critical-fill panel beside it showed the Bay Area org's addresses. Two queries
 * at different points in the refetch cycle, side by side on one screen.
 *
 * To be clear about severity: RLS held and every request carried the correct
 * token — the stale rows were legitimately fetched under the earlier session.
 * This is a client-side display leak, not a server-side tenancy breach. It still
 * matters: a customer can briefly see another customer's bins on a shared
 * machine or straight after a demo.
 *
 * platform-org-switcher.tsx already solved this for operator org-switching and
 * its comment describes the same symptom. That fix was never applied to plain
 * login and logout. This module is that fix, in one place, so the next auth
 * entry point cannot quietly reintroduce it.
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * Leave the app entirely, discarding every cached row.
 *
 * A FULL page load, not a router navigation — that is the whole point. It
 * guarantees no component anywhere still holds the previous organization's
 * data, because the JavaScript heap goes with the page.
 *
 * `queryClient.clear()` is belt-and-braces: navigation is not instantaneous, and
 * a render in the gap could still paint stale rows. Clearing alone would NOT be
 * sufficient — it notifies cache listeners rather than the observers backing
 * useQuery, so components keep rendering what they already have. That is
 * precisely why the org switcher does both, and so does this.
 */
export function endSession(queryClient: QueryClient | null, clearAuth: () => void) {
  clearAuth();
  queryClient?.clear();
  window.location.assign('/login');
}

/**
 * Enter the app after a successful login.
 *
 * Also a full load. Logging out is not the only way to cross an organization
 * boundary — an expired session, a second account, or simply landing on /login
 * with a warm cache all reach here with another tenant's rows still in memory.
 * Starting from a clean document costs one page load on a once-per-session
 * action and removes the entire class of question.
 */
export function beginSession(queryClient: QueryClient | null, destination = '/') {
  queryClient?.clear();
  window.location.assign(destination);
}
