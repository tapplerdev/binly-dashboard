'use client';

import { Radio } from 'lucide-react';
import { useAirtagTracking } from '@/lib/auth/use-airtag-tracking';

/**
 * Renders its children only for an organization with AirTag tracking
 * (useAirtagTracking). The nav already hides the way in; this covers a direct
 * link or bookmark, and keeps the page from asking the backend for data it will
 * refuse with a 404.
 */
export function AirtagTrackingGate({ children }: { children: React.ReactNode }) {
  const airtagTracking = useAirtagTracking();
  if (airtagTracking) return <>{children}</>;
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <Radio className="h-10 w-10 text-gray-300" />
      <p className="text-sm text-gray-600">AirTag tracking isn&apos;t enabled for this organization.</p>
    </div>
  );
}
