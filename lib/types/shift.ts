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
  start_time?: number | null; // When the driver started (Unix seconds); null until then
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
 * `statusMap` maps into; the backend column has SEVEN values — `inactive`,
 * `ready`, `optimizing`, `active`, `paused`, `ended`, `cancelled` (see
 * `0004_shift_optimizing_status.py`) — and three of them have no frontend
 * equivalent. An earlier version of this comment said six.
 *
 * **THIS IS THE ONLY PLACE THAT NAMES THEM.** It was introduced as "one label
 * helper" while four hand-rolled label tables kept running beside it, so
 * `optimizing` briefly shipped as `Starting`, `Starting…`, `STARTING` and
 * `Starting Shift` at once — one MORE vocabulary rather than one. Sites that
 * uppercase do it themselves; nobody re-words.
 *
 * Unknown-but-present falls back to the raw value: an 8th server status is
 * better shown than hidden. **Nullish returns an em dash, not `''`** — every
 * call site renders this inside a styled pill, and an empty string is a
 * coloured badge with no text in it, which is the exact symptom this whole line
 * of work started from.
 */
export function getBackendStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  switch (status) {
    case 'optimizing': return 'Starting';
    case 'active':     return 'Active';
    case 'ready':      return 'Ready';
    case 'paused':     return 'Paused';
    case 'ended':      return 'Completed';
    case 'cancelled':  return 'Cancelled';
    case 'inactive':   return 'Offline';
    default:           return status;
  }
}

/**
 * Can a manager still edit this shift's tasks?
 *
 * MIRRORS `shift.EDITABLE = frozenset({ACTIVE, READY})` on the server, and it
 * exists because guessing by exclusion keeps going wrong in the same direction:
 * excluding `ended` and `cancelled` admits `optimizing`; excluding `optimizing`
 * too then admits `paused`. Each miss surfaces the same way — a manager fills in
 * a form and collects a 400. An inclusive test cannot drift like that.
 *
 * `optimizing` is excluded deliberately rather than incidentally: a solve is in
 * flight against that exact task set, so adding to it would make the order that
 * lands describe a shift that no longer exists.
 */
export function isShiftEditable(status: string | null | undefined): boolean {
  return status === 'active' || status === 'ready';
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
