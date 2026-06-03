'use client';

import { useState, useMemo } from 'react';
import { useShiftHistory } from '@/lib/hooks/use-shift-history';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { ShiftHistoryEntry } from '@/lib/api/shifts';
import { ShiftHistoryDetailDrawer } from './shift-history-detail-drawer';
import {
  Clock, Package, MapPin, Truck, SkipForward, AlertTriangle,
  CheckCircle2, XCircle, User, Calendar, Search, Filter,
  ArrowUpDown, ChevronDown, Download, ArrowRightLeft, Warehouse,
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

function getDurationSeconds(s: ShiftHistoryEntry): number {
  if (!s.start_time || !s.end_time) return 0;
  return s.end_time - s.start_time - s.total_pause_seconds;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const END_REASON_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  completed:             { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  manual_end:            { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  manager_ended:         { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  manager_cancelled:     { label: 'Cancelled', color: 'text-red-700',   bg: 'bg-red-100' },
  driver_disconnected:   { label: 'Disconnected', color: 'text-amber-700', bg: 'bg-amber-100' },
  system_timeout:        { label: 'Timed Out', color: 'text-amber-700', bg: 'bg-amber-100' },
  auto_ended_inactive:   { label: 'Auto-Ended', color: 'text-amber-700', bg: 'bg-amber-100' },
};

function completionBar(rate: number): string {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function completionColor(rate: number): string {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 60) return 'text-amber-600';
  return 'text-red-500';
}

type SortKey = 'date' | 'duration' | 'completion' | 'tasks' | 'distance';

// ── Main Component ────────────────────────────────────────────────────────────

export function ShiftHistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('completed');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'short' | 'normal' | 'long'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftHistoryEntry | null>(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const { data: driversData } = useDrivers();
  const drivers = driversData ?? [];

  const { data, isLoading, error } = useShiftHistory({ limit: 500 });
  const shifts = data?.shifts ?? [];

  // Apply all filters
  const filtered = useMemo(() => {
    let result = shifts;

    // Status filter
    if (statusFilter === 'completed') {
      result = result.filter(s => s.end_reason !== 'manager_cancelled');
    } else if (statusFilter === 'cancelled') {
      result = result.filter(s => s.end_reason === 'manager_cancelled');
    }

    // Driver filter
    if (driverFilter) {
      result = result.filter(s => s.driver_id === driverFilter);
    }

    // Completion filter
    if (completionFilter === 'high') result = result.filter(s => s.completion_rate >= 90);
    else if (completionFilter === 'medium') result = result.filter(s => s.completion_rate >= 60 && s.completion_rate < 90);
    else if (completionFilter === 'low') result = result.filter(s => s.completion_rate < 60);

    // Duration filter
    if (durationFilter === 'short') result = result.filter(s => getDurationSeconds(s) < 3600 * 2);
    else if (durationFilter === 'normal') result = result.filter(s => getDurationSeconds(s) >= 3600 * 2 && getDurationSeconds(s) < 3600 * 8);
    else if (durationFilter === 'long') result = result.filter(s => getDurationSeconds(s) >= 3600 * 8);

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.driver_name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.optimization_metadata?.total_distance_miles?.toString() || '').includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.ended_at - b.ended_at; break;
        case 'duration': cmp = getDurationSeconds(a) - getDurationSeconds(b); break;
        case 'completion': cmp = a.completion_rate - b.completion_rate; break;
        case 'tasks': cmp = a.total_bins - b.total_bins; break;
        case 'distance': cmp = (a.optimization_metadata?.total_distance_miles ?? 0) - (b.optimization_metadata?.total_distance_miles ?? 0); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [shifts, statusFilter, driverFilter, completionFilter, durationFilter, searchQuery, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Driver', 'Duration', 'Completion %', 'Tasks', 'Completed', 'Skipped', 'Distance (mi)', 'Status'];
    const rows = filtered.map(s => [
      formatDate(s.ended_at),
      s.driver_name,
      formatDuration(s.start_time, s.end_time, s.total_pause_seconds),
      Math.round(s.completion_rate),
      s.total_bins,
      s.completed_bins,
      s.total_skipped,
      s.optimization_metadata?.total_distance_miles?.toFixed(1) ?? '',
      END_REASON_LABEL[s.end_reason]?.label ?? s.end_reason,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `shift-history-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const selectedDriverName = drivers.find(d => d.id === driverFilter)?.name;

  return (
    <div className="flex flex-col h-full">

      {/* Filters Row 1: Search + Driver + Export */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search driver, shift ID..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
        </div>

        {/* Driver dropdown */}
        <div className="relative">
          <button onClick={() => setShowDriverDropdown(!showDriverDropdown)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 min-w-[140px]">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-700">{selectedDriverName || 'All Drivers'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          </button>
          {showDriverDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20 max-h-[250px] overflow-y-auto animate-dropdown-in">
              <button onClick={() => { setDriverFilter(''); setShowDriverDropdown(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!driverFilter ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                All Drivers
              </button>
              {drivers.map(d => (
                <button key={d.id} onClick={() => { setDriverFilter(d.id); setShowDriverDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${driverFilter === d.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary + Export */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500"><span className="font-semibold text-gray-800">{filtered.length}</span> of {data?.total_count ?? 0} shifts</span>
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Filters Row 2: Status toggle + Filter dropdown */}
      <div className="flex items-center gap-2 mb-4">
        {/* Status toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'completed', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === s ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === 'all' ? 'All' : s === 'completed' ? 'Completed' : 'Cancelled'}
            </button>
          ))}
        </div>

        {/* Unified filter dropdown */}
        <div className="relative">
          <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
              (completionFilter !== 'all' || durationFilter !== 'all')
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}>
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(completionFilter !== 'all' || durationFilter !== 'all') && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center">
                {(completionFilter !== 'all' ? 1 : 0) + (durationFilter !== 'all' ? 1 : 0)}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden animate-dropdown-in">
              {/* Completion rate */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Completion Rate</div>
                {([['all', 'Any rate'], ['high', '90%+ (Great)'], ['medium', '60-90% (OK)'], ['low', 'Under 60% (Low)']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setCompletionFilter(v as any)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${completionFilter === v ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Duration */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Shift Duration</div>
                {([['all', 'Any duration'], ['short', 'Under 2 hours'], ['normal', '2 - 8 hours'], ['long', 'Over 8 hours']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setDurationFilter(v as any)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${durationFilter === v ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Reset */}
              {(completionFilter !== 'all' || durationFilter !== 'all') && (
                <div className="px-3 py-2">
                  <button onClick={() => { setCompletionFilter('all'); setDurationFilter('all'); }}
                    className="w-full text-center text-xs text-red-600 hover:text-red-700 font-medium py-1">
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Close filter dropdown on click outside */}
      {showFilterDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
          Loading shift history...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-500 gap-2">
          <XCircle className="w-5 h-5" /> Failed to load shift history
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Clock className="w-12 h-12 text-gray-200" />
          <p className="text-sm">No shifts found</p>
          <button onClick={() => { setSearchQuery(''); setDriverFilter(''); setStatusFilter('completed'); setCompletionFilter('all'); setDurationFilter('all'); }}
            className="text-xs text-blue-600 hover:underline">Reset filters</button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 shadow-sm flex flex-col">
          {/* Sortable header */}
          <div className="grid grid-cols-[1.2fr_0.8fr_80px_1fr_0.7fr_70px] gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide shrink-0">
            <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-gray-700">
              Driver / Date <ArrowUpDown className="w-3 h-3" />
            </button>
            <button onClick={() => handleSort('duration')} className="flex items-center gap-1 hover:text-gray-700">
              Duration <ArrowUpDown className="w-3 h-3" />
            </button>
            <button onClick={() => handleSort('completion')} className="flex items-center gap-1 hover:text-gray-700">
              Rate <ArrowUpDown className="w-3 h-3" />
            </button>
            <button onClick={() => handleSort('tasks')} className="flex items-center gap-1 hover:text-gray-700">
              Tasks <ArrowUpDown className="w-3 h-3" />
            </button>
            <button onClick={() => handleSort('distance')} className="flex items-center gap-1 hover:text-gray-700">
              Distance <ArrowUpDown className="w-3 h-3" />
            </button>
            <span>Status</span>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.map(shift => {
              const reason = END_REASON_LABEL[shift.end_reason] ?? { label: shift.end_reason, color: 'text-gray-700', bg: 'bg-gray-100' };
              const duration = formatDuration(shift.start_time, shift.end_time, shift.total_pause_seconds);
              const distance = shift.optimization_metadata?.total_distance_miles;

              return (
                <button key={shift.id} onClick={() => setSelectedShift(shift)}
                  className="w-full text-left grid grid-cols-[1.2fr_0.8fr_80px_1fr_0.7fr_70px] gap-3 px-5 py-3 items-center hover:bg-gray-50/80 transition-colors">
                  {/* Driver + Date */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-600">
                      {(shift.driver_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{shift.driver_name || 'Unknown'}</p>
                      <p className="text-[11px] text-gray-400">{formatDate(shift.ended_at)}</p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{duration}</p>
                    <p className="text-[11px] text-gray-400">{formatTime(shift.start_time)} → {formatTime(shift.end_time)}</p>
                  </div>

                  {/* Completion */}
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-sm font-bold ${completionColor(shift.completion_rate)}`}>{Math.round(shift.completion_rate)}%</span>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${completionBar(shift.completion_rate)}`}
                        style={{ width: `${Math.min(100, shift.completion_rate)}%` }} />
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm"><span className="font-semibold text-gray-900">{shift.completed_bins}</span><span className="text-gray-400">/{shift.total_bins}</span></span>
                    {shift.total_skipped > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><SkipForward className="w-3 h-3" />{shift.total_skipped}</span>
                    )}
                    {shift.incidents_reported > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-500"><AlertTriangle className="w-3 h-3" />{shift.incidents_reported}</span>
                    )}
                  </div>

                  {/* Distance */}
                  <div className="text-sm text-gray-600">
                    {distance ? `${distance.toFixed(1)} mi` : '—'}
                  </div>

                  {/* Status */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${reason.bg} ${reason.color}`}>
                    {reason.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedShift && (
        <ShiftHistoryDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}

      {/* Close driver dropdown on click outside */}
      {showDriverDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setShowDriverDropdown(false)} />
      )}
    </div>
  );
}
