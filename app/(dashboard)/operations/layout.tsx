'use client';

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
      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
