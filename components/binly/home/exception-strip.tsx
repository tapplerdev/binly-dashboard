'use client';

import { useRouter } from 'next/navigation';
import { KpiStatCard } from '@/components/binly/kpi-stat-card';
import { Card } from '@/components/ui/card';
import {
  AlertTriangle,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  Route,
} from 'lucide-react';
import type { HomeData } from './use-home-data';

/**
 * Slot 1 — five exception counts, each a doorway into the page that owns the
 * work. Counts of exceptions, never totals: an all-zero morning renders a
 * deliberate "all clear" banner instead of filler.
 */
export function ExceptionStrip({ data }: { data: HomeData }) {
  const router = useRouter();
  const {
    criticalCount,
    overdueMoves,
    staleCheckCount,
    pendingRecCount,
    todaysShifts,
    plannedBins,
    collectedBins,
  } = data.derived;

  const allClear =
    criticalCount === 0 &&
    overdueMoves.length === 0 &&
    staleCheckCount === 0 &&
    pendingRecCount === 0;

  return (
    <div className="space-y-3">
      {data.exceptionsError && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Some data failed to load — the counts below may be incomplete.
            </p>
          </div>
        </Card>
      )}
      {allClear && !data.exceptionsLoading && !data.exceptionsError && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              All clear — no critical bins, overdue moves, or pending decisions right now.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
        <KpiStatCard
          label="Critical bins"
          value={data.priorities.isError ? '—' : data.priorities.isLoading ? '…' : String(criticalCount)}
          delta={null}
          deltaGoodWhen="down"
          icon={<AlertTriangle className="w-4 h-4" />}
          hint="est. full now"
          onClick={() => router.push('/administration/inventory')}
        />
        <KpiStatCard
          label="Overdue moves"
          value={data.moves.isError ? '—' : data.moves.isLoading ? '…' : String(overdueMoves.length)}
          delta={null}
          deltaGoodWhen="down"
          icon={<Truck className="w-4 h-4" />}
          hint="past scheduled date"
          onClick={() => router.push('/administration/inventory')}
        />
        <KpiStatCard
          label="Today's progress"
          value={
            data.shifts.isLoading
              ? '…'
              : todaysShifts.length === 0
                ? '—'
                : `${collectedBins}/${plannedBins}`
          }
          delta={null}
          deltaGoodWhen="up"
          icon={<Route className="w-4 h-4" />}
          hint={todaysShifts.length === 0 ? 'no shifts today' : 'bins collected'}
          onClick={() => router.push('/operations/shifts')}
        />
        <KpiStatCard
          label="Stale checks"
          value={data.binsWithPriority.isError ? '—' : data.binsWithPriority.isLoading ? '…' : String(staleCheckCount)}
          delta={null}
          deltaGoodWhen="down"
          icon={<Clock className="w-4 h-4" />}
          hint="bins needing a visit"
          onClick={() => router.push('/administration/inventory')}
        />
        <KpiStatCard
          label="Pending decisions"
          value={data.recommendations.isError ? '—' : data.recommendations.isLoading ? '…' : String(pendingRecCount)}
          delta={null}
          deltaGoodWhen="down"
          icon={<Sparkles className="w-4 h-4" />}
          hint="AI recommendations"
          onClick={() => router.push('/intelligence/recommendations')}
        />
      </div>
    </div>
  );
}
