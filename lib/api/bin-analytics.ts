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

export interface BinPerformance {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  latitude: number;
  longitude: number;
  fill_percentage: number;
  last_checked_at: number | null;
  avg_daily_fill_rate: number;
  estimated_current_fill: number;
  days_since_check: number;
  urgency: string;
  check_count: number;
}

export interface AreaStats {
  city: string;
  bin_count: number;
  avg_fill_rate: number;
  avg_fill_percentage: number;
  critical_count: number;
  high_count: number;
}

export interface AnalyticsData {
  bins: BinPerformance[];
  areas: AreaStats[];
  summary: {
    total_bins: number;
    avg_fill_rate: number;
    avg_days_between_collections: number;
    critical_count: number;
    high_count: number;
  };
  fill_history: Array<{
    week: string;
    avg_fill: number;
    check_count: number;
  }>;
}

export async function fetchBinAnalytics(): Promise<AnalyticsData> {
  // Fetch daily priorities (has per-bin fill rates and predictions)
  const prioritiesResp = await fetch(`${API_BASE_URL}/api/manager/bins/daily-priorities`, {
    headers: getAuthHeaders(),
  });
  if (!prioritiesResp.ok) throw new Error('Failed to fetch priorities');
  const prioritiesJson = await prioritiesResp.json();
  const priorities = prioritiesJson.data;

  // Fetch area performance
  const areasResp = await fetch(`${API_BASE_URL}/api/analytics/areas?group_by=city&metric=fill_rate&limit=20`, {
    headers: getAuthHeaders(),
  });
  let areas: AreaStats[] = [];
  if (areasResp.ok) {
    const areasJson = await areasResp.json();
    areas = (areasJson.data || []).map((a: any) => ({
      city: a.area || a.city || 'Unknown',
      bin_count: a.total_bins || a.bin_count || 0,
      avg_fill_rate: a.avg_fill_percentage || 0,
      avg_fill_percentage: a.avg_fill_percentage || 0,
      critical_count: 0,
      high_count: 0,
    }));
  }

  // Build bin performance list from priorities
  const bins: BinPerformance[] = (priorities.priorities || []).map((p: any) => ({
    id: p.id,
    bin_number: p.bin_number,
    current_street: p.current_street,
    city: p.city,
    latitude: p.latitude,
    longitude: p.longitude,
    fill_percentage: p.last_fill_percentage,
    last_checked_at: null,
    avg_daily_fill_rate: p.avg_daily_fill_rate,
    estimated_current_fill: p.estimated_current_fill,
    days_since_check: p.days_since_check,
    urgency: p.urgency,
    check_count: p.check_count,
  }));

  // Calculate summary
  const totalBins = bins.length;
  const avgFillRate = totalBins > 0 ? bins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / totalBins : 0;
  const criticalCount = bins.filter(b => b.urgency === 'critical').length;
  const highCount = bins.filter(b => b.urgency === 'high').length;

  // Enrich area stats with urgency counts
  const areaCritical: Record<string, number> = {};
  const areaHigh: Record<string, number> = {};
  bins.forEach(b => {
    if (b.urgency === 'critical') areaCritical[b.city] = (areaCritical[b.city] || 0) + 1;
    if (b.urgency === 'high') areaHigh[b.city] = (areaHigh[b.city] || 0) + 1;
  });
  areas = areas.map(a => ({
    ...a,
    critical_count: areaCritical[a.city] || 0,
    high_count: areaHigh[a.city] || 0,
  }));

  return {
    bins,
    areas,
    summary: {
      total_bins: totalBins,
      avg_fill_rate: Math.round(avgFillRate * 10) / 10,
      avg_days_between_collections: 7, // placeholder
      critical_count: criticalCount,
      high_count: highCount,
    },
    fill_history: [], // TODO: could add weekly aggregation endpoint
  };
}
