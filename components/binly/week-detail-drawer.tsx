'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getShiftHistory, ShiftHistoryEntry } from '@/lib/api/shifts';
import { X, Truck, Package, AlertTriangle, Clock } from 'lucide-react';

/**
 * Drill-down for a Network Health week bar: the shifts that ran that week,
 * with the week's headline numbers. Drawer (not modal) per the app's
 * inspection-vs-transaction rule — charts stay visible behind it.
 */
export function WeekDetailDrawer({
  weekStart, // 'YYYY-MM-DD' (Monday)
  collections,
  medianFill,
  incidents,
  onClose,
}: {
  weekStart: string;
  collections: number;
  medianFill: number | null;
  incidents: number;
  onClose: () => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const weekStartTs = Math.floor(new Date(weekStart + 'T00:00:00').getTime() / 1000);
  const weekEndTs = weekStartTs + 7 * 86400;

  const { data, isLoading } = useQuery({
    queryKey: ['week-shifts', weekStart],
    queryFn: () => getShiftHistory({ start_date: weekStartTs, end_date: weekEndTs, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  // Filter defensively client-side in case the endpoint's date filter is loose.
  const shifts: ShiftHistoryEntry[] = (data?.shifts ?? []).filter(
    s => s.ended_at >= weekStartTs && s.ended_at < weekEndTs,
  );

  const weekLabel = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  const fmtDuration = (s: ShiftHistoryEntry) => {
    if (!s.start_time || !s.end_time || s.end_time <= s.start_time) return '—';
    const mins = Math.round((s.end_time - s.start_time) / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 w-full md:max-w-xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900">Week of {weekLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">Everything that happened this week</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-fast focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { icon: <Package className="w-3.5 h-3.5" />, v: String(collections), l: 'collections', tone: 'text-blue-600 bg-blue-50' },
              { icon: <Clock className="w-3.5 h-3.5" />, v: medianFill != null ? `${medianFill.toFixed(0)}%` : '—', l: 'median fill', tone: 'text-green-600 bg-green-50' },
              { icon: <AlertTriangle className="w-3.5 h-3.5" />, v: String(incidents), l: 'incidents', tone: incidents > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50' },
            ].map(s => (
              <div key={s.l} className="rounded-xl border border-gray-100 p-2.5 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>{s.icon}</div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{s.v}</p>
                  <p className="text-[10px] text-gray-400">{s.l}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shift list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Shifts this week ({shifts.length})
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No shifts ran this week.</p>
          ) : (
            <div className="space-y-2">
              {shifts
                .sort((a, b) => b.ended_at - a.ended_at)
                .map(s => (
                  <div key={s.id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-fast">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{s.driver_name}</p>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.end_reason === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : s.end_reason === 'manager_cancelled'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.end_reason.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>
                        {new Date(s.ended_at * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span>{fmtDuration(s)}</span>
                      <span>
                        {s.completed_bins}/{s.total_bins} bins
                      </span>
                      {s.incidents_reported > 0 && (
                        <span className="text-red-500 font-medium">{s.incidents_reported} incident{s.incidents_reported !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
