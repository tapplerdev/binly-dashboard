const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return { 'Content-Type': 'application/json' };
    const token = JSON.parse(authStorage)?.state?.token;
    return token
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

export interface PriorityBin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  last_fill_percentage: number;
  days_since_check: number;
  avg_daily_fill_rate: number;
  estimated_current_fill: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  check_count: number;
}

export interface DailyPrioritiesResponse {
  as_of: string;
  summary: { critical: number; high: number; medium: number; low: number };
  priorities: PriorityBin[];
  by_area: Record<string, { critical: number; high: number; medium: number; low: number; bins: string[] }>;
}

export async function getDailyPriorities(): Promise<DailyPrioritiesResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/manager/bins/daily-priorities`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to fetch daily priorities');
  const json = await resp.json();
  return json.data;
}
