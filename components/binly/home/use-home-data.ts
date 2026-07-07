'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDailyPriorities } from '@/lib/hooks/use-daily-priorities';
import { useShifts } from '@/lib/hooks/use-shifts';
import { useActiveDrivers } from '@/lib/hooks/use-active-drivers';
import { getMoveRequests } from '@/lib/api/move-requests';
import { getRecommendations } from '@/lib/api/ai-recommendations';
import { getShiftHistory } from '@/lib/api/shifts';
import { getBinsWithPriority } from '@/lib/api/bins';
import type { MoveRequest } from '@/lib/types/bin';
import type { Shift } from '@/lib/types/shift';

const OPEN_MOVE_STATUSES = new Set(['pending', 'assigned', 'in_progress', 'overdue']);

/**
 * The active map filter — each stat chip maps to the exact set of bins it
 * counts, so clicking a number shows precisely those dots.
 */
export type HomeMapFilter =
  | 'critical'
  | 'projected'
  | 'overdue-moves'
  | 'stale'
  | null;

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * One data spine for the home page: every module reads from the same set of
 * queries so the header sentence, exception strip, and triage board can never
 * disagree with each other. React Query dedupes the underlying fetches.
 */
export function useHomeData() {
  const priorities = useDailyPriorities();
  const shifts = useShifts();
  const activeDrivers = useActiveDrivers();

  const moves = useQuery({
    queryKey: ['move-requests', 'home'],
    queryFn: () => getMoveRequests(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const recommendations = useQuery({
    queryKey: ['ai-recommendations', 'home-pending'],
    queryFn: () => getRecommendations('pending'),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // status:'all' so map clicks can resolve any bin into the details drawer
  // (the derived counts filter by status themselves).
  const binsWithPriority = useQuery({
    queryKey: ['bins-with-priority', 'home'],
    queryFn: () => getBinsWithPriority({ status: 'all' }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  // Yesterday's window in unix seconds, local time.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStartUnix = Math.floor(startOfYesterday.getTime() / 1000);
  const todayStartUnix = Math.floor(startOfToday.getTime() / 1000);

  const yesterdayHistory = useQuery({
    queryKey: ['shift-history', 'yesterday', yesterdayStartUnix],
    queryFn: () =>
      getShiftHistory({
        start_date: yesterdayStartUnix,
        end_date: todayStartUnix,
        limit: 50,
      }),
    staleTime: 10 * 60_000,
  });

  const derived = useMemo(() => {
    const today = localDateString(new Date());

    const openMoves: MoveRequest[] = (moves.data ?? []).filter((m) =>
      OPEN_MOVE_STATUSES.has(m.status)
    );
    const overdueMoves = openMoves.filter(
      (m) =>
        m.status === 'overdue' ||
        m.urgency === 'overdue' ||
        (m.scheduled_date > 0 && m.scheduled_date < todayStartUnix)
    );
    const dueTodayMoves = openMoves.filter(
      (m) =>
        !overdueMoves.includes(m) &&
        m.scheduled_date >= todayStartUnix &&
        m.scheduled_date < todayStartUnix + 24 * 60 * 60
    );

    // The drivers endpoint only carries each driver's CURRENT shift, so the
    // plan is: everything running, every ready shift (a ready shift IS the
    // upcoming plan — its `date` derives from updated_at and can't be
    // trusted as a planned date), plus shifts that ended today.
    const todaysShifts: Shift[] = (shifts.data ?? []).filter(
      (s) =>
        s.status === 'active' ||
        s.status === 'scheduled' ||
        (s.status === 'completed' && s.date === today)
    );
    const activeShiftCount = todaysShifts.filter((s) => s.status === 'active').length;
    const plannedBins = todaysShifts.reduce((sum, s) => sum + (s.binCount || 0), 0);
    const collectedBins = todaysShifts.reduce((sum, s) => sum + (s.binsCollected || 0), 0);

    const criticalCount = priorities.data?.summary.critical ?? 0;
    const priorityBins = priorities.data?.priorities ?? [];
    const criticalBinIds = new Set(
      priorityBins.filter((b) => b.urgency === 'critical').map((b) => b.id)
    );

    // Projected critical within ~48h: current estimate plus two days of the
    // bin's own fill velocity crosses the critical line. Both inputs already
    // ship in the daily-priorities payload — this is the forward-looking
    // stat every bin-monitoring product headlines.
    const projectedBins = priorityBins.filter(
      (b) =>
        b.urgency !== 'critical' &&
        b.avg_daily_fill_rate > 0 &&
        b.estimated_current_fill + 2 * b.avg_daily_fill_rate >= 90
    );
    const projectedBinIds = new Set(projectedBins.map((b) => b.id));

    const staleBins = (binsWithPriority.data ?? []).filter(
      (b) => b.status === 'active' && b.has_check_recommendation
    );
    const staleCheckCount = staleBins.length;
    const staleBinIds = new Set(staleBins.map((b) => b.id));
    const overdueMoveBinIds = new Set(overdueMoves.map((m) => m.bin_id));
    const missingCount = (binsWithPriority.data ?? []).filter(
      (b) => b.status === 'missing'
    ).length;
    const pendingRecCount = recommendations.data?.counts.pending ?? 0;

    return {
      openMoves,
      overdueMoves,
      dueTodayMoves,
      todaysShifts,
      activeShiftCount,
      plannedBins,
      collectedBins,
      criticalCount,
      criticalBinIds,
      projectedCount: projectedBins.length,
      projectedBinIds,
      staleCheckCount,
      staleBinIds,
      overdueMoveBinIds,
      missingCount,
      pendingRecCount,
    };
  }, [
    moves.data,
    shifts.data,
    priorities.data,
    binsWithPriority.data,
    recommendations.data,
    todayStartUnix,
  ]);

  // The exception surface must never report "all clear" while its inputs
  // are still loading or after any of them failed — a triage page that
  // can't reach the backend has to say so, not celebrate.
  const exceptionsLoading =
    priorities.isLoading ||
    moves.isLoading ||
    binsWithPriority.isLoading ||
    recommendations.isLoading;
  const exceptionsError =
    priorities.isError ||
    moves.isError ||
    binsWithPriority.isError ||
    recommendations.isError;

  return {
    priorities,
    shifts,
    activeDrivers,
    moves,
    recommendations,
    binsWithPriority,
    yesterdayHistory,
    exceptionsLoading,
    exceptionsError,
    derived,
  };
}

export type HomeData = ReturnType<typeof useHomeData>;
