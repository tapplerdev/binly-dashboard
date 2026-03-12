/**
 * AirTag API client
 * Fetches AirTag locations from the binly-findmy-bridge service
 */

const BRIDGE_URL = process.env.NEXT_PUBLIC_FINDMY_BRIDGE_URL || 'http://localhost:8080';

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
  last_sync_at: string | null;
}

/**
 * Fetch all AirTag locations from the FindMy bridge service
 */
export async function getAirTagLocations(): Promise<AirTagLocationsResponse> {
  const response = await fetch(`${BRIDGE_URL}/api/airtag-locations`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AirTag locations: ${response.statusText}`);
  }

  return response.json();
}
