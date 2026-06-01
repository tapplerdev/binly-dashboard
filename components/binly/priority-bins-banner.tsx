'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Sparkles, MapPin } from 'lucide-react';
import { useDailyPriorities } from '@/lib/hooks/use-daily-priorities';
import { PriorityBin } from '@/lib/api/daily-priorities';

interface PriorityBinsBannerProps {
  onCreateShiftFromBins?: (binIds: string[]) => void;
}

const urgencyConfig = {
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
  high:     { label: 'High',     color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  medium:   { label: 'Medium',   color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  low:      { label: 'Low',      color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};

function FillBar({ fill }: { fill: number }) {
  const color = fill >= 80 ? 'bg-red-500' : fill >= 60 ? 'bg-amber-500' : fill >= 40 ? 'bg-blue-500' : 'bg-gray-300';
  return (
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(fill, 100)}%` }} />
    </div>
  );
}

export function PriorityBinsBanner({ onCreateShiftFromBins }: PriorityBinsBannerProps) {
  const { data, isLoading } = useDailyPriorities();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState<string | null>(null);

  if (isLoading || !data) return null;

  const { summary, priorities } = data;
  const actionableCount = summary.critical + summary.high;

  if (actionableCount === 0) return null;

  const filteredBins = selectedUrgency
    ? priorities.filter(b => b.urgency === selectedUrgency)
    : priorities.filter(b => b.urgency === 'critical' || b.urgency === 'high');

  // Group by city
  const byCity: Record<string, PriorityBin[]> = {};
  filteredBins.forEach(bin => {
    const city = bin.city || 'Unknown';
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(bin);
  });

  const handleCreateShift = () => {
    const binIds = priorities
      .filter(b => b.urgency === 'critical' || b.urgency === 'high')
      .map(b => b.id);
    onCreateShiftFromBins?.(binIds);
  };

  return (
    <div className="mx-4 md:mx-6 mb-3">
      <div className="bg-gradient-to-r from-amber-50 to-red-50 border border-amber-200 rounded-xl overflow-hidden">
        {/* Summary bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-gray-800">Priority Collection</span>
            </div>
            <div className="flex items-center gap-2">
              {summary.critical > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {summary.critical} critical
                </span>
              )}
              {summary.high > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {summary.high} high
                </span>
              )}
              {summary.medium > 0 && (
                <span className="text-xs text-gray-500">{summary.medium} medium</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && onCreateShiftFromBins && (
              <span
                onClick={(e) => { e.stopPropagation(); handleCreateShift(); }}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline cursor-pointer"
              >
                Create Shift
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {/* Expanded bin list */}
        {isExpanded && (
          <div className="border-t border-amber-200 bg-white">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100">
              {(['critical', 'high', 'medium'] as const).map(u => {
                const count = summary[u];
                if (count === 0) return null;
                const cfg = urgencyConfig[u];
                const isActive = selectedUrgency === u || (!selectedUrgency && (u === 'critical' || u === 'high'));
                return (
                  <button key={u} onClick={() => setSelectedUrgency(selectedUrgency === u ? null : u)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${isActive ? `${cfg.bg} ${cfg.color}` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    {cfg.label} ({count})
                  </button>
                );
              })}
              <div className="flex-1" />
              {onCreateShiftFromBins && (
                <button onClick={handleCreateShift}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
                  <AlertTriangle className="w-3 h-3" />
                  Create Shift from Priority Bins
                </button>
              )}
            </div>

            {/* Bin list grouped by city */}
            <div className="max-h-[300px] overflow-y-auto">
              {Object.entries(byCity).sort(([,a], [,b]) => b.length - a.length).map(([city, bins]) => (
                <div key={city}>
                  <div className="px-4 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                    {city} ({bins.length})
                  </div>
                  {bins.map(bin => {
                    const cfg = urgencyConfig[bin.urgency];
                    return (
                      <div key={bin.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 border-b border-gray-50">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="flex items-center gap-1.5 min-w-[60px]">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-800">#{bin.bin_number}</span>
                        </div>
                        <span className="text-xs text-gray-500 truncate flex-1">{bin.current_street}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <FillBar fill={bin.estimated_current_fill} />
                          <span className="text-xs font-medium text-gray-700 w-8 text-right">{bin.estimated_current_fill}%</span>
                        </div>
                        <span className="text-[10px] text-gray-400 w-16 text-right shrink-0">
                          {bin.days_since_check < 1 ? 'today' : `${bin.days_since_check}d ago`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
