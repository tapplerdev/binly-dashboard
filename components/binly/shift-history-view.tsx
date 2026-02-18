'use client';

import { useState } from 'react';
import { useShiftHistory } from '@/lib/hooks/use-shift-history';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { ShiftHistoryEntry } from '@/lib/api/shifts';
import {
  Clock, Package, MapPin, Truck, SkipForward, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, User, Calendar,
  ArrowRightLeft, Warehouse, Search, Filter,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(startTime: number | null, endTime: number | null, pauseSeconds: number): string {
  if (!startTime || !endTime) return '—';
  const totalSecs = endTime - startTime - pauseSeconds;
  if (totalSecs <= 0) return '—';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const END_REASON_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  completed:           { label: 'Completed',          color: 'text-green-700',  bg: 'bg-green-100' },
  manual_end:          { label: 'Driver Ended',        color: 'text-blue-700',   bg: 'bg-blue-100' },
  manager_ended:       { label: 'Manager Ended',       color: 'text-amber-700',  bg: 'bg-amber-100' },
  manager_cancelled:   { label: 'Cancelled',           color: 'text-red-700',    bg: 'bg-red-100' },
  driver_disconnected: { label: 'Disconnected',        color: 'text-orange-700', bg: 'bg-orange-100' },
  system_timeout:      { label: 'Timed Out',           color: 'text-gray-700',   bg: 'bg-gray-100' },
};

function completionColor(rate: number): string {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function completionBar(rate: number): string {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// ── Stat Chip ─────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color = 'text-gray-700', hide0 = false }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
  hide0?: boolean;
}) {
  if (hide0 && value === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium">
      <Icon className={`w-3 h-3 ${color} shrink-0`} />
      <span className={color}>{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

// ── Expanded Row ──────────────────────────────────────────────────────────────

function ExpandedRow({ shift }: { shift: ShiftHistoryEntry }) {
  const reason = END_REASON_LABEL[shift.end_reason] ?? { label: shift.end_reason, color: 'text-gray-700', bg: 'bg-gray-100' };

  return (
    <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/60">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Timing */}
        <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-4 text-gray-600 mb-1">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Start: {formatTime(shift.start_time)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> End: {formatTime(shift.end_time)}</span>
          {shift.total_pause_seconds > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Clock className="w-3 h-3" /> Paused: {Math.round(shift.total_pause_seconds / 60)}m
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${reason.bg} ${reason.color}`}>
            {reason.label}
          </span>
        </div>

        {/* Task breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-500" /> Collections
          </p>
          <div className="space-y-1 text-gray-600">
            <p><span className="font-medium text-green-600">{shift.collections_completed}</span> completed</p>
            {shift.collections_skipped > 0 && (
              <p><span className="font-medium text-gray-500">{shift.collections_skipped}</span> skipped</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-500" /> Placements
          </p>
          <div className="space-y-1 text-gray-600">
            <p><span className="font-medium text-green-600">{shift.placements_completed}</span> completed</p>
            {shift.placements_skipped > 0 && (
              <p><span className="font-medium text-gray-500">{shift.placements_skipped}</span> skipped</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" /> Move Requests
          </p>
          <div className="space-y-1 text-gray-600">
            <p><span className="font-medium text-green-600">{shift.move_requests_completed}</span> completed</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Incidents
          </p>
          <div className="space-y-1 text-gray-600">
            <p><span className="font-medium text-red-600">{shift.incidents_reported}</span> reported</p>
            {shift.field_observations > 0 && (
              <p><span className="font-medium text-amber-600">{shift.field_observations}</span> observations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShiftHistoryView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: driversData } = useDrivers();
  const drivers = driversData ?? [];

  const { data, isLoading, error } = useShiftHistory({
    driver_id: driverFilter || undefined,
    limit: 100,
  });

  const shifts = data?.shifts ?? [];

  // Client-side search by driver name
  const filtered = searchQuery
    ? shifts.filter(s =>
        s.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shifts;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search driver or shift ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Driver filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white cursor-pointer"
          >
            <option value="">All Drivers</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Summary badge */}
        {data && (
          <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
            <span className="font-semibold text-gray-800">{data.total_count}</span>
            <span>completed shifts</span>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
          Loading shift history...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-500 gap-2">
          <XCircle className="w-5 h-5" />
          Failed to load shift history
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Clock className="w-12 h-12 text-gray-200" />
          <p className="text-sm">No completed shifts found</p>
          {(searchQuery || driverFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setDriverFilter(''); }}
              className="text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_80px_1fr_60px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Driver / Date</span>
            <span>Duration</span>
            <span className="text-center">Completion</span>
            <span>Tasks</span>
            <span></span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {filtered.map(shift => {
              const isExpanded = expandedId === shift.id;
              const reason = END_REASON_LABEL[shift.end_reason] ?? { label: shift.end_reason, color: 'text-gray-700', bg: 'bg-gray-100' };
              const duration = formatDuration(shift.start_time, shift.end_time, shift.total_pause_seconds);

              return (
                <div key={shift.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                    className="w-full text-left"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_80px_1fr_60px] gap-2 md:gap-4 px-5 py-4 items-center">

                      {/* Driver + Date */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{shift.driver_name || 'Unknown Driver'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(shift.ended_at)}
                          </p>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{duration}</p>
                          <p className="text-xs text-gray-500">{formatTime(shift.start_time)} → {formatTime(shift.end_time)}</p>
                        </div>
                      </div>

                      {/* Completion rate */}
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-bold ${completionColor(shift.completion_rate)}`}>
                          {Math.round(shift.completion_rate)}%
                        </span>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${completionBar(shift.completion_rate)}`}
                            style={{ width: `${Math.min(100, shift.completion_rate)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{shift.completed_bins}/{shift.total_bins}</span>
                      </div>

                      {/* Task chips */}
                      <div className="flex flex-wrap gap-1.5">
                        <StatChip icon={Package} label="collections" value={shift.collections_completed} color="text-blue-600" />
                        <StatChip icon={MapPin} label="placements" value={shift.placements_completed} color="text-orange-500" hide0 />
                        <StatChip icon={ArrowRightLeft} label="moves" value={shift.move_requests_completed} color="text-purple-600" hide0 />
                        {shift.total_skipped > 0 && (
                          <StatChip icon={SkipForward} label="skipped" value={shift.total_skipped} color="text-gray-500" />
                        )}
                        {shift.incidents_reported > 0 && (
                          <StatChip icon={AlertTriangle} label="incidents" value={shift.incidents_reported} color="text-red-500" />
                        )}
                        {shift.warehouse_stops > 0 && (
                          <StatChip icon={Warehouse} label="warehouse" value={shift.warehouse_stops} color="text-teal-600" hide0 />
                        )}
                      </div>

                      {/* Expand toggle */}
                      <div className="flex justify-end items-center gap-2">
                        <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium ${reason.bg} ${reason.color}`}>
                          {reason.label}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && <ExpandedRow shift={shift} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
