'use client';

import { useState } from 'react';
import { BinAnalyticsDashboard } from '@/components/binly/bin-analytics-dashboard';
import { NetworkHealthView } from '@/components/binly/network-health-view';
import { Activity, LayoutDashboard } from 'lucide-react';

/**
 * Analytics is organized by DECISION, not data type:
 *  - Network Health — "is the machine OK this month?" (trends, exec glance)
 *  - Operations     — "what needs collecting now?" (the original snapshot view)
 * Future tabs slot in here: Bin Performance (phase 2), Growth (phase 4).
 */
const TABS = [
  { key: 'health', label: 'Network Health', icon: Activity },
  { key: 'operations', label: 'Operations', icon: LayoutDashboard },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AnalyticsTabs() {
  const [tab, setTab] = useState<TabKey>('health');

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'health' && <NetworkHealthView />}
      {tab === 'operations' && <BinAnalyticsDashboard />}
    </div>
  );
}
