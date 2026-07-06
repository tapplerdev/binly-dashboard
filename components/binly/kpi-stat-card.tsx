'use client';

import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * The shared KPI card idiom for analytics surfaces: tinted icon square,
 * big number, and a good/bad-aware delta row. Extracted from the Network
 * Health tab (the design review picked it as the house pattern).
 */
export function KpiStatCard({
  label,
  value,
  delta,
  deltaGoodWhen,
  icon,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  delta: number | null; // percent change vs the prior window
  deltaGoodWhen: 'up' | 'down';
  icon: React.ReactNode;
  hint: string;
  onClick?: () => void;
}) {
  const direction = delta == null || Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'up' : 'down';
  const isGood = direction === 'flat' ? null : direction === deltaGoodWhen;
  const deltaColor = isGood == null ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500';
  const DeltaIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer hover:bg-gray-50 transition-fast' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${deltaColor}`}>
        <DeltaIcon className="w-3.5 h-3.5" />
        <span>{delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}</span>
        <span className="text-gray-400 font-normal">{hint}</span>
      </div>
    </Card>
  );
}
