'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Map as MapIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Map } from '@vis.gl/react-google-maps';
import { BinMarkersLayer, ZoneMarkersLayer, WarehouseMarkerLayer } from '@/components/binly/map-layers';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 10;

interface TacticalMapProps {
  className?: string;
}

export function TacticalMap({ className }: TacticalMapProps) {
  const [fillLevelsEnabled, setFillLevelsEnabled] = useState(true);
  const [noGoZonesEnabled, setNoGoZonesEnabled] = useState(false);

  const loading = false; // layers handle their own loading

  // Memoize filtered bins to prevent unnecessary recalculations

  return (
    <Card className={cn('overflow-hidden h-full', className)}>
      {/* Map Container */}
      <div className="relative h-full bg-gray-100">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-2 text-primary animate-spin" />
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        ) : (
          <Map
            mapId="binly-tactical-map"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            minZoom={3}
            maxZoom={20}
            gestureHandling="greedy"
            disableDefaultUI={true}
            restriction={{
              latLngBounds: {
                north: 85,
                south: -85,
                west: -180,
                east: 180,
              },
              strictBounds: false,
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Shared layers — same rendering as live map */}
            {noGoZonesEnabled && <ZoneMarkersLayer />}
            {fillLevelsEnabled && <BinMarkersLayer />}
            <WarehouseMarkerLayer />
          </Map>
        )}

        {/* Map Controls - Top Right */}
        <div className="absolute top-4 right-4 bg-white rounded-2xl p-4 shadow-lg space-y-3 z-10">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fillLevelsEnabled}
                onChange={(e) => setFillLevelsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Fill Levels</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={noGoZonesEnabled}
                onChange={(e) => setNoGoZonesEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">No-Go Zones</span>
          </div>
        </div>

        {/* Go to Live Map Button */}
        <div className="absolute bottom-4 right-4 z-10">
          <Link
            href="/operations/live-map"
            className="bg-white px-4 py-2 rounded-2xl shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-card flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            Go to Live Map
          </Link>
        </div>
      </div>
    </Card>
  );
}
