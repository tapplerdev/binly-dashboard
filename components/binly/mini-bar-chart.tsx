'use client';

/**
 * Mini bar chart for showing progress or capacity
 * Simpler than Recharts, uses pure CSS for better performance
 */
interface MiniBarChartProps {
  filled: number;
  total: number;
  color?: string;
  height?: string;
}

export function MiniBarChart({
  filled,
  total,
  color = '#4880FF',
  height = 'h-2',
}: MiniBarChartProps) {
  const percentage = Math.min((filled / total) * 100, 100);

  return (
    <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/**
 * Segmented bar chart for showing multiple categories
 */
interface SegmentedBarChartProps {
  segments: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  height?: string;
}

export function SegmentedBarChart({ segments, height = 'h-2' }: SegmentedBarChartProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);

  return (
    <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden flex`}>
      {segments.map((segment, index) => {
        const percentage = (segment.value / total) * 100;
        return (
          <div
            key={index}
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: segment.color,
            }}
            title={segment.label}
          />
        );
      })}
    </div>
  );
}
