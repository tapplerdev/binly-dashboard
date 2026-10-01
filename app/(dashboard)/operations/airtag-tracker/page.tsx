import { AirTagMapView } from '@/components/binly/airtag-map-view';
import { AirtagTrackingGate } from '@/components/binly/airtag-tracking-gate';

export const metadata = {
  title: 'AirTag Tracker - Binly Dashboard',
  description: 'Real-time AirTag location tracking for bins via Apple FindMy network',
};

export default function AirTagTrackerPage() {
  return (
    <AirtagTrackingGate>
      <AirTagMapView />
    </AirtagTrackingGate>
  );
}
