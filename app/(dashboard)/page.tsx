'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useHomeData, HomeMapFilter } from '@/components/binly/home/use-home-data';
import { StatChipBand } from '@/components/binly/home/stat-chip-band';
import { MapHero } from '@/components/binly/home/map-hero';
import { YesterdayRecap } from '@/components/binly/home/yesterday-recap';
import { ActivityFeed } from '@/components/binly/home/activity-feed';
import { BinDetailDrawer } from '@/components/binly/bin-detail-drawer';
import { AssignMovesModal } from '@/components/binly/assign-moves-modal';
import type { MoveRequest } from '@/lib/types/bin';

/**
 * Home — the bin-status map IS the page (the category norm for fill-driven
 * bin operations: the morning ritual is "open the app and see the orange
 * and red dots"). The stat chips above it double as map filters so every
 * count is verifiable as exactly those dots; the triage rail beside it is
 * the work queue. Drivers are an overlay that lights up during shifts.
 */
export default function HomePage() {
  const data = useHomeData();
  const queryClient = useQueryClient();

  const [mapFilter, setMapFilter] = useState<HomeMapFilter>(null);
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
      <div className="max-w-[1600px] mx-auto space-y-3 md:space-y-4">
        {/* Slim header — nothing competes with the map for the fold */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {new Date().toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            <p className="text-sm text-gray-500">{statusSentence}</p>
          </div>
          <Link
            href="/operations/shifts"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-card"
          >
            <Plus className="w-4 h-4" /> Build shift
          </Link>
        </div>

        {/* Stat chips — each one filters the map to exactly the bins it counts */}
        <StatChipBand data={data} activeFilter={mapFilter} onFilterChange={setMapFilter} />

        {/* Map hero + docked triage rail */}
        <MapHero
          data={data}
          activeFilter={mapFilter}
          onBinSelect={setSelectedBinId}
          onAssignMove={setMoveToAssign}
        />

        {/* Below the fold: yesterday's results + ambient activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <YesterdayRecap data={data} />
          <ActivityFeed />
        </div>
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
