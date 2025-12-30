'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MiniTrendChartProps {
  data: number[];
  color?: string;
  className?: string;
}

/**
 * Mini sparkline chart for showing trends in KPI cards
 * Takes an array of numbers and renders a smooth area chart
 */
export function MiniTrendChart({ data, color = '#4880FF', className = '' }: MiniTrendChartProps) {
  // Convert array of numbers to Recharts data format
  const chartData = data.map((value, index) => ({
    value,
    index,
  }));

  return (
    <div className={`w-full h-12 min-h-[48px] ${className}`}>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color})`}
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
