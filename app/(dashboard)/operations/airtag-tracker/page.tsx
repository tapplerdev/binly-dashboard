import { AirTagMapView } from '@/components/binly/airtag-map-view';

export const metadata = {
  title: 'AirTag Tracker - Binly Dashboard',
  description: 'Real-time AirTag location tracking for bins via Apple FindMy network',
};

export default function AirTagTrackerPage() {
  return <AirTagMapView />;
}
