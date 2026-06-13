const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem('binly-auth-storage') || '{}')?.state?.token;
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

export interface RoutePerformanceData {
  route_id: string;
  shifts_completed: number;
  avg_completion_rate: number;
  avg_duration_minutes: number | null;
  total_bins_collected: number;
  total_incidents: number;
  last_run_at: number;
  avg_fill_at_collection: number | null;
}

export async function getRoutePerformance(): Promise<Record<string, RoutePerformanceData>> {
  try {
    const resp = await fetch(`${API_URL}/api/manager/routes/performance`, {
      headers: getAuthHeaders(),
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    return data.routes || {};
  } catch {
    return {};
  }
}

export interface BinCollectionStats {
  avg_fill: number;
  check_count: number;
}

export async function getBinCollectionStats(): Promise<Record<string, BinCollectionStats>> {
  try {
    const resp = await fetch(`${API_URL}/api/manager/bins/collection-stats`, {
      headers: getAuthHeaders(),
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    return data.bins || {};
  } catch {
    return {};
  }
}

export interface DurationEstimate {
  estimated_duration_hours: number;
  estimated_distance_miles: number;
  bin_count: number;
  driving_duration_hours: number;
}

export async function estimateRouteDuration(binIds: string[]): Promise<DurationEstimate | null> {
  try {
    const resp = await fetch(`${API_URL}/api/manager/routes/estimate-duration`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bin_ids: binIds }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}
