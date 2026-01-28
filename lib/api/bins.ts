/**
 * Bins API service
 * Handles all bin-related API requests to the backend
 */

import { Bin, BinWithPriority, PotentialLocation, BinCheck } from '@/lib/types/bin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export type BinSortOption = 'priority' | 'bin_number' | 'fill_percentage' | 'days_since_check' | 'status';
export type BinFilterOption = 'all' | 'next_move_request' | 'longest_unchecked' | 'high_fill' | 'has_check_recommendation';
export type BinStatusFilter = 'active' | 'all' | 'retired' | 'pending_move' | 'in_storage';

/**
 * Move record from the backend
 */
export interface BinMove {
  id: number;
  binId: string;
  movedFrom: string;
  movedTo: string;
  movedOnIso: string;
  movedOn: string;
}

/**
 * Fetch all bins from the backend
 * @returns Promise<Bin[]> Array of all bins
 */
export async function getBins(): Promise<Bin[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data for real-time updates
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bins: ${response.statusText}`);
    }

    const bins: Bin[] = await response.json();
    return bins;
  } catch (error) {
    console.error('Error fetching bins:', error);
    throw error;
  }
}

/**
 * Fetch a single bin by ID
 * @param id Bin ID
 * @returns Promise<Bin> Single bin object
 */
export async function getBinById(id: string): Promise<Bin> {
  try {
    const bins = await getBins();
    const bin = bins.find((b) => b.id === id);

    if (!bin) {
      throw new Error(`Bin with id ${id} not found`);
    }

    return bin;
  } catch (error) {
    console.error(`Error fetching bin ${id}:`, error);
    throw error;
  }
}

/**
 * Fetch check history for a specific bin
 * @param binId Bin ID
 * @returns Promise<BinCheck[]> Array of check records (most recent first)
 */
export async function getBinChecks(binId: string): Promise<BinCheck[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins/${binId}/checks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bin checks: ${response.statusText}`);
    }

    const checks: BinCheck[] = await response.json();
    return checks;
  } catch (error) {
    console.error(`Error fetching checks for bin ${binId}:`, error);
    throw error;
  }
}

/**
 * Fetch move history for a specific bin
 * @param binId Bin ID
 * @returns Promise<BinMove[]> Array of move records (most recent first)
 */
export async function getBinMoves(binId: string): Promise<BinMove[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins/${binId}/moves`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bin moves: ${response.statusText}`);
    }

    const moves: BinMove[] = await response.json();
    return moves;
  } catch (error) {
    console.error(`Error fetching moves for bin ${binId}:`, error);
    throw error;
  }
}

/**
 * Fetch bins with priority scoring, filtering, and sorting
 * @param options Query options for filtering and sorting
 * @returns Promise<BinWithPriority[]> Array of bins with priority data
 */
export async function getBinsWithPriority(options?: {
  sort?: BinSortOption;
  filter?: BinFilterOption;
  status?: BinStatusFilter;
  limit?: number;
}): Promise<BinWithPriority[]> {
  try {
    const params = new URLSearchParams();
    if (options?.sort) params.append('sort', options.sort);
    if (options?.filter) params.append('filter', options.filter);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `${API_URL}/api/bins/priority${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bins with priority: ${response.statusText}`);
    }

    const bins: BinWithPriority[] = await response.json();
    return bins;
  } catch (error) {
    console.error('Error fetching bins with priority:', error);
    throw error;
  }
}

/**
 * Create a new bin
 * @param bin Bin data (bin_number is optional - auto-assigned if not provided)
 * @returns Promise<Bin> Created bin object
 */
export async function createBin(bin: {
  bin_number?: number;
  current_street: string;
  city: string;
  zip: string;
  status: string;
  fill_percentage?: number;
  latitude?: number;
  longitude?: number;
}): Promise<Bin> {
  try {
    const response = await fetch(`${API_URL}/api/bins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bin),
    });

    if (!response.ok) {
      throw new Error(`Failed to create bin: ${response.statusText}`);
    }

    const created: Bin = await response.json();
    return created;
  } catch (error) {
    console.error('Error creating bin:', error);
    throw error;
  }
}

/**
 * Fetch all potential locations
 * @returns Promise<PotentialLocation[]> Array of potential locations
 */
export async function getPotentialLocations(): Promise<PotentialLocation[]> {
  try {
    const response = await fetch(`${API_URL}/api/potential-locations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch potential locations: ${response.statusText}`);
    }

    const locations: PotentialLocation[] = await response.json();
    return locations;
  } catch (error) {
    console.error('Error fetching potential locations:', error);
    throw error;
  }
}

/**
 * Delete a potential location
 * @param id Potential location ID
 * @returns Promise<void>
 */
export async function deletePotentialLocation(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/potential-locations/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete potential location: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error deleting potential location ${id}:`, error);
    throw error;
  }
}

/**
 * Convert a potential location to a bin
 * @param id Potential location ID
 * @param additionalData Additional bin data (optional fill percentage)
 * @returns Promise<Bin> Created bin object
 */
export async function convertPotentialLocationToBin(
  id: string,
  additionalData?: {
    fill_percentage?: number;
  }
): Promise<Bin> {
  try {
    const response = await fetch(`${API_URL}/api/potential-locations/${id}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(additionalData || {}),
    });

    if (!response.ok) {
      throw new Error(`Failed to convert potential location: ${response.statusText}`);
    }

    const bin: Bin = await response.json();
    return bin;
  } catch (error) {
    console.error(`Error converting potential location ${id}:`, error);
    throw error;
  }
}
