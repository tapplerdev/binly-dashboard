'use client';

import { Award, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Driver {
  id: string;
  name: string;
  binsCollected: number;
  onTimePercentage: number;
  rank: number;
}

export function TopDriversCard() {
  // Sample data - in production this would come from API
  const topDrivers: Driver[] = [
    {
      id: '1',
      name: 'Omar Hassan',
      binsCollected: 156,
      onTimePercentage: 98,
      rank: 1,
    },
    {
      id: '2',
      name: 'Ariel Rodriguez',
      binsCollected: 148,
      onTimePercentage: 96,
      rank: 2,
    },
    {
      id: '3',
      name: 'Sarah Chen',
      binsCollected: 142,
      onTimePercentage: 95,
      rank: 3,
    },
  ];

  const getRankIcon = (rank: number) => {
    const icons = ['🥇', '🥈', '🥉'];
    return icons[rank - 1] || `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-600 bg-yellow-50';
      case 2:
        return 'text-gray-600 bg-gray-100';
      case 3:
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-900">Top Drivers</h3>
        </div>
        <Badge className="gap-1 bg-primary hover:bg-primary text-[10px] px-1.5 py-0.5">
          This Week
        </Badge>
      </div>

      {/* Drivers List */}
      <div className="p-3 space-y-2">
        {topDrivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {/* Rank */}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0 ${getRankColor(
                driver.rank
              )}`}
            >
              {getRankIcon(driver.rank)}
            </div>

            {/* Driver Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {driver.name}
              </p>
              <p className="text-xs text-gray-500">
                {driver.binsCollected} bins collected
              </p>
            </div>

            {/* Performance Badge */}
            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold">{driver.onTimePercentage}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <button className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          View full leaderboard →
        </button>
      </div>
    </div>
  );
}
