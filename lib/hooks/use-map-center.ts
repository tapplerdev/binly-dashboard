/**
 * useMapDefaultCenter — where a map should open.
 *
 * Every map in this app opened on `{ lat: 37.3382, lng: -121.8863 }` — San Jose,
 * California — hardcoded in 24 separate files. Correct for exactly one tenant.
 * A Toronto operator opening the Live Map got a satellite view of Silicon Valley
 * and had to wait for a bounds-fit or pan there themselves.
 *
 * The right answer is the organization's own warehouse: it is where every route
 * begins and ends, it is already stored, and unlike a bins centroid it doesn't
 * drift each time a bin is added.
 *
 * TIMING. `defaultCenter` is read once when the map mounts, and the warehouse
 * arrives from a query a moment later — so a map that only reads this on mount
 * would still open on the fallback. `ready` exists for that: hold the map back
 * until the warehouse resolves, or pan once it does. See recenterOnce.
 */

import { useEffect, useRef } from 'react';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Last-resort center, used only when an organization has no warehouse set —
 * a brand-new tenant mid-provisioning.
 *
 * Deliberately NOT San Jose. It is the geographic centre of North America, which
 * is wrong for everyone equally rather than wrong for everyone except one
 * tenant: at a continental zoom nobody mistakes it for their own territory, so
 * "my warehouse isn't configured" is obvious instead of looking like real data.
 */
export const FALLBACK_CENTER: LatLng = { lat: 45.0, lng: -100.0 };
export const FALLBACK_ZOOM = 3;

export function useMapDefaultCenter(): {
  center: LatLng;
  zoom: number | undefined;
  ready: boolean;
} {
  const { data: warehouse, isLoading } = useWarehouseLocation();

  const hasWarehouse =
    typeof warehouse?.latitude === 'number' &&
    typeof warehouse?.longitude === 'number' &&
    // Provisioning seeds new organizations at 0,0. That is the Gulf of Guinea,
    // not a location — treat it as unset.
    (warehouse.latitude !== 0 || warehouse.longitude !== 0);

  if (hasWarehouse) {
    return {
      center: { lat: warehouse!.latitude, lng: warehouse!.longitude },
      zoom: undefined, // caller keeps its own working zoom
      ready: true,
    };
  }
  return {
    center: FALLBACK_CENTER,
    zoom: FALLBACK_ZOOM,
    // Still loading is NOT ready; genuinely absent IS, or a tenant without a
    // warehouse would wait forever on a map that never appears.
    ready: !isLoading,
  };
}

/**
 * Pans an already-mounted map to the warehouse the first time it resolves, and
 * never again — so a user who has panned somewhere is not yanked back mid-look.
 *
 * For maps whose `defaultCenter` was already consumed at mount.
 */
export function useRecenterOnWarehouse(
  map: google.maps.Map | null | undefined,
  enabled = true
) {
  const { center, ready } = useMapDefaultCenter();
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current || !map || !ready) return;
    if (center === FALLBACK_CENTER) return; // nothing real to move to
    done.current = true;
    map.panTo(center);
  }, [map, ready, center, enabled]);
}
