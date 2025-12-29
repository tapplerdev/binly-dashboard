import { LiveMapView } from '@/components/binly/live-map-view';

export const metadata = {
  title: 'Live Map - Binly Dashboard',
  description: 'Real-time bin tracking and fleet management',
};

export default function LiveMapPage() {
  return <LiveMapView />;
}
