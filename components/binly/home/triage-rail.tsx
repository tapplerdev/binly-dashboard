'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { dismissRecommendation } from '@/lib/api/ai-recommendations';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Truck,
  Sparkles,
  Route,
  MapPinOff,
  Plus,
  X,
} from 'lucide-react';
import type { MoveRequest } from '@/lib/types/bin';
import type { Shift } from '@/lib/types/shift';
import type { HomeData } from './use-home-data';

interface TriageRailProps {
  data: HomeData;
  onBinSelect: (binId: string) => void;
  onAssignMove: (move: MoveRequest) => void;
}

/**
 * The work queue docked beside the map hero: today's plan on top, then the
 * three triage sections (critical fill / moves / decisions). Every row
 * executes or deep-links; the map shows WHERE, this rail shows WHAT.
 */
export function TriageRail({ data, onBinSelect, onAssignMove }: TriageRailProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <PlanBlock data={data} />
        <CriticalSection data={data} onBinSelect={onBinSelect} />
        <MovesSection data={data} onAssignMove={onAssignMove} />
        <DecisionsSection data={data} />
      </div>
    </Card>
  );
}

// ── Today's plan / live progress ───────────────────────────────────────────

function PlanBlock({ data }: { data: HomeData }) {
  const { todaysShifts, activeShiftCount, plannedBins, collectedBins } = data.derived;

  if (data.shifts.isLoading) {
    return <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />;
  }

  if (todaysShifts.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
        <p className="text-sm text-gray-500 mb-2">No shifts today</p>
        <Link
          href="/operations/shifts"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" /> Build a shift
        </Link>
      </div>
    );
  }

  const pct = plannedBins > 0 ? Math.min(100, (collectedBins / plannedBins) * 100) : 0;

  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-gray-900">
            {activeShiftCount > 0 ? 'Live' : "Today's plan"}
          </span>
          {activeShiftCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <Link
          href="/operations/shifts"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Manage →
        </Link>
      </div>

      {activeShiftCount > 0 ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-600 shrink-0">
            {collectedBins}/{plannedBins} bins
          </span>
        </div>
      ) : (
        <ul className="space-y-1">
          {todaysShifts.map((s: Shift) => (
            <li key={s.id} className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700 truncate">{s.driverName}</span>
              <span className="text-gray-500 shrink-0">
                {s.status === 'completed' ? 'done' : `${s.binCount} stops · ready`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Section shell ──────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between mb-2">
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

function SectionEmpty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-3 text-center">{text}</p>;
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

// ── Critical fill ──────────────────────────────────────────────────────────

function CriticalSection({
  data,
  onBinSelect,
}: {
  data: HomeData;
  onBinSelect: (binId: string) => void;
}) {
  const router = useRouter();
  const bins = (data.priorities.data?.priorities ?? [])
    .filter((b) => b.urgency === 'critical' || b.urgency === 'high')
    .slice(0, 5);

  return (
    <div>
      <SectionHeader
        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
        title="Critical fill"
        action={{ label: 'Plan route', onClick: () => router.push('/operations/shifts') }}
      />
      {data.priorities.isLoading ? (
        <SectionSkeleton />
      ) : data.priorities.isError ? (
        <SectionEmpty text="Couldn't load priorities." />
      ) : bins.length === 0 ? (
        <SectionEmpty text="No bins estimated near full." />
      ) : (
        <ul className="space-y-1.5">
          {bins.map((bin) => (
            <li key={bin.id}>
              <button
                onClick={() => onBinSelect(bin.id)}
                className="w-full text-left p-2 rounded-xl hover:bg-gray-50 transition-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    #{bin.bin_number} · {bin.current_street}
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
                <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      bin.estimated_current_fill >= 90 ? 'bg-red-500' : 'bg-orange-400'
                    )}
                    style={{ width: `${Math.min(100, bin.estimated_current_fill)}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Moves ──────────────────────────────────────────────────────────────────

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

function MovesSection({
  data,
  onAssignMove,
}: {
  data: HomeData;
  onAssignMove: (move: MoveRequest) => void;
}) {
  const router = useRouter();
  const { overdueMoves, dueTodayMoves, openMoves } = data.derived;

  const seen = new Set<string>();
  const queue: { move: MoveRequest; tag: 'overdue' | 'today' | 'open' }[] = [];
  for (const m of overdueMoves) {
    seen.add(m.id);
    queue.push({ move: m, tag: 'overdue' });
  }
  for (const m of dueTodayMoves) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      queue.push({ move: m, tag: 'today' });
    }
  }
  for (const m of openMoves) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      queue.push({ move: m, tag: 'open' });
    }
  }
  const visible = queue.slice(0, 5);

  return (
    <div>
      <SectionHeader
        icon={<Truck className="w-4 h-4 text-blue-500" />}
        title={`Moves${openMoves.length > 0 ? ` (${openMoves.length})` : ''}`}
        action={{ label: 'All', onClick: () => router.push('/administration/inventory') }}
      />
      {data.moves.isLoading ? (
        <SectionSkeleton />
      ) : data.moves.isError ? (
        <SectionEmpty text="Couldn't load moves." />
      ) : visible.length === 0 ? (
        <SectionEmpty text="No open move requests." />
      ) : (
        <ul className="space-y-1.5">
          {visible.map(({ move, tag }) => (
            <li key={move.id} className="p-2 rounded-xl hover:bg-gray-50 transition-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  #{move.bin_number} · {move.move_type.replace('_', ' ')}
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
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 truncate">
                  {move.status === 'pending'
                    ? move.current_street
                    : move.assigned_driver_name || move.driver_name || move.current_street}
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

// ── Decisions (AI recs + missing bins) ─────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

function DecisionsSection({ data }: { data: HomeData }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { missingCount, pendingRecCount } = data.derived;
  const recs = (data.recommendations.data?.recommendations ?? []).slice(0, 3);

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
    },
  });

  return (
    <div>
      <SectionHeader
        icon={<Sparkles className="w-4 h-4 text-violet-500" />}
        title={`Decisions${pendingRecCount > 0 ? ` (${pendingRecCount})` : ''}`}
        action={{
          label: 'Review',
          onClick: () => router.push('/intelligence/recommendations'),
        }}
      />
      {missingCount > 0 && (
        <button
          onClick={() => router.push('/administration/inventory')}
          className="w-full flex items-center gap-2 p-2 mb-1.5 rounded-xl bg-red-50 hover:bg-red-100 transition-card text-left"
        >
          <MapPinOff className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-sm font-medium text-red-700">
            {missingCount} bin{missingCount === 1 ? '' : 's'} marked missing
          </span>
        </button>
      )}
      {data.recommendations.isLoading ? (
        <SectionSkeleton />
      ) : data.recommendations.isError ? (
        <SectionEmpty text="Couldn't load recommendations." />
      ) : recs.length === 0 && missingCount === 0 ? (
        <SectionEmpty text="Nothing waiting on you." />
      ) : (
        <ul className="space-y-1.5">
          {recs.map((rec) => (
            <li key={rec.id} className="p-2 rounded-xl hover:bg-gray-50 transition-card">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    SEVERITY_DOT[rec.severity] || SEVERITY_DOT.low
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{rec.title}</p>
                  <div className="mt-0.5 flex items-center gap-3">
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
