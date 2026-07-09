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
  stop_count: number;
}
