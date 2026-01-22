'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Map, Route, Calendar, AlertCircle } from 'lucide-react';

interface Tab {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    label: 'Live Map',
    path: '/operations/live-map',
    icon: <Map className="w-4 h-4" />,
  },
  {
    label: 'Routes',
    path: '/operations/routes',
    icon: <Route className="w-4 h-4" />,
  },
  {
    label: 'Shifts',
    path: '/operations/shifts',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    label: 'Issues & Alerts',
    path: '/operations/issues',
    icon: <AlertCircle className="w-4 h-4" />,
  },
];

export function OperationsNavTabs() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 px-1 min-w-max">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-200 whitespace-nowrap shrink-0
                ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
