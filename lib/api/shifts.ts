/**
 * Shifts API Client
 * Connects dashboard to ropacal-backend shift management endpoints
 */

import { Shift, ShiftStatus } from '@/lib/types/shift';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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

// Backend shift response types (matching Go models)
interface BackendShift {
  id: string;
  driver_id: string;
  route_id: string | null;
  status: 'ready' | 'active' | 'paused' | 'ended' | 'cancelled';
  start_time: number | null; // Unix timestamp
  end_time: number | null;
  total_pause_seconds: number;
  pause_start_time: number | null;
  total_bins: number;
  completed_bins: number;
  created_at: number;
  updated_at: number;
}

interface BackendBinInShift {
  id: number;
  shift_id: string;
  bin_id: string;
  sequence_order: number;
  is_completed: number;
  completed_at: number | null;
  updated_fill_percentage: number | null;
  created_at: number;
  bin_number: string;
  current_street: string;
  city: string;
  zip: string;
  fill_percentage: number;
  latitude: number | null;
  longitude: number | null;
}

interface BackendShiftDetails extends BackendShift {
  bins: BackendBinInShift[];
  driver_name?: string;
  driver_email?: string;
}

interface BackendDriver {
  driver_id: string;
  driver_name: string;
  email: string;
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

/**
 * Fetches all shifts with driver details from backend
 */
export async function getShifts(): Promise<Shift[]> {
  try {
    console.log('🔍 Fetching shifts from backend...');

    // Get all drivers with shift info
    const driversResponse = await fetch(`${API_BASE_URL}/api/manager/drivers`, {
      headers: getAuthHeaders(),
    });

    console.log(`📡 Response status: ${driversResponse.status}`);

    // Handle authentication errors gracefully
    if (driversResponse.status === 401) {
      console.warn('⚠️  Backend requires authentication. No shifts will load.');
      return [];
    }

    if (!driversResponse.ok) {
      console.warn('⚠️  Backend unavailable:', driversResponse.statusText);
      return [];
    }

    const driversData = await driversResponse.json();
    console.log('📦 Drivers data received:', driversData);

    const drivers: BackendDriver[] = driversData.data || [];
    console.log(`👥 Found ${drivers.length} drivers total`);

    // Filter drivers with shifts and convert to frontend Shift format
    const driversWithShifts = drivers.filter(driver => driver.shift_id);
    console.log(`✅ ${driversWithShifts.length} drivers have active shifts`);

    const shifts: Shift[] = driversWithShifts.map(driver => {
      const shift = convertBackendShiftToFrontend(driver);
      console.log(`   - ${driver.driver_name}: ${driver.status} (${driver.total_bins} bins)`);
      return shift;
    });

    console.log(`📊 Returning ${shifts.length} shifts`);
    return shifts;
  } catch (error) {
    console.error('❌ Error fetching shifts:', error);
    return [];
  }
}

/**
 * Fetches detailed shift information including bin list
 * @param driverId - The driver ID to fetch shift details for
 */
export async function getShiftDetailsByDriverId(driverId: string): Promise<BackendShiftDetails> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/manager/driver-shift-details?driver_id=${driverId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shift details: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching shift details:', error);
    throw error;
  }
}

// Alias for backwards compatibility - now expects driver ID
export async function getShiftDetails(driverId: string): Promise<BackendShiftDetails> {
  return getShiftDetailsByDriverId(driverId);
}

/**
 * Assigns a route to a driver, creating a new shift
 */
export async function assignRoute(data: {
  driver_id: string;
  route_id: string;
  bin_ids: string[];
}): Promise<BackendShift> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/manager/assign-route`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    // Handle authentication errors with clear message
    if (response.status === 401) {
      throw new Error('Authentication required. Please implement login to create shifts.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to assign route: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error assigning route:', error);
    throw error;
  }
}

/**
 * Clears all shifts (for testing - admin only)
 */
export async function clearAllShifts(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/manager/shifts/clear`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to clear shifts: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error clearing shifts:', error);
    throw error;
  }
}

/**
 * Helper: Converts backend driver with shift to frontend Shift format
 */
function convertBackendShiftToFrontend(driver: BackendDriver): Shift {
  // Map backend status to frontend status
  const statusMap: Record<string, ShiftStatus> = {
    'ready': 'scheduled',
    'active': 'active',
    'paused': 'active', // Show paused as active in list view
    'ended': 'completed',
    'cancelled': 'cancelled',
    'inactive': 'scheduled', // Shouldn't happen but fallback
  };

  const status = statusMap[driver.status] || 'scheduled';

  // Convert Unix timestamp to local date string (YYYY-MM-DD)
  // Use local timezone instead of UTC to avoid date shifts
  const getLocalDateString = (timestamp: number): string => {
    const d = new Date(timestamp * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const date = driver.start_time
    ? getLocalDateString(driver.start_time)
    : getLocalDateString(driver.updated_at!);

  console.log(`   📅 Shift date for ${driver.driver_name}: ${date} (from timestamp: ${driver.start_time})`);

  // Helper: Convert timestamp to 12-hour AM/PM format
  const formatTime12Hour = (timestamp: number): string => {
    const d = new Date(timestamp * 1000);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  // Extract time from timestamp in 12-hour format
  const startTime = driver.start_time
    ? formatTime12Hour(driver.start_time)
    : '8:00 AM';

  // Calculate end time (8-hour shift) and estimated completion
  let endTime: string;
  let estimatedCompletion: string | undefined;

  if (driver.start_time) {
    const endTimestamp = driver.start_time + 8 * 3600; // 8 hours later
    endTime = formatTime12Hour(endTimestamp);

    if (driver.status === 'active') {
      const estimatedEnd = new Date(endTimestamp * 1000);
      estimatedCompletion = estimatedEnd.toISOString();
    }
  } else {
    endTime = '4:00 PM'; // Default end time
  }

  return {
    id: driver.shift_id!,
    date,
    startTime,
    endTime,
    driverId: driver.driver_id,
    driverName: driver.driver_name,
    driverPhoto: undefined,
    route: driver.route_id ? `Route ${driver.route_id.slice(0, 8)}` : 'Custom Route',
    binCount: driver.total_bins,
    binsCollected: driver.completed_bins > 0 ? driver.completed_bins : undefined,
    status,
    estimatedCompletion,
  };
}

/**
 * Helper: Format Unix timestamp to readable date/time
 */
export function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}
