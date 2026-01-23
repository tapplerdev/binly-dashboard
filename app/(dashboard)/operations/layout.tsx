'use client';

import { OperationsNavTabs } from '@/components/binly/operations-nav-tabs';
import { usePathname } from 'next/navigation';

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLiveMap = pathname === '/operations/live-map';

  // For live-map, the nav is integrated in the map view component
  // For other pages, show nav at the top
  if (isLiveMap) {
    return <>{children}</>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation Tabs - Sticky at top for non-map pages, hidden on mobile (use hamburger menu instead) */}
      <div className="hidden lg:block sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3">
        <OperationsNavTabs />
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
