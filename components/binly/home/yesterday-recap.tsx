'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { History } from 'lucide-react';
import type { HomeData } from './use-home-data';

/**
 * Slot 4 — one slim row of yesterday's results. Numbers, not charts:
 * analysis lives in Intelligence, this is just "anything to follow up?".
 */
export function YesterdayRecap({ data }: { data: HomeData }) {
  const entries = data.yesterdayHistory.data?.shifts ?? [];

  const totals = entries.reduce(
    (acc, s) => ({
      total: acc.total + (s.total_bins || 0),
      completed: acc.completed + (s.completed_bins || 0),
      skipped: acc.skipped + (s.total_skipped || 0),
      incidents: acc.incidents + (s.incidents_reported || 0),
      moves: acc.moves + (s.move_requests_completed || 0),
    }),
    { total: 0, completed: 0, skipped: 0, incidents: 0, moves: 0 }
  );

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Yesterday</h2>
        </div>
        <Link
          href="/operations/shifts"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Review →
        </Link>
      </div>

      {data.yesterdayHistory.isLoading ? (
        <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No shifts ran yesterday.</p>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <RecapStat label="shifts" value={String(entries.length)} />
          <RecapStat label="bins collected" value={`${totals.completed}/${totals.total}`} />
          {totals.skipped > 0 && (
            <RecapStat label="skipped" value={String(totals.skipped)} tone="warn" />
          )}
          {totals.incidents > 0 && (
            <RecapStat label="incidents" value={String(totals.incidents)} tone="warn" />
          )}
          {totals.moves > 0 && <RecapStat label="moves done" value={String(totals.moves)} />}
        </div>
      )}
    </Card>
  );
}

function RecapStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-lg font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
