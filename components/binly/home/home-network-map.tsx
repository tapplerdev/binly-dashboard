'use client';

import Link from 'next/link';
import { Map } from '@vis.gl/react-google-maps';
import { Card } from '@/components/ui/card';
import {
  BinMarkersLayer,
  WarehouseMarkerLayer,
  ZoneMarkersLayer,
} from '@/components/binly/map-layers';
import { Map as MapIcon } from 'lucide-react';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

/**
 * Slot 5a — compact ambient network map, below the fold. Bins are clickable
 * into the details drawer (progressive disclosure); the full experience
 * lives on the live map page.
 */
export function HomeNetworkMap({ onBinClick }: { onBinClick: (binId: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-[380px]">
        <Map
          mapId="binly-home-network"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={10}
          gestureHandling="cooperative"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
        >
          <BinMarkersLayer size="md" showLabels={false} onBinClick={onBinClick} />
          <ZoneMarkersLayer />
          <WarehouseMarkerLayer />
        </Map>
        <Link
          href="/operations/live-map"
          className="absolute bottom-4 right-4 z-10 bg-white px-4 py-2 rounded-2xl shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-card flex items-center gap-2"
        >
          <MapIcon className="w-4 h-4" />
          Open Live Map
        </Link>
      </div>
    </Card>
  );
}
