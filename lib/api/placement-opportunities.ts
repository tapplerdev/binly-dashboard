import { apiFetch, getAuthHeaders } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

export interface CityOpportunity {
  city: string;
  bin_count: number;
  avg_fill_rate: number;
  population: number;
  median_income: number;
  opportunity_score: number;
  opportunity_label: 'high' | 'moderate' | 'low';
  reasoning: string;
  recommended_bins: number;
  top_corridors: string[];
  center_lat: number;
  center_lng: number;
}

export interface OpportunitiesResponse {
  cities: CityOpportunity[];
  total_recommended: number;
  allocation_reasoning: string;
}

export async function getPlacementOpportunities(): Promise<OpportunitiesResponse> {
  const resp = await apiFetch(`${API_URL}/api/manager/placement/opportunities`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error(`Failed to fetch opportunities: ${resp.statusText}`);
  return resp.json();
}
