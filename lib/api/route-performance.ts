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

export interface ReoptBin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  latitude: number;
  longitude: number;
  fill_percentage: number;
}

export interface ReoptRoute {
  route_id: string;
  name: string;
  suggested_name: string;
  bin_ids: string[];
  bins: ReoptBin[];
  bin_count: number;
  estimated_duration_hours: number;
  estimated_distance_miles: number;
  avg_fill: number;
  geographic_area: string;
  schedule_pattern: string;
}

export interface LowPerformerBin extends ReoptBin {
  avg_fill: number;
  check_count: number;
}

export interface SmartReoptimizeResponse {
  routes: ReoptRoute[];
  low_performers: LowPerformerBin[];
  delete_route_ids: string[];
  total_bins: number;
  solver: { runtime_ms: number; feasible: boolean; unassigned: number; num_vehicles: number; balanced_capacity: number };
}

export async function smartReoptimize(routeIds: string[], maxBinsPerRoute: number, lowPerformerThreshold: number): Promise<SmartReoptimizeResponse | null> {
  try {
    const resp = await fetch(`${API_URL}/api/manager/routes/smart-reoptimize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ route_ids: routeIds, max_bins_per_route: maxBinsPerRoute, low_performer_threshold: lowPerformerThreshold }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err);
    }
    return resp.json();
  } catch (err) {
    console.error('Smart reoptimize failed:', err);
    return null;
  }
}
