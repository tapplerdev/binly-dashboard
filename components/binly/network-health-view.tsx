'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Package, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

interface WeekBucket {
  week_start: string;
  collections: number;
  median_fill_at_collection: number | null;
  incidents: number;
  shifts_completed: number;
  avg_completion_rate: number | null;
  moves: number;
}

interface FleetState {
  active: number;
  in_storage: number;
  pending_move: number;
  missing: number;
  retired: number;
}

async function fetchTimeseries(): Promise<{ weeks: WeekBucket[]; fleet: FleetState }> {
  const resp = await fetch(`${API_BASE_URL}/api/analytics/timeseries?weeks=12`, {
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`Failed to fetch timeseries: ${resp.statusText}`);
  const json = await resp.json();
  return json.data;
}

/** Sum a numeric field over a slice of weeks. */
function sum(weeks: WeekBucket[], f: (w: WeekBucket) => number): number {
  return weeks.reduce((s, w) => s + f(w), 0);
}

/**
 * KPI card with a delta vs the prior 4 weeks. Deltas compare the two most
 * recent 4-week windows so a single quiet week doesn't read as a trend.
 */
function KpiCard({
  label,
  value,
  delta,
  deltaGoodWhen,
  icon,
  hint,
}: {
  label: string;
  value: string;
  delta: number | null; // percent change vs prior window
  deltaGoodWhen: 'up' | 'down';
  icon: React.ReactNode;
  hint: string;
}) {
  const direction = delta == null || Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'up' : 'down';
  const isGood = direction === 'flat' ? null : (direction === deltaGoodWhen);
  const deltaColor =
    isGood == null ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500';
  const DeltaIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${deltaColor}`}>
        <DeltaIcon className="w-3.5 h-3.5" />
        <span>{delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}</span>
        <span className="text-gray-400 font-normal">{hint}</span>
      </div>
    </Card>
  );
}

/** Percent change between two windows; null when the baseline is empty. */
function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function NetworkHealthView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-timeseries'],
    queryFn: fetchTimeseries,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-500">Loading network health…</div>
    );
  }
  if (error || !data) {
    return (
      <div className="text-center py-16 text-red-500 text-sm">
        Failed to load network health data.
      </div>
    );
  }

  const weeks = data.weeks;
  const last4 = weeks.slice(-4);
  const prior4 = weeks.slice(-8, -4);

  const collectionsNow = sum(last4, w => w.collections);
  const collectionsPrior = sum(prior4, w => w.collections);
  const incidentsNow = sum(last4, w => w.incidents);
  const incidentsPrior = sum(prior4, w => w.incidents);
  const shiftsNow = sum(last4, w => w.shifts_completed);
  const shiftsPrior = sum(prior4, w => w.shifts_completed);

  const medianOf = (ws: WeekBucket[]) => {
    const vals = ws.map(w => w.median_fill_at_collection).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const fillNow = medianOf(last4);
  const fillPrior = medianOf(prior4);

  const chartData = weeks.map(w => ({
    ...w,
    // short label: "Jun 22"
    label: new Date(w.week_start + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const fleet = data.fleet;
  const fleetTotal = fleet.active + fleet.in_storage + fleet.pending_move + fleet.missing;

  return (
    <div className="space-y-4">
      {/* KPI strip — 4-week window vs the prior 4 weeks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Collections (4 wks)"
          value={String(collectionsNow)}
          delta={pctChange(collectionsNow, collectionsPrior)}
          deltaGoodWhen="up"
          icon={<Package className="w-4 h-4" />}
          hint="vs prior 4 wks"
        />
        <KpiCard
          label="Median Fill at Collection"
          value={fillNow != null ? `${fillNow.toFixed(0)}%` : '—'}
          delta={fillNow != null && fillPrior != null ? pctChange(fillNow, fillPrior) : null}
          deltaGoodWhen="up"
          icon={<CheckCircle2 className="w-4 h-4" />}
          hint="target 60–85%"
        />
        <KpiCard
          label="Incidents (4 wks)"
          value={String(incidentsNow)}
          delta={pctChange(incidentsNow, incidentsPrior)}
          deltaGoodWhen="down"
          icon={<AlertTriangle className="w-4 h-4" />}
          hint="vs prior 4 wks"
        />
        <KpiCard
          label="Shifts Run (4 wks)"
          value={String(shiftsNow)}
          delta={pctChange(shiftsNow, shiftsPrior)}
          deltaGoodWhen="up"
          icon={<Truck className="w-4 h-4" />}
          hint="vs prior 4 wks"
        />
      </div>

      {/* Fleet state strip */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          Fleet State — where the {fleetTotal} bins are right now
        </p>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
          {fleet.active > 0 && (
            <div className="bg-green-500" style={{ width: `${(fleet.active / fleetTotal) * 100}%` }} />
          )}
          {fleet.pending_move > 0 && (
            <div className="bg-amber-400" style={{ width: `${(fleet.pending_move / fleetTotal) * 100}%` }} />
          )}
          {fleet.in_storage > 0 && (
            <div className="bg-blue-400" style={{ width: `${(fleet.in_storage / fleetTotal) * 100}%` }} />
          )}
          {fleet.missing > 0 && (
            <div className="bg-red-400" style={{ width: `${(fleet.missing / fleetTotal) * 100}%` }} />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Deployed {fleet.active}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Pending move {fleet.pending_move}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Warehouse {fleet.in_storage}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Missing {fleet.missing}</span>
          <span className="text-gray-400">({fleet.retired} retired, excluded)</span>
        </div>
      </Card>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Collections & Shifts per Week</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip />
              <Bar dataKey="collections" name="Collections" fill="#4880FF" radius={[3, 3, 0, 0]} />
              <Bar dataKey="shifts_completed" name="Shifts" fill="#93c5fd" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            Median Fill at Collection
            <span className="ml-2 text-xs font-normal text-gray-400">shaded band = 60–85% target</span>
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(0)}%`} />
              <ReferenceArea y1={60} y2={85} fill="#22c55e" fillOpacity={0.08} />
              <Line
                type="monotone"
                dataKey="median_fill_at_collection"
                name="Median fill"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Incidents per Week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip />
              <Bar dataKey="incidents" name="Incidents" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Bin Moves per Week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip />
              <Bar dataKey="moves" name="Moves" fill="#a78bfa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
