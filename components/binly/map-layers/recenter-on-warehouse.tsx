'use client';

import { useMap } from '@vis.gl/react-google-maps';
import { useRecenterOnWarehouse } from '@/lib/hooks/use-map-center';

/**
 * Centers the map on the organization's warehouse once, the first time it
 * resolves. Drop it inside <Map> alongside the other layers.
 *
 * Needed because `defaultCenter` is consumed at mount, while the warehouse
 * arrives from a query a moment later. Setting defaultCenter from the hook
 * covers the warm-cache case; this covers the cold one.
 *
 * Fires ONCE. A user who has panned away is not dragged back mid-look.
 */
export function RecenterOnWarehouse({ enabled = true }: { enabled?: boolean }) {
  useRecenterOnWarehouse(useMap(), enabled);
  return null;
}
