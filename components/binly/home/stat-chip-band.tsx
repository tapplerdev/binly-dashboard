'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  TrendingUp,
  Truck,
  Clock,
  Route,
} from 'lucide-react';
import type { HomeData } from './use-home-data';
import type { HomeMapFilter } from './use-home-data';

interface StatChipBandProps {
  data: HomeData;
  activeFilter: HomeMapFilter;
  onFilterChange: (filter: HomeMapFilter) => void;
}

/**
 * The stat band docked above the map hero. Every count is a MAP FILTER —
 * click "critical" and the map dims everything except exactly those dots,
 * so every number on this page is self-verifying (the Verizon Reveal /
 * Onfleet quick-stats pattern). Counts of exceptions, never totals.
 */
export function StatChipBand({ data, activeFilter, onFilterChange }: StatChipBandProps) {
  const {
    criticalCount,
    projectedCount,
    overdueMoves,
    staleCheckCount,
    todaysShifts,
    activeShiftCount,
    plannedBins,
    collectedBins,
  } = data.derived;

  const toggle = (f: Exclude<HomeMapFilter, null>) =>
    onFilterChange(activeFilter === f ? null : f);

  const chipValue = (loading: boolean, error: boolean, n: number) =>
    error ? '—' : loading ? '…' : String(n);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChip
        icon={<AlertTriangle className="w-3.5 h-3.5" />}
        label="Critical now"
        value={chipValue(data.priorities.isLoading, data.priorities.isError, criticalCount)}
        tone="red"
        active={activeFilter === 'critical'}
        onClick={() => toggle('critical')}
      />
      <FilterChip
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        label="Filling ≤48h"
        value={chipValue(data.priorities.isLoading, data.priorities.isError, projectedCount)}
        tone="amber"
        active={activeFilter === 'projected'}
        onClick={() => toggle('projected')}
      />
      <FilterChip
        icon={<Truck className="w-3.5 h-3.5" />}
        label="Overdue moves"
        value={chipValue(data.moves.isLoading, data.moves.isError, overdueMoves.length)}
        tone="blue"
        active={activeFilter === 'overdue-moves'}
        onClick={() => toggle('overdue-moves')}
      />
      <FilterChip
        icon={<Clock className="w-3.5 h-3.5" />}
        label="Stale checks"
        value={chipValue(
          data.binsWithPriority.isLoading,
          data.binsWithPriority.isError,
          staleCheckCount
        )}
        tone="gray"
        active={activeFilter === 'stale'}
        onClick={() => toggle('stale')}
      />

      {/* Today chip — execution state, links to shifts rather than filtering */}
      <Link
        href="/operations/shifts"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm hover:bg-gray-50 transition-card"
      >
        <Route className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold text-gray-900">
          {data.shifts.isLoading
            ? '…'
            : activeShiftCount > 0
              ? `${collectedBins}/${plannedBins}`
              : todaysShifts.length > 0
                ? `${todaysShifts.length} ready`
                : 'No shifts'}
        </span>
        <span className="text-gray-500">
          {activeShiftCount > 0 ? 'collected today' : 'today'}
        </span>
      </Link>

      {data.exceptionsError && (
        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
          some data failed to load
        </span>
      )}

      {/* Fill-color legend, inline at the band's end */}
      <div className="ml-auto hidden lg:flex items-center gap-3 text-[11px] text-gray-500">
        <LegendDot color="#10B981" label="OK" />
        <LegendDot color="#F59E0B" label="Filling" />
        <LegendDot color="#EF4444" label="Full" />
        <LegendDot color="#6B7280" label="Missing" />
      </div>
    </div>
  );
}

const CHIP_TONES: Record<string, { active: string; dot: string }> = {
  red: { active: 'bg-red-50 border-red-300 ring-1 ring-red-300', dot: 'text-red-600' },
  amber: { active: 'bg-amber-50 border-amber-300 ring-1 ring-amber-300', dot: 'text-amber-600' },
  blue: { active: 'bg-blue-50 border-blue-300 ring-1 ring-blue-300', dot: 'text-blue-600' },
  gray: { active: 'bg-gray-100 border-gray-300 ring-1 ring-gray-300', dot: 'text-gray-600' },
};

function FilterChip({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof CHIP_TONES;
  active: boolean;
  onClick: () => void;
}) {
  const t = CHIP_TONES[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-card',
        active ? t.active : 'border-gray-200 bg-white hover:bg-gray-50'
      )}
      title={active ? 'Click to clear the map filter' : 'Click to show only these bins on the map'}
    >
      <span className={t.dot}>{icon}</span>
      <span className="font-semibold text-gray-900">{value}</span>
      <span className="text-gray-500">{label}</span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="w-2.5 h-2.5 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
