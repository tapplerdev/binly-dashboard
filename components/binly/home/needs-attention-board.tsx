'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { dismissRecommendation } from '@/lib/api/ai-recommendations';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Truck,
  Sparkles,
  ChevronRight,
  MapPinOff,
  X,
} from 'lucide-react';
import type { MoveRequest } from '@/lib/types/bin';
import type { HomeData } from './use-home-data';

interface NeedsAttentionBoardProps {
  data: HomeData;
  /** Open the bin details drawer for a bin id (page owns the drawer). */
  onBinSelect: (binId: string) => void;
  /** Open the assign-to-shift modal for one move (page owns the modal). */
  onAssignMove: (move: MoveRequest) => void;
}

/**
 * Slot 2 — the workhorse: three triage columns (critical fill, moves,
 * decisions). Every row either executes or deep-links; nothing here is
 * decoration.
 */
export function NeedsAttentionBoard({
  data,
  onBinSelect,
  onAssignMove,
}: NeedsAttentionBoardProps) {
  const { overdueMoves, dueTodayMoves, openMoves, missingCount } = data.derived;
  const priorityBins = (data.priorities.data?.priorities ?? [])
    .filter((b) => b.urgency === 'critical' || b.urgency === 'high')
    .slice(0, 5);
  const pendingRecs = (data.recommendations.data?.recommendations ?? []).slice(0, 3);

  // Moves column: overdue first, then due today, then the rest of the open
  // backlog — capped so the column stays a queue, not an archive.
  const seen = new Set<string>();
  const movesQueue: { move: MoveRequest; tag: 'overdue' | 'today' | 'open' }[] = [];
  for (const m of overdueMoves) {
    seen.add(m.id);
    movesQueue.push({ move: m, tag: 'overdue' });
  }
  for (const m of dueTodayMoves) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      movesQueue.push({ move: m, tag: 'today' });
    }
  }
  for (const m of openMoves) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      movesQueue.push({ move: m, tag: 'open' });
    }
  }
  const visibleMoves = movesQueue.slice(0, 6);

  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Needs attention</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:divide-x md:divide-gray-100">
        <CriticalBinsColumn data={data} bins={priorityBins} onBinSelect={onBinSelect} />
        <div className="md:pl-5">
          <MovesColumn moves={visibleMoves} totalOpen={openMoves.length} onAssignMove={onAssignMove} />
        </div>
        <div className="md:pl-5">
          <DecisionsColumn data={data} recs={pendingRecs} missingCount={missingCount} />
        </div>
      </div>
    </Card>
  );
}

// ── Column 1: critical fill ────────────────────────────────────────────────

