'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  Target,
  Compass,
  Layers,
  Loader2,
  Check,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaAutocomplete, type TargetArea } from '@/components/ui/area-autocomplete';

type RecommendMode = 'auto' | 'infill' | 'expand';

export interface AiRecommendPanelProps {
  mode: RecommendMode;
  onModeChange: (m: RecommendMode) => void;
  count: string; // controlled text input value, 1..30
  onCountChange: (c: string) => void;
  area: TargetArea | null;
  onAreaChange: (a: TargetArea | null) => void;
  /** Existing bins inside the picked area (null when no area). Drives the
   *  "this area has N bins" transparency line. */
  areaBinCount: number | null;
  includeNearby: boolean; // "Include nearby matches" toggle
  onIncludeNearbyChange: (b: boolean) => void;
  /** How far from the warehouse an expansion city may sit. Per-search, resets each open. */
  radiusMiles: number;
  onRadiusChange: (miles: number) => void;
  onGenerate: () => void; // parent runs the API call
  loading: boolean;
  error: string; // '' when no error
}

interface ModeOption {
  value: RecommendMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

// Slider ends, mirroring minExpansionRadiusMiles / maxExpansionRadiusMiles in
// the Go handler. Below ~5 mi a search returns the warehouse's own city and
// nothing else; above ~150 the shortlist fills with places no truck will reach
// and every extra mile costs paid API calls. The server clamps to the same band
// regardless of what arrives.
const RADIUS_MIN = 5;
const RADIUS_MAX = 150;

/** Matches expansionRadiusMiles in the Go handler — what a caller gets when the
 *  slider is untouched. Exported so the dialog seeds its state from one place
 *  and the two cannot drift. */
export const DEFAULT_RADIUS_MILES = 75;

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'auto',
    label: 'Smart Mix',
    description:
      'AI picks the best strategy — fills gaps near top performers and explores promising new areas.',
    icon: Layers,
  },
  {
    value: 'infill',
    label: 'Near Existing Bins',
    description: 'Place bins close to your best performers — same corridors, proven demand.',
    icon: Target,
  },
  {
    value: 'expand',
    label: 'New Territory',
    description: 'Find locations in areas where you have no bins yet.',
    icon: Compass,
  },
];

/**
 * Presentational panel for the "AI Recommendations" tab of the placement modal.
 * Owns no state and performs no fetching — the parent controls every value and
 * runs the request via `onGenerate`.
 */
export function AiRecommendPanel({
  mode,
  onModeChange,
  count,
  onCountChange,
  area,
  onAreaChange,
  areaBinCount,
  includeNearby,
  onIncludeNearbyChange,
  radiusMiles,
  onRadiusChange,
  onGenerate,
  loading,
  error,
}: AiRecommendPanelProps) {
  const areaName = area ? area.label.split(',')[0].trim() : '';
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Heading */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">AI Recommendations</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Search your whole network, or target a specific area.
          </p>
        </div>
      </div>

      {/* 2. Scope — count + target area (the primary choice: where to look) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ai-recommend-count" className="text-xs font-medium text-gray-600">
            How many?
          </label>
          <input
            id="ai-recommend-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={count}
            onChange={(e) => onCountChange(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-card focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Target area (optional)</span>
          <div className="flex min-h-[42px] items-center rounded-xl border border-gray-300 bg-white px-3 py-2">
            <AreaAutocomplete value={area} onChange={onAreaChange} />
          </div>
        </div>
      </div>

      {/* 3a. NO area → network-strategy modes (this is where they matter) */}
      {!area && (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium text-gray-600">Strategy across your network</span>
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Recommendation strategy">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onModeChange(option.value)}
                  className={cn(
                    'group relative flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-card cursor-pointer',
                    isActive
                      ? 'border-primary bg-[#EDF0FF] card-shadow'
                      : 'border-gray-200 bg-white hover:border-primary/40 hover:bg-[#EDF0FF]/40 card-shadow-hover'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-card',
                      isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-gray-900')}>
                      {option.label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{option.description}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-card',
                      isActive ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-transparent'
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3a-ii. Search radius — how far from the warehouse to look.
             Shown only when it CHANGES something: with no target area (an
             untargeted sweep) and not in infill mode, which searches around
             existing bins and ignores this entirely. A control that silently
             does nothing is worse than no control. */}
      {!area && mode !== 'infill' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">Search radius</span>
            <span className="text-xs font-semibold tabular-nums text-gray-900">
              {radiusMiles} mi from the warehouse
            </span>
          </div>
          <input
            type="range"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={5}
            value={radiusMiles}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            aria-label="Search radius in miles from the warehouse"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
          />
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>{RADIUS_MIN} mi</span>
            <span>{RADIUS_MAX} mi</span>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-400">
            {radiusMiles <= 30
              ? 'Tight — cities a truck can service and be back the same day.'
              : radiusMiles <= 75
                ? 'Balanced — the usual working range for a metro yard.'
                : 'Wide — expansion territory, with drives to match.'}
          </p>
        </div>
      )}

      {/* 3b. Area picked → transparency line + boundary toggle (modes don't apply
             — the system reads whether the area is covered and adapts). */}
      {area && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-xl bg-[#EDF0FF]/60 px-3.5 py-2.5">
            <MapPin className="mt-px h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-gray-700">
              {areaBinCount != null && areaBinCount > 0 ? (
                <>
                  <span className="font-semibold text-gray-900">{areaName}</span> has {areaBinCount}{' '}
                  {areaBinCount === 1 ? 'bin' : 'bins'} — I&apos;ll find good spots in the gaps between them.
                </>
              ) : (
                <>
                  No bins in <span className="font-semibold text-gray-900">{areaName}</span> yet — I&apos;ll
                  explore it fresh.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="inline-flex w-full rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Area boundary matching">
              <button
                type="button"
                role="tab"
                aria-selected={!includeNearby}
                onClick={() => onIncludeNearbyChange(false)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-card cursor-pointer',
                  !includeNearby ? 'bg-primary text-white card-shadow' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Strictly inside
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={includeNearby}
                onClick={() => onIncludeNearbyChange(true)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-card cursor-pointer',
                  includeNearby ? 'bg-primary text-white card-shadow' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Include nearby matches
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400">
              {includeNearby
                ? `Also surfaces spots just outside ${areaName} that match its profile.`
                : `Only spots inside the ${areaName} boundary.`}
            </p>
          </div>
        </div>
      )}

      {/* 6. Inline error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-700"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* 5. Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-card cursor-pointer',
          'hover:bg-primary/90 card-shadow',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding locations…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate recommendations
          </>
        )}
      </button>
    </div>
  );
}
