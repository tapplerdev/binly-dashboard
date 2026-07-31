/**
 * useGeocoding — the single way this app turns text into places and
 * coordinates into addresses.
 *
 * WHY THIS EXISTS
 *
 * Address geocoding used to be `lib/services/geocoding.service.ts` calling HERE
 * straight from the browser, imported by ten components. That had three
 * problems, and the third is why a shared module was worth building rather than
 * patching each caller:
 *
 *  1. NO country filter. A Toronto tenant could be offered US addresses with
 *     nothing to stop it.
 *  2. The proximity anchor DEFAULTED TO KANSAS CITY, MISSOURI when no location
 *     was passed — and of the components using the shared autocomplete, exactly
 *     one passed one. So nearly every address field ranked suggestions around
 *     Missouri.
 *  3. The fix for (1) and (2) needs the ORGANIZATION'S country and warehouse.
 *     The browser cannot know those authoritatively. Threading them through ten
 *     components as props would mean ten chances to forget — which is exactly
 *     how the Kansas City default survived this long.
 *
 * So the org context is applied on the SERVER, and this is the client side of
 * that: every caller gets the right country automatically because none of them
 * chooses it. Switching a tenant between US and Canadian results is one column
 * — organizations.country — not a prop anyone has to remember.
 *
 * The HERE key stays server-side as a consequence; NEXT_PUBLIC_HERE_API_KEY no
 * longer ships in the bundle.
 *
 * Two call styles, ONE implementation. The plain functions are the real thing;
 * `useGeocoding()` returns stable references to them for components. They exist
 * together because several callers reverse-geocode inside an event handler
 * where a hook does not fit, and the alternative — reaching back for the old
 * direct-to-HERE service — is what this module is replacing.
 */

import { useMemo } from 'react';
import { apiFetch } from '@/lib/api/client';

// Same resolution order the other backend callers use. apiFetch needs an
// absolute URL: it decides whether to attach the JWT by ORIGIN, and rewrites
// tenant routes onto /api/platform/act when an operator is acting as an org.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ropacal-backend-production.up.railway.app';

/** A typeahead suggestion. `id` is opaque — pass it back to `lookupAddress`. */
export interface AddressSuggestion {
  id: string;
  title: string;
  resultType: string;
  address?: { label: string };
}

/**
 * A resolved address.
 *
 * Field-for-field identical to the old HerePlaceDetails, INCLUDING latitude and
 * longitude being required. They were briefly made optional here, which type-
 * checked fine in this file and produced 40 errors across seven components that
 * assign them straight into non-nullable state. Both endpoints always return
 * them — lookup from the place position, reverse from the queried point.
 */
export interface ResolvedAddress {
  street: string;
  city: string;
  zip: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/** Optional map centre, when the user is looking somewhere other than the depot. */
export interface NearPoint {
  lat: number;
  lng: number;
}

/**
 * Address typeahead.
 *
 * Returns [] rather than throwing — an autocomplete that explodes mid-keystroke
 * is worse than one that shows nothing.
 *
 * `near` overrides the organization's warehouse as the ranking anchor, for a
 * map-centred dialog. Absent, the server uses the warehouse. It never falls
 * back to a hardcoded city.
 */
export async function suggestAddresses(
  query: string,
  near?: NearPoint
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  // Matches the server's own minimum, so a keystroke never costs a HERE call.
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({ q });
    if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
      params.set('lat', String(near.lat));
      params.set('lng', String(near.lng));
    }
    const resp = await apiFetch(`${BACKEND_URL}/api/geocode/autosuggest?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

/** Resolve a suggestion id to a full address. null when it cannot be resolved. */
export async function lookupAddress(id: string): Promise<ResolvedAddress | null> {
  if (!id) return null;
  try {
    const resp = await apiFetch(
      `${BACKEND_URL}/api/geocode/lookup?id=${encodeURIComponent(id)}`
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Coordinates to an address, for drop-a-pin flows. null when nothing is there. */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ResolvedAddress | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  try {
    const resp = await apiFetch(
      `${BACKEND_URL}/api/geocode/reverse?lat=${latitude}&lng=${longitude}`
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Component-facing form. The returned object is stable across renders, so it is
 * safe in an effect's dependency list.
 */
export function useGeocoding() {
  return useMemo(
    () => ({
      suggest: suggestAddresses,
      lookup: lookupAddress,
      reverse: reverseGeocode,
    }),
    []
  );
}
