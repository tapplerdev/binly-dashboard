import { apiFetch, getAuthHeaders } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

export interface SmartBin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  latitude: number;
  longitude: number;
  fill_percentage: number;
  avg_daily_fill_rate: number;
  predicted_days_to_80: number;
  tier: 'high' | 'medium' | 'low';
  check_count: number;
}

export interface RecommendedRoute {
  suggested_name: string;
  geographic_area: string;
  schedule_pattern: string;
  tier: 'high' | 'medium' | 'low';
  bin_ids: string[];
  bins: SmartBin[];
  stats: {
    bin_count: number;
    avg_fill_rate: number;
    estimated_duration_hours: number;
    estimated_distance_miles: number;
  };
}

export interface SmartRoutesResponse {
  analysis: {
    total_active_bins: number;
    bins_with_check_data: number;
    tiers: { high: number; medium: number; low: number };
  };
  recommended_routes: RecommendedRoute[];
}

export async function generateSmartRoutes(params?: {
  radius_miles?: number;
  max_bins_per_route?: number;
}): Promise<SmartRoutesResponse> {
  const resp = await apiFetch(`${API_BASE_URL}/api/manager/routes/generate-smart`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params || {}),
  });
  if (!resp.ok) throw new Error('Failed to generate smart routes');
  const json = await resp.json();
  return json.data;
}
