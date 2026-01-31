/**
 * Shift data types for shift scheduling and management
 */

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface OptimizationMetadata {
  total_distance_km: number;
  total_duration_seconds: number;
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
  optimization_metadata?: OptimizationMetadata; // Added for HERE Maps optimization data
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
