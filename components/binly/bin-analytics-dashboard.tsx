'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Activity, TrendingUp, AlertTriangle, MapPin, ArrowUpDown, ChevronDown, Loader2, X, ArrowLeft, Maximize2, Camera, Calendar } from 'lucide-react';
import { fetchBinAnalytics, BinPerformance } from '@/lib/api/bin-analytics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  try { const t = JSON.parse(localStorage.getItem('binly-auth-storage') || '{}')?.state?.token; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

// Bin detail drawer — slides in from right with check history + photos
function BinDetailDrawer({ bin, onClose }: { bin: BinPerformance; onClose: () => void }) {
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/bins/${bin.id}/checks`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { setChecks(Array.isArray(d) ? d : d.data || d.checks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [bin.id]);

  const urgCfg: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
  const fillColor = bin.estimated_current_fill >= 80 ? 'bg-red-500' : bin.estimated_current_fill >= 60 ? 'bg-amber-500' : bin.estimated_current_fill >= 40 ? 'bg-blue-500' : 'bg-gray-300';

  return (
    <div className="fixed top-0 right-0 h-full z-[10000]" onClick={e => e.stopPropagation()}>
      <div className="h-full w-96 bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bin #{bin.bin_number}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{bin.current_street}, {bin.city}</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${urgCfg[bin.urgency]}`}>{bin.urgency}</span>
            <span className="text-xs text-gray-500">{bin.avg_daily_fill_rate}%/day fill rate</span>
            <span className="text-xs text-gray-400">{bin.days_since_check < 1 ? 'Checked today' : `${bin.days_since_check}d since last check`}</span>
          </div>
          {/* Fill bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.min(bin.estimated_current_fill, 100)}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700">{bin.estimated_current_fill}%</span>
          </div>
        </div>

        {/* Check history */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800">Check History ({checks.length})</h4>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
          ) : checks.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-12">No check history available</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {checks.map((c: any, i: number) => {
                const date = c.checkedOnIso ? new Date(c.checkedOnIso) : new Date((c.checked_on || c.created_at) * 1000);
                const fill = c.fillPercentage ?? c.fill_percentage ?? c.updated_fill_percentage;
                const photo = c.photoUrl || c.photo_url;
                const checkedBy = c.checkedByName || c.checked_by;
                const cFillColor = fill >= 80 ? 'bg-red-500' : fill >= 60 ? 'bg-amber-500' : fill >= 40 ? 'bg-blue-500' : 'bg-gray-300';
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {checkedBy && <span className="text-[10px] text-gray-400">by {checkedBy}</span>}
                      </div>
                      {fill != null && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cFillColor}`} style={{ width: `${Math.min(fill, 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{fill}%</span>
                        </div>
                      )}
                    </div>
                    {photo && (
                      <a href={photo} target="_blank" rel="noopener noreferrer">
                        <img src={photo} alt={`Check ${i + 1}`}
                          className="w-full h-40 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function BinMarker({ fill, binNumber, size, showNumber }: { fill: number; binNumber: number; size: number; showNumber?: boolean }) {
  const color = fill >= 80 ? '#ef4444' : fill >= 60 ? '#f59e0b' : fill >= 40 ? '#3b82f6' : '#9ca3af';
  const opacity = Math.max(0.5, Math.min(0.95, fill / 100));
  if (showNumber) {
    return (
      <div className="flex flex-col items-center">
        <div className="rounded-full border-2 border-white shadow-md flex items-center justify-center"
          style={{ width: Math.max(size, 24), height: Math.max(size, 24), backgroundColor: color, opacity }}>
          <span className="text-[8px] font-bold text-white leading-none">{binNumber}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-full border-2 border-white shadow-md"
      style={{ width: size, height: size, backgroundColor: color, opacity }} />
  );
}

// Pans map to selected bin location
function MapPanner({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  if (map) { map.panTo({ lat, lng }); map.setZoom(14); }
  return null;
}

type SortKey = 'estimated_current_fill' | 'avg_daily_fill_rate' | 'days_since_check' | 'bin_number';

export function BinAnalyticsDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const [sortKey, setSortKey] = useState<SortKey>('estimated_current_fill');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAllBins, setShowAllBins] = useState(false);

  // Interactive chart state
  const [chartView, setChartView] = useState<'city' | 'subarea' | 'bins'>('subarea');
  const [areaFilter, setAreaFilter] = useState<string | null>(null);

  // Interactive map state
  const [mapUrgencyFilter, setMapUrgencyFilter] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);
  const [selectedBin, setSelectedBin] = useState<BinPerformance | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  const sortedBins = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.bins].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return showAllBins ? sorted : sorted.slice(0, 20);
  }, [data, sortKey, sortAsc, showAllBins]);

  // Bar chart data: top 15 bins by fill rate
  const barData = useMemo(() => {
    if (!data) return [];
    return [...data.bins]
      .sort((a, b) => b.avg_daily_fill_rate - a.avg_daily_fill_rate)
      .slice(0, 15)
      .map(b => ({
        name: `#${b.bin_number}`,
        fillRate: b.avg_daily_fill_rate,
        city: b.city,
        fill: b.estimated_current_fill,
      }));
  }, [data]);

  // Pie chart: urgency distribution
  const pieData = useMemo(() => {
    if (!data) return [];
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    data.bins.forEach(b => { counts[b.urgency as keyof typeof counts]++; });
    return [
      { name: 'Critical', value: counts.critical, color: '#ef4444' },
      { name: 'High', value: counts.high, color: '#f59e0b' },
      { name: 'Medium', value: counts.medium, color: '#3b82f6' },
      { name: 'Low', value: counts.low, color: '#9ca3af' },
    ].filter(d => d.value > 0);
  }, [data]);

  // Area bar chart
  const areaData = useMemo(() => {
    if (!data || data.bins.length === 0) return [];

    // Use sub-area clustering (same as map clusters) for more granular area breakdown
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const sorted = [...data.bins].sort((a, b) => a.latitude - b.latitude);
    const assigned = new Set<string>();
    const clusters: Array<{ bins: BinPerformance[]; centerLat: number; centerLng: number }> = [];

    for (const bin of sorted) {
      if (assigned.has(bin.id)) continue;
      const clusterBins = [bin];
      assigned.add(bin.id);
      let cLat = bin.latitude, cLng = bin.longitude;
      let changed = true;
      while (changed) {
        changed = false;
        for (const b of sorted) {
          if (assigned.has(b.id)) continue;
          if (haversine(cLat, cLng, b.latitude, b.longitude) <= 4) {
            clusterBins.push(b);
            assigned.add(b.id);
            cLat = clusterBins.reduce((s, x) => s + x.latitude, 0) / clusterBins.length;
            cLng = clusterBins.reduce((s, x) => s + x.longitude, 0) / clusterBins.length;
            changed = true;
          }
        }
      }
      clusters.push({ bins: clusterBins, centerLat: cLat, centerLng: cLng });
    }

    // Name each cluster with directional suffix for multi-cluster cities
    const cityClusterCounts: Record<string, number> = {};
    const clusterCities: string[] = [];
    for (const c of clusters) {
      const cities: Record<string, number> = {};
      c.bins.forEach(b => { cities[b.city] = (cities[b.city] || 0) + 1; });
      const dominant = Object.entries(cities).sort((a, b) => b[1] - a[1])[0][0];
      cityClusterCounts[dominant] = (cityClusterCounts[dominant] || 0) + 1;
      clusterCities.push(dominant);
    }

    const cityLatGroups: Record<string, number[]> = {};
    clusters.forEach((c, i) => {
      const city = clusterCities[i];
      if (!cityLatGroups[city]) cityLatGroups[city] = [];
      cityLatGroups[city].push(c.centerLat);
    });
    for (const city in cityLatGroups) cityLatGroups[city].sort((a, b) => a - b);

    return clusters.map((c, i) => {
      const dominant = clusterCities[i];
      let label = dominant;
      if (cityClusterCounts[dominant] > 1) {
        const lats = cityLatGroups[dominant];
        const latIdx = lats.indexOf(c.centerLat);
        const dirs = lats.length === 2 ? ['South', 'North'] : lats.length === 3 ? ['South', 'Central', 'North'] : lats.map((_, k) => `Area ${k + 1}`);
        if (latIdx >= 0 && latIdx < dirs.length) label += ' ' + dirs[latIdx];
      }

      const avg = c.bins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / c.bins.length;
      const variance = c.bins.reduce((s, b) => s + (b.avg_daily_fill_rate - avg) ** 2, 0) / c.bins.length;
      const reliable = c.bins.length >= 5;

      return {
        city: label.length > 15 ? label.slice(0, 15) + '...' : label,
        fullCity: label,
        bins: c.bins.length,
        avgFillRate: Math.round(avg * 10) / 10,
        avgFill: Math.round(c.bins.reduce((s, b) => s + b.estimated_current_fill, 0) / c.bins.length),
        stddev: Math.round(Math.sqrt(variance) * 10) / 10,
        reliable,
        opacity: reliable ? 1 : 0.5,
      };
    }).sort((a, b) => b.avgFillRate - a.avgFillRate);
  }, [data]);

  // City-level data for bar chart
  const cityData = useMemo(() => {
    if (!data) return [];
    const cityMap: Record<string, { count: number; totalRate: number; rates: number[] }> = {};
    data.bins.forEach(b => {
      if (!cityMap[b.city]) cityMap[b.city] = { count: 0, totalRate: 0, rates: [] };
      cityMap[b.city].count++;
      cityMap[b.city].totalRate += b.avg_daily_fill_rate;
      cityMap[b.city].rates.push(b.avg_daily_fill_rate);
    });
    return Object.entries(cityMap).map(([city, stats]) => {
      const avg = stats.totalRate / stats.count;
      return {
        city: city.length > 12 ? city.slice(0, 12) + '...' : city,
        fullCity: city,
        bins: stats.count,
        avgFillRate: Math.round(avg * 10) / 10,
        reliable: stats.count >= 5,
      };
    }).sort((a, b) => b.avgFillRate - a.avgFillRate);
  }, [data]);

  // Per-bin data for bar chart (filtered by area if set)
  const binChartData = useMemo(() => {
    if (!data) return [];
    let filtered = data.bins;
    if (areaFilter) filtered = filtered.filter(b => b.city === areaFilter);
    return [...filtered]
      .sort((a, b) => b.avg_daily_fill_rate - a.avg_daily_fill_rate)
      .slice(0, 20)
      .map(b => ({
        city: `#${b.bin_number}`,
        fullCity: `Bin #${b.bin_number} — ${b.current_street}, ${b.city}`,
        bins: 1,
        avgFillRate: b.avg_daily_fill_rate,
        reliable: true,
      }));
  }, [data, areaFilter]);

  // Active chart data based on view
  const activeChartData = useMemo(() => {
    let d = chartView === 'city' ? cityData : chartView === 'bins' ? binChartData : areaData;
    if (areaFilter && chartView === 'subarea') {
      d = d.filter(a => a.fullCity.startsWith(areaFilter));
    }
    return d;
  }, [chartView, cityData, areaData, binChartData, areaFilter]);

  // Unique cities for filter dropdown
  const uniqueCities = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.bins.map(b => b.city))].sort();
  }, [data]);

  // Map center: average of all bin locations
  const mapCenter = useMemo(() => {
    if (!data || data.bins.length === 0) return { lat: 37.4, lng: -122.0 };
    const lat = data.bins.reduce((s, b) => s + b.latitude, 0) / data.bins.length;
    const lng = data.bins.reduce((s, b) => s + b.longitude, 0) / data.bins.length;
    return { lat, lng };
  }, [data]);

  // Geographic clusters for map zones
  const mapClusters = useMemo(() => {
    if (!data || data.bins.length === 0) return [];

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Centroid-based clustering (mirrors backend logic)
    const maxDiameter = 8; // miles
    const sorted = [...data.bins].sort((a, b) => a.latitude - b.latitude);
    const assigned = new Set<string>();
    const clusters: Array<{
      bins: BinPerformance[];
      centerLat: number;
      centerLng: number;
      label: string;
      avgFillRate: number;
      avgFill: number;
      radiusMiles: number;
    }> = [];

    for (const bin of sorted) {
      if (assigned.has(bin.id)) continue;
      const clusterBins = [bin];
      assigned.add(bin.id);
      let cLat = bin.latitude, cLng = bin.longitude;

      let changed = true;
      while (changed) {
        changed = false;
        for (const b of sorted) {
          if (assigned.has(b.id)) continue;
          if (haversine(cLat, cLng, b.latitude, b.longitude) <= maxDiameter / 2) {
            clusterBins.push(b);
            assigned.add(b.id);
            cLat = clusterBins.reduce((s, x) => s + x.latitude, 0) / clusterBins.length;
            cLng = clusterBins.reduce((s, x) => s + x.longitude, 0) / clusterBins.length;
            changed = true;
          }
        }
      }

      // Calculate cluster stats
      const avgRate = clusterBins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / clusterBins.length;
      const avgFill = clusterBins.reduce((s, b) => s + b.estimated_current_fill, 0) / clusterBins.length;

      // Radius: max distance from center to any bin, minimum 0.5 miles
      let maxDist = 0.5;
      for (const b of clusterBins) {
        const d = haversine(cLat, cLng, b.latitude, b.longitude);
        if (d > maxDist) maxDist = d;
      }

      // Dominant city
      const cities: Record<string, number> = {};
      clusterBins.forEach(b => { cities[b.city] = (cities[b.city] || 0) + 1; });
      const dominant = Object.entries(cities).sort((a, b) => b[1] - a[1])[0][0];

      clusters.push({
        bins: clusterBins,
        centerLat: cLat,
        centerLng: cLng,
        label: dominant, // will be enriched with directional suffix below
        avgFillRate: Math.round(avgRate * 10) / 10,
        avgFill: Math.round(avgFill),
        radiusMiles: Math.round(maxDist * 10) / 10 + 0.3,
      });
    }

    // Add directional suffixes for cities with multiple clusters
    const clusterCityCount: Record<string, number> = {};
    clusters.forEach(c => { clusterCityCount[c.label] = (clusterCityCount[c.label] || 0) + 1; });
    const cityLatMap: Record<string, number[]> = {};
    clusters.forEach(c => {
      if (!cityLatMap[c.label]) cityLatMap[c.label] = [];
      cityLatMap[c.label].push(c.centerLat);
    });
    for (const city in cityLatMap) cityLatMap[city].sort((a, b) => a - b);

    clusters.forEach(c => {
      if (clusterCityCount[c.label] > 1) {
        const lats = cityLatMap[c.label];
        const idx = lats.indexOf(c.centerLat);
        const dirs = lats.length === 2 ? ['South', 'North'] : lats.length === 3 ? ['South', 'Central', 'North'] : lats.map((_, k) => `Area ${k + 1}`);
        if (idx >= 0 && idx < dirs.length) c.label = c.label + ' ' + dirs[idx];
      }
    });

    return clusters;
  }, [data]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Failed to load analytics data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Bins" value={data.summary.total_bins} icon={MapPin} color="bg-blue-500" sub="Across all areas" />
        <KpiCard label="Avg Fill Rate" value={`${data.summary.avg_fill_rate}%/day`} icon={TrendingUp} color="bg-green-500" sub="Avg daily fill increase" />
        <KpiCard label="Need Collection" value={data.summary.critical_count} icon={AlertTriangle} color="bg-red-500" sub={`${data.summary.high_count} more within 2 days`} />
        <KpiCard label="Bins Checked" value={`${data.bins.filter(b => b.days_since_check <= 7).length}`} icon={Activity} color="bg-purple-500" sub="Within last 7 days" />
      </div>

      {/* Two column: Heat Map + Urgency Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heat Map — simple preview with expand button */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Fill Rate Heat Map</h3>
              <p className="text-xs text-gray-400 mt-0.5">Click Expand to explore clusters and bins</p>
            </div>
            <button onClick={() => setShowMapModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Maximize2 className="w-3.5 h-3.5" /> Expand
            </button>
          </div>
          <div className="h-[350px] cursor-pointer" onClick={() => setShowMapModal(true)}>
            {GOOGLE_MAPS_API_KEY ? (
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map defaultCenter={mapCenter} defaultZoom={10} mapId="binly-analytics" disableDefaultUI gestureHandling="none" className="w-full h-full">
                  {mapClusters.map((cluster, idx) => {
                    const color = cluster.avgFillRate >= 10 ? 'rgba(239,68,68,0.15)' : cluster.avgFillRate >= 7 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)';
                    const borderColor = cluster.avgFillRate >= 10 ? 'rgba(239,68,68,0.5)' : cluster.avgFillRate >= 7 ? 'rgba(245,158,11,0.5)' : 'rgba(59,130,246,0.35)';
                    const textColor = cluster.avgFillRate >= 10 ? '#dc2626' : cluster.avgFillRate >= 7 ? '#d97706' : '#2563eb';
                    const sizePx = Math.max(80, cluster.radiusMiles * 40);
                    return (
                      <AdvancedMarker key={`zone-${idx}`} position={{ lat: cluster.centerLat, lng: cluster.centerLng }}>
                        <div className="relative flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
                          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color, border: `2px dashed ${borderColor}` }} />
                          <div className="relative text-center z-10 px-1">
                            <div className="text-[10px] font-bold leading-tight" style={{ color: textColor }}>{cluster.label}</div>
                            <div className="text-[9px] font-medium" style={{ color: textColor }}>{cluster.bins.length} bins</div>
                          </div>
                        </div>
                      </AdvancedMarker>
                    );
                  })}
                  {data.bins.map(bin => (
                    <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }}>
                      <BinMarker fill={bin.estimated_current_fill} binNumber={bin.bin_number} size={Math.max(10, Math.min(28, bin.avg_daily_fill_rate * 2))} />
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Google Maps API key required</div>
            )}
          </div>
        </div>

        {/* Urgency Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Urgency Distribution</h3>
          </div>
          <div className="h-[350px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two column: Top Bins Bar Chart + Area Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Bins by Fill Rate */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Fastest Filling Bins</h3>
            <p className="text-xs text-gray-400 mt-0.5">Average fill rate (%/day)</p>
          </div>
          <div className="p-4 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%/d" />
                <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value}%/day`, 'Fill Rate']}
                  labelFormatter={(label) => {
                    const bin = barData.find(b => b.name === label);
                    return `${label} — ${bin?.city || ''}`;
                  }}
                />
                <Bar dataKey="fillRate" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fillRate >= 12 ? '#ef4444' : entry.fillRate >= 8 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance by Area — with drill-down */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {areaFilter && (
                  <button onClick={() => { setAreaFilter(null); setChartView('city'); }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"><ArrowLeft className="w-3.5 h-3.5" /></button>
                )}
                <h3 className="text-sm font-semibold text-gray-800">
                  {chartView === 'city' ? 'Performance by City' : chartView === 'bins' ? `Top Bins${areaFilter ? ` — ${areaFilter}` : ''}` : `Sub-Area Performance${areaFilter ? ` — ${areaFilter}` : ''}`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {(['city', 'subarea', 'bins'] as const).map(v => (
                    <button key={v} onClick={() => setChartView(v)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${chartView === v ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                      {v === 'city' ? 'City' : v === 'subarea' ? 'Sub-Area' : 'Bins'}
                    </button>
                  ))}
                </div>
                <select value={areaFilter || ''} onChange={e => setAreaFilter(e.target.value || null)}
                  className="text-[10px] border border-gray-200 rounded-md px-1.5 py-1 text-gray-600 bg-white">
                  <option value="">All Areas</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="p-4 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeChartData} margin={{ left: 5, right: 20, top: 15, bottom: 5 }}
                onClick={(e: any) => {
                  if (!e?.activeLabel) return;
                  if (chartView === 'city') {
                    const area = cityData.find(a => a.city === e.activeLabel);
                    if (area) { setAreaFilter(area.fullCity); setChartView('subarea'); }
                  } else if (chartView === 'subarea') {
                    setChartView('bins');
                  }
                }}
                style={{ cursor: chartView !== 'bins' ? 'pointer' : 'default' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="city" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} unit="%/d" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const area = activeChartData.find((a: any) => a.city === label);
                    if (!area) return null;
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs">
                        <div className="font-semibold text-gray-800">{area.fullCity}</div>
                        <div className="text-gray-600 mt-1">{area.avgFillRate}%/day avg fill rate</div>
                        <div className="text-gray-500">{area.bins} bin{area.bins !== 1 ? 's' : ''}</div>
                        {chartView !== 'bins' && <div className="text-blue-500 mt-1">Click to drill down</div>}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgFillRate" radius={[4, 4, 0, 0]}
                  label={({ x, y, width, index }: any) => {
                    const entry = activeChartData[index];
                    if (!entry || chartView === 'bins') return null;
                    return (
                      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                        {entry.bins} bins
                      </text>
                    );
                  }}
                >
                  {activeChartData.map((entry: any, idx: number) => {
                    const baseColor = entry.avgFillRate >= 10 ? '#ef4444' : entry.avgFillRate >= 7 ? '#f59e0b' : '#4880FF';
                    return <Cell key={idx} fill={baseColor} fillOpacity={entry.reliable !== false ? 1 : 0.4} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Full Bin Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">All Bins Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by {sortKey.replace(/_/g, ' ')}</p>
          </div>
          {data.bins.length > 20 && (
            <button onClick={() => setShowAllBins(!showAllBins)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {showAllBins ? 'Show Top 20' : `Show All ${data.bins.length}`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">
                  <button onClick={() => handleSort('bin_number')} className="flex items-center gap-1 hover:text-gray-800">
                    Bin <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">City</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-600">
                  <button onClick={() => handleSort('estimated_current_fill')} className="flex items-center gap-1 ml-auto hover:text-gray-800">
                    Est. Fill <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-600">
                  <button onClick={() => handleSort('avg_daily_fill_rate')} className="flex items-center gap-1 ml-auto hover:text-gray-800">
                    Fill Rate <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-600">
                  <button onClick={() => handleSort('days_since_check')} className="flex items-center gap-1 ml-auto hover:text-gray-800">
                    Last Check <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {sortedBins.map(bin => {
                const urgencyColors: Record<string, string> = {
                  critical: 'bg-red-100 text-red-700',
                  high: 'bg-amber-100 text-amber-700',
                  medium: 'bg-blue-100 text-blue-700',
                  low: 'bg-gray-100 text-gray-600',
                };
                const fillColor = bin.estimated_current_fill >= 80 ? 'text-red-600' : bin.estimated_current_fill >= 60 ? 'text-amber-600' : 'text-gray-700';
                return (
                  <tr key={bin.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">#{bin.bin_number}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">{bin.current_street}</td>
                    <td className="px-4 py-2.5 text-gray-600">{bin.city}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bin.estimated_current_fill >= 80 ? 'bg-red-500' : bin.estimated_current_fill >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(bin.estimated_current_fill, 100)}%` }} />
                        </div>
                        <span className={`font-medium w-8 text-right ${fillColor}`}>{bin.estimated_current_fill}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{bin.avg_daily_fill_rate}%/d</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {bin.days_since_check < 1 ? 'Today' : `${bin.days_since_check}d ago`}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyColors[bin.urgency] || urgencyColors.low}`}>
                        {bin.urgency.charAt(0).toUpperCase() + bin.urgency.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!showAllBins && data.bins.length > 20 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-center">
            <button onClick={() => setShowAllBins(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto">
              Show all {data.bins.length} bins <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Full-screen heat map modal — portaled to body */}
      {showMapModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-[95vw] max-h-[92vh] h-[92vh] mx-4 overflow-hidden flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900">Fill Rate Heat Map</h2>
                <div className="flex items-center gap-1">
                  {(['all', 'critical', 'high', 'medium', 'low'] as const).map(u => {
                    const colors: Record<string, string> = { all: 'bg-gray-800 text-white', critical: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
                    const isActive = mapUrgencyFilter === (u === 'all' ? null : u) || (u === 'all' && !mapUrgencyFilter);
                    return (
                      <button key={u} onClick={() => { setMapUrgencyFilter(u === 'all' ? null : u); setSelectedCluster(null); }}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${isActive ? colors[u] : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                        {u === 'all' ? 'All' : u.charAt(0).toUpperCase() + u.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => { setShowMapModal(false); setSelectedCluster(null); setSelectedBin(null); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-80 border-r border-gray-200 flex flex-col min-h-0">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">{mapClusters.length} Areas</span>
                  <select value={areaFilter || ''} onChange={e => { setAreaFilter(e.target.value || null); setSelectedCluster(null); }}
                    className="text-[10px] border border-gray-200 rounded-md px-1.5 py-0.5 text-gray-600 bg-white">
                    <option value="">All Cities</option>
                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {mapClusters
                    .filter(c => !mapUrgencyFilter || c.bins.some(b => b.urgency === mapUrgencyFilter))
                    .filter(c => !areaFilter || c.label.startsWith(areaFilter))
                    .sort((a, b) => b.avgFillRate - a.avgFillRate)
                    .map((cluster, idx) => {
                    const isSelected = selectedCluster === cluster;
                    const filteredBins = mapUrgencyFilter ? cluster.bins.filter(b => b.urgency === mapUrgencyFilter) : cluster.bins;
                    const rateColor = cluster.avgFillRate >= 10 ? 'text-red-600' : cluster.avgFillRate >= 7 ? 'text-amber-600' : 'text-blue-600';
                    return (
                      <div key={idx} onClick={() => setSelectedCluster(isSelected ? null : cluster)}
                        className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-all ${isSelected ? 'bg-gray-50 border-l-[3px] border-l-gray-800' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">{cluster.label}</span>
                          <span className={`text-xs font-bold ${rateColor}`}>{cluster.avgFillRate}%/d</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                          <span>{filteredBins.length} bins</span><span>·</span><span>{cluster.avgFill}% avg fill</span>
                        </div>
                        {isSelected && (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {(['critical', 'high', 'medium', 'low'] as const).map(u => {
                                const count = cluster.bins.filter((b: BinPerformance) => b.urgency === u).length;
                                if (count === 0) return null;
                                const cfg: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
                                return <span key={u} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${cfg[u]}`}>{count} {u}</span>;
                              })}
                            </div>
                            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                              {[...filteredBins].sort((a, b) => b.avg_daily_fill_rate - a.avg_daily_fill_rate).map(bin => {
                                const urgColors: Record<string, string> = { critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-500', low: 'bg-gray-400' };
                                const isBinSelected = selectedBin?.id === bin.id;
                                return (
                                  <div key={bin.id}
                                    className={`flex items-center gap-2 py-1 cursor-pointer rounded px-1 ${isBinSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedBin(isBinSelected ? null : bin); }}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgColors[bin.urgency]}`} />
                                    <span className="text-[10px] font-semibold text-gray-700 w-7">#{bin.bin_number}</span>
                                    <span className="text-[10px] text-gray-400 flex-1 truncate">{bin.current_street}</span>
                                    <span className="text-[9px] text-gray-500 w-10 text-right">{bin.avg_daily_fill_rate}%/d</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
                {GOOGLE_MAPS_API_KEY ? (
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map defaultCenter={mapCenter} defaultZoom={10} mapId="binly-analytics-modal" disableDefaultUI gestureHandling="greedy" className="w-full h-full">
                      {mapClusters.map((cluster, idx) => {
                        const clusterBins = mapUrgencyFilter ? cluster.bins.filter(b => b.urgency === mapUrgencyFilter) : cluster.bins;
                        if (clusterBins.length === 0) return null;
                        const isSelected = selectedCluster === cluster;
                        const color = cluster.avgFillRate >= 10 ? 'rgba(239,68,68,0.15)' : cluster.avgFillRate >= 7 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)';
                        const borderColor = cluster.avgFillRate >= 10 ? 'rgba(239,68,68,0.5)' : cluster.avgFillRate >= 7 ? 'rgba(245,158,11,0.5)' : 'rgba(59,130,246,0.35)';
                        const textColor = cluster.avgFillRate >= 10 ? '#dc2626' : cluster.avgFillRate >= 7 ? '#d97706' : '#2563eb';
                        const sizePx = Math.max(80, cluster.radiusMiles * 40);
                        return (
                          <AdvancedMarker key={`mzone-${idx}`} position={{ lat: cluster.centerLat, lng: cluster.centerLng }}
                            onClick={() => setSelectedCluster(isSelected ? null : cluster)}>
                            <div className={`relative flex items-center justify-center cursor-pointer transition-transform ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
                              style={{ width: sizePx, height: sizePx }}>
                              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color, border: `2px ${isSelected ? 'solid' : 'dashed'} ${borderColor}` }} />
                              <div className="relative text-center z-10 px-1">
                                <div className="text-[10px] font-bold leading-tight" style={{ color: textColor }}>{cluster.label}</div>
                                <div className="text-[9px] font-medium" style={{ color: textColor }}>{clusterBins.length} bins · {cluster.avgFillRate}%/d</div>
                              </div>
                            </div>
                          </AdvancedMarker>
                        );
                      })}
                      {data.bins.filter(bin => !mapUrgencyFilter || bin.urgency === mapUrgencyFilter).map(bin => {
                        const size = Math.max(14, Math.min(36, bin.avg_daily_fill_rate * 2.5));
                        const isSelected = selectedBin?.id === bin.id;
                        return (
                          <AdvancedMarker key={`mbin-${bin.id}`} position={{ lat: bin.latitude, lng: bin.longitude }}
                            onClick={() => setSelectedBin(isSelected ? null : bin)}>
                            <div className="cursor-pointer"><BinMarker fill={bin.estimated_current_fill} binNumber={bin.bin_number} size={isSelected ? size + 8 : size} showNumber /></div>
                          </AdvancedMarker>
                        );
                      })}
                      {/* Pan camera to selected bin */}
                      {selectedBin && <MapPanner lat={selectedBin.latitude} lng={selectedBin.longitude} />}
                    </Map>
                  </APIProvider>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 text-sm">Google Maps API key required</div>
                )}
              </div>
            </div>
            {/* Bin detail drawer */}
            {selectedBin && (
              <BinDetailDrawer bin={selectedBin} onClose={() => setSelectedBin(null)} />
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
