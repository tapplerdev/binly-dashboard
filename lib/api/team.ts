const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface Driver {
  driver_id: string;
  driver_name: string;
  email: string;
  shift_id?: string | null;
  route_id?: string | null;
  status: 'active' | 'paused' | 'ready' | 'inactive';
  start_time?: number | null;
  total_bins: number;
  completed_bins: number;
  current_location?: {
    latitude: number;
    longitude: number;
  } | null;
  updated_at?: number | null;
}

export interface DriverShift {
  id: string;
  driver_id: string;
  route_id?: string | null;
  status: string;
  start_time?: number | null;
  end_time?: number | null;
  total_pause_seconds?: number | null;
  total_bins: number;
  completed_bins: number;
  created_at: number;
  updated_at: number;
}

export async function getAllDrivers(token: string): Promise<Driver[]> {
  const response = await fetch(`${API_URL}/api/manager/drivers`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch drivers');
  }

  const data = await response.json();
  return data.data || [];
}

export async function getDriverShiftHistory(driverId: string, token: string): Promise<DriverShift[]> {
  const response = await fetch(`${API_URL}/api/manager/drivers/${driverId}/shifts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch driver shift history');
  }

  const data = await response.json();
  return data.data || [];
}
