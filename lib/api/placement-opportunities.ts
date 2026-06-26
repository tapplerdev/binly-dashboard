const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return { 'Content-Type': 'application/json' };
    const token = JSON.parse(authStorage)?.state?.token;
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

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
  const resp = await fetch(`${API_URL}/api/manager/placement/opportunities`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error(`Failed to fetch opportunities: ${resp.statusText}`);
  return resp.json();
}
