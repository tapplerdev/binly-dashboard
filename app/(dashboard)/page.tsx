'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useHomeData } from '@/components/binly/home/use-home-data';
import { ExceptionStrip } from '@/components/binly/home/exception-strip';
import { NeedsAttentionBoard } from '@/components/binly/home/needs-attention-board';
import { TodaysPlanCard } from '@/components/binly/home/todays-plan-card';
import { YesterdayRecap } from '@/components/binly/home/yesterday-recap';
import { HomeNetworkMap } from '@/components/binly/home/home-network-map';
import { ActivityFeed } from '@/components/binly/home/activity-feed';
import { BinDetailDrawer } from '@/components/binly/bin-detail-drawer';
import { AssignMovesModal } from '@/components/binly/assign-moves-modal';
import type { MoveRequest } from '@/lib/types/bin';

/**
 * Home — the morning briefing. Answers "what needs my attention right now?"
 * in exception counts and a triage board, promotes into live ops while a
 * shift is running, and pushes analysis/management to the pages that own it.
 */
export default function HomePage() {
  const data = useHomeData();
  const queryClient = useQueryClient();

  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [moveToAssign, setMoveToAssign] = useState<MoveRequest | null>(null);

  const selectedBin =
    selectedBinId != null
      ? (data.binsWithPriority.data ?? []).find((b) => b.id === selectedBinId) ?? null
      : null;

  const { criticalCount, overdueMoves, activeShiftCount, todaysShifts } = data.derived;

  const statusSentence =
    data.exceptionsLoading || data.shifts.isLoading
      ? 'Loading today’s picture…'
      : [
          criticalCount > 0
            ? `${criticalCount} critical bin${criticalCount === 1 ? '' : 's'}`
            : null,
          overdueMoves.length > 0
            ? `${overdueMoves.length} overdue move${overdueMoves.length === 1 ? '' : 's'}`
            : null,
          activeShiftCount > 0
            ? `${activeShiftCount} shift${activeShiftCount === 1 ? '' : 's'} running`
            : todaysShifts.length > 0
              ? `${todaysShifts.length} shift${todaysShifts.length === 1 ? '' : 's'} planned`
              : 'no shifts today',
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-5">
        {/* Slot 0 — header status line */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {new Date().toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{statusSentence}</p>
          </div>
          <Link
            href="/operations/shifts"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-card"
          >
            <Plus className="w-4 h-4" /> Build shift
          </Link>
        </div>

        {/* Slot 1 — exception counts */}
        <ExceptionStrip data={data} />

        {/* Slot 2 — triage board */}
        <NeedsAttentionBoard
          data={data}
          onBinSelect={setSelectedBinId}
          onAssignMove={setMoveToAssign}
        />

        {/* Slots 3 + 4 — today's plan (live-promoting) and yesterday's recap */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
          <div className="xl:col-span-2">
            <TodaysPlanCard data={data} />
          </div>
          <div className="space-y-4 md:space-y-5">
            <YesterdayRecap data={data} />
            <ActivityFeed />
          </div>
        </div>

        {/* Slot 5 — ambient network map */}
        <HomeNetworkMap onBinClick={setSelectedBinId} />
      </div>

      {/* Drawers & modals owned by the page */}
      {selectedBin && (
        <BinDetailDrawer bin={selectedBin} onClose={() => setSelectedBinId(null)} />
      )}
      {moveToAssign && (
        <AssignMovesModal
          moveRequests={[moveToAssign]}
          onClose={() => setMoveToAssign(null)}
          onSuccess={() => {
            setMoveToAssign(null);
            queryClient.invalidateQueries({ queryKey: ['move-requests'] });
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
          }}
        />
      )}
    </div>
  );
}
