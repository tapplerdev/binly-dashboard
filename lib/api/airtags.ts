/**
 * AirTag API client
 * Fetches AirTag locations from the backend (proxied from FindMy bridge)
 */

import { apiFetch, getAuthHeaders } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface AirTagLocation {
  id: string;
  name: string;
  bin_number: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  last_seen: string; // ISO timestamp
  battery_status: number; // 0=Full, 1=Medium, 2=Low, 3=Critical
}

export interface AirTagLocationsResponse {
  data: AirTagLocation[];
  count: number;
  unmatched: AirTagLocation[];
  unmatched_count: number;
  last_sync_at: string | null;
}

/**
 * Fetch all AirTag locations from the backend (proxied from FindMy bridge)
 */
export async function getAirTagLocations(): Promise<AirTagLocationsResponse> {
  const response = await apiFetch(`${API_URL}/api/manager/airtag-locations`, {
    method: 'GET',
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AirTag locations: ${response.statusText}`);
  }

  return response.json();
}

export interface SyncResponse {
  status: string;
  fetched: number;
  total: number;
  duration?: string;
}

/**
 * Trigger an immediate AirTag location sync on the FindMy bridge
 */
export async function syncAirTags(): Promise<SyncResponse> {
  const response = await apiFetch(`${API_URL}/api/manager/airtag-sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger AirTag sync: ${response.statusText}`);
  }

  return response.json();
}
