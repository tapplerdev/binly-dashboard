/**
 * Potential Locations API service
 * Handles all potential location-related API requests to the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  requested_by_user_id: string;
  requested_by_name: string;
  notes?: string;
  created_at_iso: string;
  converted_to_bin_id?: string;
  converted_at_iso?: string;
  converted_by_user_id?: string;
  bin_number?: number;
}

export type PotentialLocationStatus = 'active' | 'converted';

/**
 * Fetch all potential locations
 * @param status - Filter by status: 'active' (not converted) or 'converted'
 * @returns Promise<PotentialLocation[]> Array of potential locations
 */
export async function getPotentialLocations(
  status: PotentialLocationStatus = 'active'
): Promise<PotentialLocation[]> {
  try {
    const response = await fetch(`${API_URL}/api/potential-locations?status=${status}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data for real-time updates
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
 * Fetch a single potential location by ID
 * @param id Potential Location ID
 * @returns Promise<PotentialLocation> Single potential location object
 */
export async function getPotentialLocationById(
  id: string
): Promise<PotentialLocation> {
  try {
    const response = await fetch(`${API_URL}/api/potential-locations/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch potential location: ${response.statusText}`);
    }

    const location: PotentialLocation = await response.json();
    return location;
  } catch (error) {
    console.error('Error fetching potential location:', error);
    throw error;
  }
}
