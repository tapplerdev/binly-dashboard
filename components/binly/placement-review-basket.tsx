'use client';

/**
 * PlacementReviewBasket — the shared "review basket" for the Create Potential
 * Location modal. Manually-entered AND AI-recommended locations pool together
 * here for one final review before submit.
 *
 * Pure presentational: everything comes from props. No fetching, no global
 * state. Items are grouped by source + locality and rendered as a scannable,
 * curatable list with source, score, and "why" surfaced at a glance.
 */

import {
  ArrowUpRight,
  Check,
  MapPin,
  PackageCheck,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';

import type { QueuedLocation } from '@/lib/types/placement';
import { cn } from '@/lib/utils';

export interface PlacementReviewBasketProps {
  items: QueuedLocation[];
  onRemove: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  /** e.g. "Brentwood" — used in group headers when present. */
  areaLabel?: string;
}

/** Score → chip color. >=7 green, >=5 amber, else gray. */
function scoreChipClasses(score: number): string {
  if (score >= 7) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (score >= 5) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
}

/** Format a score with a single decimal (e.g. 7.9), collapsing 8.0 → 8. */
function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

interface AddressLineProps {
  item: QueuedLocation;
}

function AddressLine({ item }: AddressLineProps) {
  return (
    <p className="text-sm leading-snug text-gray-900">
      <span className="font-semibold">{item.street}</span>
      {(item.city || item.zip) && (
        <span className="text-gray-400">
          {' · '}
          {[item.city, item.zip].filter(Boolean).join(', ')}
        </span>
      )}
    </p>
  );
}

type GroupTone = 'green' | 'violet' | 'neutral';

const GROUP_TONE_STYLES: Record<
  GroupTone,
  { row: string; iconWrap: string; icon: string }
> = {
  green: {
    row: 'border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-700',
  },
  violet: {
    row: 'border-violet-100 bg-violet-50/40 hover:bg-violet-50',
    iconWrap: 'bg-violet-100 text-violet-700',
    icon: 'text-violet-700',
  },
  neutral: {
    row: 'border-gray-100 bg-gray-50/60 hover:bg-[#EDF0FF]',
    iconWrap: 'bg-gray-100 text-gray-500',
    icon: 'text-gray-500',
  },
};

interface BasketRowProps {
  item: QueuedLocation;
  tone: GroupTone;
  onRemove: (id: string) => void;
}

function BasketRow({ item, tone, onRemove }: BasketRowProps) {
  const styles = GROUP_TONE_STYLES[tone];
  const isAi = item.source === 'ai';
  const isNearArea = isAi && item.locality === 'near_area';

  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-3 transition-card',
        styles.row
      )}
    >
      {/* Source indicator */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          styles.iconWrap
        )}
      >
        {isAi ? (
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Pencil className="h-4 w-4" strokeWidth={2} />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <AddressLine item={item} />

          {isAi && typeof item.score === 'number' && (
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                scoreChipClasses(item.score)
              )}
              title="AI placement score"
            >
              {formatScore(item.score)}
            </span>
          )}
        </div>

        {isAi && item.reasoning && (
          <p className="mt-1 text-xs leading-snug text-gray-500">{item.reasoning}</p>
        )}

        {isNearArea && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {typeof item.distanceFromAreaMi === 'number' && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                {item.distanceFromAreaMi.toFixed(1)} mi past edge
              </span>
            )}
            {typeof item.areaMatch === 'number' && (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600 ring-1 ring-violet-100">
                profile match {Math.round(item.areaMatch * 100)}%
              </span>
            )}
          </div>
        )}

        {item.notes && (
          <p className="mt-1 truncate text-[11px] italic text-gray-400">{item.notes}</p>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Remove location"
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-card',
          'hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200'
        )}
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </li>
  );
}

interface GroupSectionProps {
  title: string;
  helper?: string;
  count: number;
  tone: GroupTone;
  headerIcon: React.ReactNode;
  items: QueuedLocation[];
  onRemove: (id: string) => void;
}

function GroupSection({
  title,
  helper,
  count,
  tone,
  headerIcon,
  items,
  onRemove,
}: GroupSectionProps) {
  if (items.length === 0) return null;

  const styles = GROUP_TONE_STYLES[tone];

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('flex items-center justify-center', styles.icon)}>
          {headerIcon}
        </span>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500">
          {count}
        </span>
      </div>
      {helper && <p className="-mt-1 mb-2 pl-6 text-[11px] text-gray-400">{helper}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <BasketRow key={item.id} item={item} tone={tone} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  );
}

export function PlacementReviewBasket({
  items,
  onRemove,
  onSubmit,
  submitting,
  areaLabel,
}: PlacementReviewBasketProps) {
  const areaName = areaLabel && areaLabel.trim().length > 0 ? areaLabel : 'the area';

  const inArea = items.filter((i) => i.source === 'ai' && i.locality === 'in_area');
  const nearArea = items.filter((i) => i.source === 'ai' && i.locality === 'near_area');
  const manual = items.filter((i) => i.source === 'manual');

  const count = items.length;
  const isEmpty = count === 0;
  const label = `Create ${count} location${count === 1 ? '' : 's'}`;

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white card-shadow">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" strokeWidth={2} />
          <h3 className="text-base font-semibold text-gray-900">Review &amp; submit</h3>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            isEmpty ? 'bg-gray-100 text-gray-400' : 'bg-primary/10 text-primary'
          )}
        >
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <MapPin className="h-6 w-6 text-gray-400" strokeWidth={2} />
            </div>
            <p className="text-sm font-medium text-gray-600">Nothing queued yet</p>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Add a location manually or generate AI recommendations.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <GroupSection
              title={`In ${areaName}`}
              count={inArea.length}
              tone="green"
              headerIcon={
                <span className="flex items-center">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </span>
              }
              items={inArea}
              onRemove={onRemove}
            />

            <GroupSection
              title={`Near ${areaName} — matches its profile`}
              helper="just outside the boundary but a strong profile match"
              count={nearArea.length}
              tone="violet"
              headerIcon={<ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />}
              items={nearArea}
              onRemove={onRemove}
            />

            <GroupSection
              title="Manual"
              count={manual.length}
              tone="neutral"
              headerIcon={<Pencil className="h-4 w-4" strokeWidth={2.5} />}
              items={manual}
              onRemove={onRemove}
            />
          </div>
        )}
      </div>

      {/* Submit bar */}
      <div className="border-t border-gray-100 p-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isEmpty || submitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-card',
            'bg-primary text-white hover:bg-primary/90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            'disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400'
          )}
        >
          {submitting ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              Creating…
            </>
          ) : (
            <>
              <PackageCheck className="h-4 w-4" strokeWidth={2} />
              {label}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
