'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

interface ScorecardRow {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  median_fill_last6: number | null;
  collections_last6: number;
  total_checks: number;
  fill_rate_per_day: number | null;
  est_current_fill: number | null;
  est_days_to_90: number | null;
  last_collection_on: number | null;
  quadrant: 'new' | 'overflow_risk' | 'weak_site' | 'over_visited' | 'healthy';
}

async function fetchScorecard(): Promise<ScorecardRow[]> {
  const resp = await fetch(`${API_BASE_URL}/api/analytics/bin-scorecard`, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Failed to fetch scorecard: ${resp.statusText}`);
  const json = await resp.json();
  return json.data ?? [];
}

const QUADRANT_META: Record<ScorecardRow['quadrant'], { label: string; color: string; chip: string }> = {
  healthy: { label: 'Healthy', color: '#22c55e', chip: 'bg-green-100 text-green-700' },
  overflow_risk: { label: 'Overflow risk', color: '#ef4444', chip: 'bg-red-100 text-red-700' },
  over_visited: { label: 'Over-visited', color: '#f59e0b', chip: 'bg-amber-100 text-amber-700' },
  weak_site: { label: 'Weak site', color: '#9333ea', chip: 'bg-purple-100 text-purple-700' },
  new: { label: 'New', color: '#9ca3af', chip: 'bg-gray-100 text-gray-500' },
};

type SortKey = 'bin_number' | 'fill_rate_per_day' | 'median_fill_last6' | 'est_days_to_90' | 'days_since_collection';

export function BinPerformanceView() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['bin-scorecard'],
    queryFn: fetchScorecard,
    staleTime: 5 * 60 * 1000,
  });

  const [sortKey, setSortKey] = useState<SortKey>('median_fill_last6');
  const [sortAsc, setSortAsc] = useState(true);
  const [quadrantFilter, setQuadrantFilter] = useState<ScorecardRow['quadrant'] | 'all'>('all');

  const now = Math.floor(Date.now() / 1000);
  const daysSince = (t: number | null) => (t == null ? null : Math.floor((now - t) / 86400));

  const rows = useMemo(() => {
    const filtered = quadrantFilter === 'all' ? data : data.filter(r => r.quadrant === quadrantFilter);
    const val = (r: ScorecardRow): number => {
      switch (sortKey) {
        case 'bin_number': return r.bin_number;
        case 'fill_rate_per_day': return r.fill_rate_per_day ?? -1;
        case 'median_fill_last6': return r.median_fill_last6 ?? -1;
        case 'est_days_to_90': return r.est_days_to_90 ?? Number.MAX_SAFE_INTEGER;
        case 'days_since_collection': return daysSince(r.last_collection_on) ?? Number.MAX_SAFE_INTEGER;
      }
    };
    return [...filtered].sort((a, b) => (sortAsc ? val(a) - val(b) : val(b) - val(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sortKey, sortAsc, quadrantFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.length };
    data.forEach(r => { c[r.quadrant] = (c[r.quadrant] ?? 0) + 1; });
    return c;
  }, [data]);

  // Scatter uses only bins with both coordinates of the quadrant test.
  const scatterData = useMemo(
    () => data.filter(r => r.fill_rate_per_day != null && r.median_fill_last6 != null && r.quadrant !== 'new'),
    [data],
  );

  if (isLoading) return <div className="text-center py-16 text-gray-500">Loading bin scorecard…</div>;
  if (error) return <div className="text-center py-16 text-red-500 text-sm">Failed to load bin scorecard.</div>;

  const header = (label: string, key: SortKey) => (
    <th
      className="px-3 py-2 text-left font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
      onClick={() => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(true); }
      }}
    >
      {label}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Demand vs cadence quadrant */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Demand vs Cadence</p>
        <p className="text-xs text-gray-500 mb-3">
          x: how fast the site fills (%/day) · y: how full we find it (median of last 6 collections).
          Left of the 1.5%/day line and low = <span className="text-purple-600 font-medium">weak site (relocate)</span>;
          right and low = <span className="text-amber-600 font-medium">over-visited (reduce cadence)</span>;
          above 85% = <span className="text-red-600 font-medium">overflow risk (increase cadence)</span>.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <XAxis
              type="number" dataKey="fill_rate_per_day" name="Fill rate"
              unit="%/d" tick={{ fontSize: 11 }} domain={[0, 'auto']}
            />
            <YAxis
              type="number" dataKey="median_fill_last6" name="Median fill"
              unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} width={40}
            />
            <ZAxis type="number" range={[50, 51]} />
            <ReferenceArea y1={60} y2={85} fill="#22c55e" fillOpacity={0.06} />
            <ReferenceLine x={1.5} stroke="#9ca3af" strokeDasharray="4 4" />
            <ReferenceLine y={30} stroke="#9ca3af" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as ScorecardRow | undefined;
                if (!p) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-900">Bin #{p.bin_number}</p>
                    <p className="text-gray-500">{p.current_street}, {p.city}</p>
                    <p className="mt-1">{p.fill_rate_per_day?.toFixed(1)}%/day · median {p.median_fill_last6?.toFixed(0)}%</p>
                    <p className={`mt-0.5 font-medium`} style={{ color: QUADRANT_META[p.quadrant].color }}>
                      {QUADRANT_META[p.quadrant].label}
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData}>
              {scatterData.map(r => (
                <Cell key={r.id} fill={QUADRANT_META[r.quadrant].color} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Quadrant filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'overflow_risk', 'over_visited', 'weak_site', 'healthy', 'new'] as const).map(q => (
          <button
            key={q}
            onClick={() => setQuadrantFilter(q)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none ${
              quadrantFilter === q
                ? q === 'all' ? 'bg-gray-800 text-white' : QUADRANT_META[q].chip + ' ring-1 ring-current'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {q === 'all' ? 'All' : QUADRANT_META[q].label} {counts[q] ?? 0}
          </button>
        ))}
      </div>

      {/* Scorecard table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {header('Bin #', 'bin_number')}
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Location</th>
              {header('Fills %/day', 'fill_rate_per_day')}
              {header('Median fill (last 6)', 'median_fill_last6')}
              {header('Days since collection', 'days_since_collection')}
              {header('Est. days to 90%', 'est_days_to_90')}
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Quadrant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const meta = QUADRANT_META[r.quadrant];
              const since = daysSince(r.last_collection_on);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">#{r.bin_number}</td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[220px]">{r.current_street}, {r.city}</td>
                  <td className="px-3 py-2 text-gray-800">{r.fill_rate_per_day != null ? r.fill_rate_per_day.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{r.median_fill_last6 != null ? `${r.median_fill_last6.toFixed(0)}%` : '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{since != null ? `${since}d` : 'never'}</td>
                  <td className="px-3 py-2 text-gray-800">{r.est_days_to_90 != null ? `${Math.max(0, r.est_days_to_90).toFixed(0)}d` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${meta.chip}`}>{meta.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No bins in this quadrant.</p>
        )}
      </Card>
    </div>
  );
}
