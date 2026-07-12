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
  includeNearby: boolean; // "Include nearby matches" toggle
  onIncludeNearbyChange: (b: boolean) => void;
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
  includeNearby,
  onIncludeNearbyChange,
  onGenerate,
  loading,
  error,
}: AiRecommendPanelProps) {
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
            Describe an area and let the recommender propose and score spots.
          </p>
        </div>
      </div>

      {/* 2. Mode selector — three first-class option cards */}
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

      {/* 3. Count + target area */}
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

      {/* 4. Segmented toggle — strictly inside / include nearby */}
      <div className={cn('flex flex-col gap-1.5 transition-card', !area && 'opacity-60')}>
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
            ? 'Also surfaces spots just outside the area that match its profile.'
            : 'Only spots inside the area boundary.'}
        </p>
      </div>

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
