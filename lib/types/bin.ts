/**
 * Bin data types matching the backend API response
 * Based on backend BinResponse struct from /api/bins
 */

export type BinStatus = 'active' | 'missing' | 'retired' | 'in_storage' | 'pending_move' | 'needs_check';

export interface Bin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  zip: string;
  lastMovedIso?: string | null;
  lastCheckedIso?: string | null;
  lastCheckedAtIso?: string | null;
  status: BinStatus;
  fill_percentage?: number | null;
  checked: boolean;
  move_requested: boolean;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null; // Optional formatted location name
  photo_url?: string | null; // Latest check photo URL
  created_by_user_id?: string | null;
  retiredAtIso?: string | null;
  retired_by_user_id?: string | null;
}

/**
 * Bin with priority data from /api/bins/priority endpoint
 */
export interface BinWithPriority extends Bin {
  priority_score: number;
  days_since_check?: number | null;
  next_move_request_date?: number | null;
  move_request_urgency?: 'urgent' | 'scheduled' | null;
  has_pending_move: boolean;
  has_check_recommendation: boolean;
}

/**
 * Bin with guaranteed coordinates for map display
 */
export interface MappableBin extends Bin {
  latitude: number;
  longitude: number;
}

/**
 * Type guard to check if a bin has valid coordinates
 */
export function isMappableBin(bin: Bin): bin is MappableBin {
  return (
    bin.latitude !== null &&
    bin.latitude !== undefined &&
    bin.longitude !== null &&
    bin.longitude !== undefined
  );
}

/**
 * Get fill level category for styling
 */
export function getFillLevelCategory(
  fillPercentage?: number | null
): 'empty' | 'low' | 'medium' | 'high' | 'critical' {
  if (!fillPercentage) return 'empty';
  if (fillPercentage < 25) return 'low';
  if (fillPercentage < 50) return 'medium';
  if (fillPercentage < 80) return 'high';
  return 'critical';
}

/**
 * Get color for bin marker based on fill level
 */
export function getBinMarkerColor(
  fillPercentage?: number | null
): string {
  const category = getFillLevelCategory(fillPercentage);
  switch (category) {
    case 'empty':
      return '#9CA3AF'; // gray-400
    case 'low':
      return '#10B981'; // green-500
    case 'medium':
      return '#F59E0B'; // amber-500
    case 'high':
      return '#F97316'; // orange-500
    case 'critical':
      return '#EF4444'; // red-500
  }
}

/**
 * Potential Location - A driver-requested location for a future bin
 */
export interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number | null;
  longitude?: number | null;
  requested_by_user_id: string;
  requested_by_name: string;
  created_at_iso: string;
  notes?: string | null;
}
