// Types for the manager-side "preview optimized route" feature — a dry-run of the
// SAME OR-Tools optimization the driver's start-shift runs, anchored at the warehouse
// (no live GPS). Mirrors the backend shiftPreviewResponse (internal/handlers/shift_preview.go).

export type PreviewStopType =
  | 'collection'
  | 'placement'
  | 'pickup'
  | 'dropoff'
  | 'service'
  | 'warehouse_stop';

export interface PreviewStop {
  sequence_order: number;
  type: PreviewStopType;
  latitude: number;
  longitude: number;
  address: string;
  bin_number?: number;
  new_bin_number?: number;
  fill_percentage?: number;
  label?: string;
}

export interface PreviewAnchor {
  latitude: number;
  longitude: number;
  address: string;
  source?: 'warehouse' | 'custom';
}

export interface ShiftRoutePreview {
  shift_id: string;
  optimizer_used: string;
  total_distance_km: number;
  total_distance_miles: number;
  total_duration_seconds: number;
  total_duration_formatted: string;
  estimated_completion: string;
  start_location: PreviewAnchor;
  warehouse: PreviewAnchor;
  stops: PreviewStop[];
  stop_count: number; // raw optimizer nodes (each bin-load counted separately)
  capacity: number; // truck bin capacity used for this run
}

/**
 * Physical stop count for display: a run of consecutive warehouse loads is ONE
 * visit (loading 6 bins at the warehouse is one stop, not 6), and the final
 * return counts once. This is what the driver actually experiences and matches
 * the collapsed rail in the map modal — unlike the raw stop_count.
 */
export function physicalStopCount(stops: PreviewStop[]): number {
  let count = 0;
  const returnIdx =
    stops.length > 0 && stops[stops.length - 1].type === 'warehouse_stop'
      ? stops.length - 1
      : -1;
  let inWarehouseRun = false;
  for (let i = 0; i < stops.length; i++) {
    if (i === returnIdx) {
      count++; // the return to the warehouse is one stop
      continue;
    }
    if (stops[i].type === 'warehouse_stop') {
      if (!inWarehouseRun) count++; // start of a load run = one visit
      inWarehouseRun = true;
    } else {
      count++;
      inWarehouseRun = false;
    }
  }
  return count;
}