function CriticalBinsColumn({
  data,
  bins,
  onBinSelect,
}: {
  data: HomeData;
  bins: NonNullable<HomeData['priorities']['data']>['priorities'];
  onBinSelect: (binId: string) => void;
}) {
  const router = useRouter();

  return (
    <div>
      <ColumnHeader
        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
        title="Critical fill"
        action={{ label: 'Plan route', onClick: () => router.push('/operations/shifts') }}
      />
      {data.priorities.isLoading ? (
        <ColumnSkeleton />
      ) : bins.length === 0 ? (
        <ColumnEmpty text="No bins estimated near full." />
      ) : (
        <ul className="space-y-2">
          {bins.map((bin) => (
            <li key={bin.id}>
              <button
                onClick={() => onBinSelect(bin.id)}
                className="w-full text-left p-2.5 rounded-xl hover:bg-gray-50 transition-card group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    Bin #{bin.bin_number} · {bin.current_street}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold shrink-0',
                      bin.estimated_current_fill >= 90 ? 'text-red-600' : 'text-orange-600'
                    )}
                  >
                    ~{Math.round(bin.estimated_current_fill)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      bin.estimated_current_fill >= 90 ? 'bg-red-500' : 'bg-orange-400'
                    )}
                    style={{ width: `${Math.min(100, bin.estimated_current_fill)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  checked {bin.days_since_check}d ago
                  <ChevronRight className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Column 2: moves ────────────────────────────────────────────────────────

const MOVE_TAG_STYLES: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  today: 'bg-orange-100 text-orange-700',
  open: 'bg-gray-100 text-gray-600',
};

function moveTagLabel(tag: 'overdue' | 'today' | 'open', move: MoveRequest): string {
  if (tag === 'overdue') {
    const days = Math.floor((Date.now() / 1000 - move.scheduled_date) / (24 * 60 * 60));
    return days < 1 ? 'Overdue' : `Overdue ${days}d`;
  }
  if (tag === 'today') return 'Due today';
  if (move.status === 'in_progress') return 'In progress';
  return move.status === 'pending' ? 'Unassigned' : 'Assigned';
}

function MovesColumn({
  moves,
  totalOpen,
  onAssignMove,
}: {
  moves: { move: MoveRequest; tag: 'overdue' | 'today' | 'open' }[];
  totalOpen: number;
  onAssignMove: (move: MoveRequest) => void;
}) {
  const router = useRouter();

  return (
    <div>
      <ColumnHeader
        icon={<Truck className="w-4 h-4 text-blue-500" />}
        title={`Moves${totalOpen > 0 ? ` (${totalOpen} open)` : ''}`}
        action={{ label: 'View all', onClick: () => router.push('/administration/inventory') }}
      />
      {moves.length === 0 ? (
        <ColumnEmpty text="No open move requests." />
      ) : (
        <ul className="space-y-2">
          {moves.map(({ move, tag }) => (
            <li
              key={move.id}
              className="p-2.5 rounded-xl hover:bg-gray-50 transition-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  Bin #{move.bin_number} · {move.move_type.replace('_', ' ')}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                    MOVE_TAG_STYLES[tag]
                  )}
                >
                  {moveTagLabel(tag, move)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 truncate">
                  {move.status === 'pending'
                    ? move.current_street
                    : (move.assigned_driver_name || move.driver_name || move.current_street)}
                </p>
                {move.status === 'pending' && (
                  <button
                    onClick={() => onAssignMove(move)}
                    className="text-xs font-medium text-primary hover:text-primary/80 shrink-0 transition-colors"
                  >
                    Assign →
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Column 3: alerts & decisions ───────────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

function DecisionsColumn({
  data,
  recs,
  missingCount,
}: {
  data: HomeData;
  recs: NonNullable<HomeData['recommendations']['data']>['recommendations'];
  missingCount: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
    },
  });

  return (
    <div>
      <ColumnHeader
        icon={<Sparkles className="w-4 h-4 text-violet-500" />}
        title="Alerts & decisions"
        action={{
          label: 'Review all',
          onClick: () => router.push('/intelligence/recommendations'),
        }}
      />
      {missingCount > 0 && (
        <button
          onClick={() => router.push('/administration/inventory')}
          className="w-full flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-red-50 hover:bg-red-100 transition-card text-left"
        >
          <MapPinOff className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-sm font-medium text-red-700">
            {missingCount} bin{missingCount === 1 ? '' : 's'} marked missing
          </span>
        </button>
      )}
      {data.recommendations.isLoading ? (
        <ColumnSkeleton />
      ) : recs.length === 0 && missingCount === 0 ? (
        <ColumnEmpty text="Nothing waiting on you." />
      ) : (
        <ul className="space-y-2">
          {recs.map((rec) => (
            <li key={rec.id} className="p-2.5 rounded-xl hover:bg-gray-50 transition-card">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    SEVERITY_DOT[rec.severity] || SEVERITY_DOT.low
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {rec.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      onClick={() => router.push('/intelligence/recommendations')}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Open →
                    </button>
                    <button
                      onClick={() => dismiss.mutate(rec.id)}
                      disabled={dismiss.isPending}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" /> Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function ColumnHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}

function ColumnEmpty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-6 text-center">{text}</p>;
}

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}
