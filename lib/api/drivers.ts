/**
 * Drivers API Client
 * Connects dashboard to ropacal-backend driver management endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

/**
 * Get auth token from localStorage (Zustand persist storage)
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;

    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Get headers with authentication
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Backend driver response type
interface BackendDriver {
  driver_id: string;
  driver_name: string;
  email: string;
  phone?: string;
  shift_id: string | null;
  route_id: string | null;
  status: 'inactive' | 'ready' | 'active' | 'paused' | 'ended' | 'cancelled';
  start_time: number | null;
  total_bins: number;
  completed_bins: number;
  updated_at: number | null;
  current_location: {
    latitude: number;
    longitude: number;
  } | null;
}

// Frontend driver type
export interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'available' | 'on-shift' | 'unavailable';
  currentShiftId?: string;
  currentRouteId?: string;
}

/**
 * Fetches all drivers from backend
 */
export async function getDrivers(): Promise<Driver[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/manager/drivers`, {
      headers: getAuthHeaders(),
    });

    // Handle authentication errors gracefully
    if (response.status === 401) {
      console.warn('⚠️  Backend requires authentication. Drivers will not load until auth is implemented.');
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch drivers: ${response.statusText}`);
    }

    const data = await response.json();
    const drivers: BackendDriver[] = data.data || [];

    // Transform to frontend format
    return drivers.map(convertBackendDriverToFrontend);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
}

/**
 * Helper: Converts backend driver to frontend Driver format
 */
function convertBackendDriverToFrontend(driver: BackendDriver): Driver {
  // Determine availability status
  let status: Driver['status'] = 'available';

  if (driver.shift_id) {
    // Has an active shift
    status = 'on-shift';
  } else if (driver.status === 'inactive') {
    // Driver is offline/not working today
    status = 'unavailable';
  }

  return {
    id: driver.driver_id,
    name: driver.driver_name,
    email: driver.email,
    phone: driver.phone,
    status,
    currentShiftId: driver.shift_id || undefined,
    currentRouteId: driver.route_id || undefined,
  };
}
