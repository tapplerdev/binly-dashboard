'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Map } from 'lucide-react';
import { useState } from 'react';

interface TacticalMapProps {
  className?: string;
}

export function TacticalMap({ className }: TacticalMapProps) {
  const [harvestEnabled, setHarvestEnabled] = useState(true);
  const [battlefieldEnabled, setBattlefieldEnabled] = useState(false);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Map Container */}
      <div className="relative h-[400px] bg-gray-100">
        {/* Placeholder for actual map integration */}
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Map className="w-16 h-16 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Map Integration Placeholder</p>
            <p className="text-xs mt-1">
              Integrate with Mapbox, Google Maps, or similar
            </p>
          </div>
        </div>

        {/* Map Controls - Top Right */}
        <div className="absolute top-4 right-4 bg-white rounded-lg p-3 shadow-lg space-y-2">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={harvestEnabled}
                onChange={(e) => setHarvestEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Harvest</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={battlefieldEnabled}
                onChange={(e) => setBattlefieldEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Battlefield</span>
          </div>
        </div>

        {/* Go to Live Map Button */}
        <div className="absolute bottom-4 right-4">
          <button className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Map className="w-4 h-4" />
            Go to Live Map
          </button>
        </div>
      </div>
    </Card>
  );
}
