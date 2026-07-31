'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Card } from '@/components/ui/card';
import {
  BinMarkersLayer,
  WarehouseMarkerLayer,
  ZoneMarkersLayer,
  RecenterOnWarehouse,
} from '@/components/binly/map-layers';
import { useBins } from '@/lib/hooks/use-bins';
import { isMappableBin } from '@/lib/types/bin';
import { Map as MapIcon } from 'lucide-react';
import type { MoveRequest } from '@/lib/types/bin';
import type { ActiveDriver } from '@/lib/types/active-driver';
import type { HomeData, HomeMapFilter } from './use-home-data';
import { TriageRail } from './triage-rail';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

interface MapHeroProps {
  data: HomeData;
  activeFilter: HomeMapFilter;
  onBinSelect: (binId: string) => void;
  onAssignMove: (move: MoveRequest) => void;
}

/**
 * The map IS the home page: ~65vh bin-status canvas (fill-colored dots are
 * alive 24/7 — only the driver layer sleeps), with the triage rail docked
 * beside it. The hero stays below full viewport height so the next section
 * peeks and the page never scroll-traps.
 */
export function MapHero({ data, activeFilter, onBinSelect, onAssignMove }: MapHeroProps) {
  const [zonesEnabled, setZonesEnabled] = useState(true);

  const highlightIds =
    activeFilter === 'critical'
      ? data.derived.criticalBinIds
      : activeFilter === 'projected'
        ? data.derived.projectedBinIds
        : activeFilter === 'overdue-moves'
          ? data.derived.overdueMoveBinIds
          : activeFilter === 'stale'
            ? data.derived.staleBinIds
            : null;

  const drivers: ActiveDriver[] = data.activeDrivers.drivers ?? [];
  const liveDrivers = drivers.filter(
    (d) => (d.status === 'active' || d.status === 'paused') && d.currentLocation
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
      <Card className="relative overflow-hidden flex-1 h-[65vh] min-h-[560px]">
        <Map
          mapId="binly-home-hero"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={10}
          minZoom={3}
          maxZoom={20}
          gestureHandling="cooperative"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
        >
          {zonesEnabled && <ZoneMarkersLayer />}
          <BinMarkersLayer
            size="md"
            showLabels={true}
            onBinClick={onBinSelect}
            highlightBinIds={highlightIds}
          />
          <WarehouseMarkerLayer />
          {liveDrivers.map(
            (d) =>
              d.currentLocation && (
                <AdvancedMarker
                  key={d.driverId}
                  position={{
                    lat: d.currentLocation.latitude,
                    lng: d.currentLocation.longitude,
                  }}
                  zIndex={100}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[11px] font-bold border-2 border-white shadow-lg">
                    {d.driverName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                </AdvancedMarker>
              )
          )}
          <AutoFit highlightIds={highlightIds} />
          {/* Opens on this organization's warehouse, not a hardcoded city. */}
          <RecenterOnWarehouse />
        </Map>

        {/* Live badge */}
        {liveDrivers.length > 0 && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {liveDrivers.length} driver{liveDrivers.length === 1 ? '' : 's'} live
          </div>
        )}

        {/* Layer toggle — top right */}
        <div className="absolute top-4 right-4 z-10 bg-white rounded-2xl px-3 py-2 shadow-lg">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={zonesEnabled}
              onChange={(e) => setZonesEnabled(e.target.checked)}
              className="accent-red-600"
            />
            No-Go Zones
          </label>
        </div>

        {/* Full experience link — bottom right */}
        <Link
          href="/operations/live-map"
          className="absolute bottom-4 right-4 z-10 bg-white px-4 py-2 rounded-2xl shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-card flex items-center gap-2"
        >
          <MapIcon className="w-4 h-4" />
          Live Map
        </Link>
      </Card>

      <div className="w-full lg:w-[360px] shrink-0 h-auto lg:h-[65vh] lg:min-h-[560px]">
        <TriageRail data={data} onBinSelect={onBinSelect} onAssignMove={onAssignMove} />
      </div>
    </div>
  );
}

/**
 * Fits the map to the network on first load, and re-fits to the filtered
 * subset whenever a stat chip is toggled. Deliberately does NOT re-fit on
 * routine data refetches — that would fight the user's panning.
 */
function AutoFit({ highlightIds }: { highlightIds: Set<string> | null }) {
  const map = useMap();
  const { data: bins } = useBins();
  const didInitialFit = useRef(false);
  const lastFilter = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!map || !bins || bins.length === 0) return;

    // Fit exactly twice per intent: once when the network first loads, and
    // once whenever the chip filter changes — never on routine refetches,
    // which would fight the user's panning.
    const filterChanged = lastFilter.current !== highlightIds;
    if (didInitialFit.current && !filterChanged) return;

    const targets = bins
      .filter(isMappableBin)
      .filter((b) => b.status === 'active' || b.status === 'pending_move')
      .filter((b) => !highlightIds || highlightIds.has(b.id));
    if (targets.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    targets.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }));
    map.fitBounds(bounds, { top: 60, bottom: 40, left: 60, right: 60 });
    didInitialFit.current = true;
    lastFilter.current = highlightIds;
  }, [map, highlightIds, bins]);

  return null;
}
