'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Map as MapIcon, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { isMappableBin, getBinMarkerColor } from '@/lib/types/bin';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 10;

interface TacticalMapProps {
  className?: string;
}

export function TacticalMap({ className }: TacticalMapProps) {
  const [fillLevelsEnabled, setFillLevelsEnabled] = useState(true);
  const [noGoZonesEnabled, setNoGoZonesEnabled] = useState(false);

  // Use React Query for data fetching and caching
  const { data: bins = [], isLoading: loading } = useBins();

  // Memoize filtered bins to prevent unnecessary recalculations
  const mappableBins = useMemo(() => bins.filter(isMappableBin), [bins]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Map Container */}
      <div className="relative h-[400px] bg-gray-100">
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
            gestureHandling="greedy"
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
          >
            {fillLevelsEnabled &&
              mappableBins.map((bin) => (
                <AdvancedMarker
                  key={bin.id}
                  position={{ lat: bin.latitude, lng: bin.longitude }}
                  zIndex={10}
                >
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-300 animate-scale-in"
                    style={{
                      backgroundColor: getBinMarkerColor(bin.fill_percentage),
                    }}
                    title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
                  >
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                      {bin.bin_number}
                    </div>
                  </div>
                </AdvancedMarker>
              ))}
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
