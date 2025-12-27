/**
 * Bin data types matching the backend API response
 * Based on backend BinResponse struct from /api/bins
 */

export type BinStatus = 'active' | 'missing';

export interface Bin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  zip: string;
  lastMovedIso?: string | null;
  lastCheckedIso?: string | null;
  status: BinStatus;
  fill_percentage?: number | null;
  checked: boolean;
  move_requested: boolean;
  latitude?: number | null;
  longitude?: number | null;
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
