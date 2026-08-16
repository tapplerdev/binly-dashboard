/**
 * Shift data types for shift scheduling and management
 */

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface OptimizationMetadata {
  total_distance_miles: number;
  total_distance_km?: number; // Legacy field
  total_duration_seconds: number;
  total_duration_formatted: string; // e.g., "2h 30m"
  optimized_at: string; // ISO timestamp
  estimated_completion: string; // ISO timestamp
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  route: string; // e.g., "Route 2 - Central"
  binCount: number;
  binsCollected?: number; // For active/completed shifts
  totalWeight?: number; // kg, for completed shifts
  status: ShiftStatus;
  estimatedCompletion?: string; // ISO timestamp for active shifts
  duration?: string; // e.g., "7h 45m" for completed shifts
  truckId?: string;
  truck_bin_capacity?: number; // Truck capacity for bin collection
  optimization_metadata?: OptimizationMetadata; // Added for HERE Maps optimization data
  total_distance_miles?: number; // Computed field from backend (km * 0.621371)
  estimated_completion_time?: number; // Computed field from backend (Unix timestamp)
}

export interface ShiftBin {
  binId: string;
  binNumber: number;
  address: string;
  latitude: number;
  longitude: number;
  collectionOrder?: number;
  collected: boolean;
  collectedAt?: string; // ISO timestamp
}

export interface ShiftDetails extends Shift {
  bins: ShiftBin[];
  notes?: string;
  activityLog: ShiftActivity[];
}

export interface ShiftActivity {
  id: string;
  timestamp: string; // ISO timestamp
  type: 'bin_collected' | 'shift_started' | 'shift_completed' | 'note_added';
  description: string;
  binNumber?: number;
  weight?: number;
}

/**
 * A **backend** `shifts.status` value, rendered for a human.
 *
 * THIS IS THE OTHER VOCABULARY, and mixing the two is what keeps producing the
 * same bug. `ShiftStatus` above is the four-value FRONTEND union that
 * `statusMap` maps into; the backend column has six values including `paused`
 * and `optimizing`, which have no frontend equivalent.
 *
 * Several screens render the raw backend value — a 409 conflict dialog, a shift
 * history row, two fallback table cells, a dropdown — and each had hand-rolled
 * its own label or none at all, so a status added on the server shows up in the
 * UI as our internal word. `optimizing` is the one that made that visible:
 * managers were shown "optimizing" in the exact dialog built to explain that a
 * driver has just started.
 *
 * Anything unrecognised falls back to the raw value rather than a placeholder —
 * an unknown status is better shown than hidden.
 */
export function getBackendStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'optimizing': return 'Starting';
    case 'active':     return 'Active';
    case 'ready':      return 'Ready';
    case 'paused':     return 'Paused';
    case 'ended':      return 'Completed';
    case 'cancelled':  return 'Cancelled';
    case 'inactive':   return 'Offline';
    default:           return status ?? '';
  }
}

/**
 * Get color class for shift status badge
 */
export function getShiftStatusColor(status: ShiftStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'completed':
      return 'bg-gray-100 text-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
  }
}

/**
 * Get display label for shift status
 */
export function getShiftStatusLabel(status: ShiftStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}
