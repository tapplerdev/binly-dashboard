'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Map as MapIcon, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 10;

interface TacticalMapProps {
  className?: string;
}

export function TacticalMap({ className }: TacticalMapProps) {
  const [fillLevelsEnabled, setFillLevelsEnabled] = useState(true);
  const [noGoZonesEnabled, setNoGoZonesEnabled] = useState(false);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBins() {
      try {
        const data = await getBins();
        setBins(data);
      } catch (error) {
        console.error('Failed to fetch bins:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBins();
  }, []);

  const mappableBins = bins.filter(isMappableBin);

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
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                    style={{
                      backgroundColor: getBinMarkerColor(bin.fill_percentage),
                    }}
                    title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
                  />
                </AdvancedMarker>
              ))}
          </Map>
        )}

        {/* Map Controls - Top Right */}
        <div className="absolute top-4 right-4 bg-white rounded-lg p-3 shadow-lg space-y-2 z-10">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fillLevelsEnabled}
                onChange={(e) => setFillLevelsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Fill Levels</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={noGoZonesEnabled}
                onChange={(e) => setNoGoZonesEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">No-Go Zones</span>
          </div>
        </div>

        {/* Go to Live Map Button */}
        <div className="absolute bottom-4 right-4 z-10">
          <Link
            href="/operations/live-map"
            className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            Go to Live Map
          </Link>
        </div>
      </div>
    </Card>
  );
}
