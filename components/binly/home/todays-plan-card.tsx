'use client';

import Link from 'next/link';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Card } from '@/components/ui/card';
import {
  BinMarkersLayer,
  WarehouseMarkerLayer,
} from '@/components/binly/map-layers';
import { cn } from '@/lib/utils';
import { Route, Plus, MapPin } from 'lucide-react';
import type { Shift } from '@/lib/types/shift';
import type { ActiveDriver } from '@/lib/types/active-driver';
import type { HomeData } from './use-home-data';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

const STATUS_PILL: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Ready',
  active: 'Active',
  completed: 'Ended',
  cancelled: 'Cancelled',
};

function formatEta(shift: Shift): string | null {
  const iso = shift.optimization_metadata?.estimated_completion || shift.estimatedCompletion;
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Slot 3 — today's plan-vs-actual. Shows every shift on today's plan
 * (ready/active/ended), not just running ones, so the card is honest at 7am.
 * When something is actually running it promotes into a compact live block
 * with driver positions.
 */
export function TodaysPlanCard({ data }: { data: HomeData }) {
  const { todaysShifts, activeShiftCount } = data.derived;
  const drivers: ActiveDriver[] = data.activeDrivers.drivers ?? [];
  const driversByShift = new globalThis.Map<string, ActiveDriver>(
    drivers.map((d) => [d.shiftId, d])
  );
  const liveDrivers = drivers.filter(
    (d) => (d.status === 'active' || d.status === 'paused') && d.currentLocation
  );

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-gray-900">Today&apos;s plan</h2>
          {activeShiftCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              live
            </span>
          )}
        </div>
        <Link
          href="/operations/shifts"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Manage shifts →
        </Link>
      </div>

      {data.shifts.isLoading ? (
        <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
      ) : todaysShifts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No shifts planned today.</p>
          <Link
            href="/operations/shifts"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-card"
          >
            <Plus className="w-4 h-4" /> Build a shift
          </Link>
        </div>
      ) : (
        <div className={cn('grid gap-4', liveDrivers.length > 0 && 'lg:grid-cols-2')}>
          <ul className="space-y-2.5">
            {todaysShifts.map((shift) => {
              const driver = driversByShift.get(shift.id);
              const eta = formatEta(shift);
              const collected = shift.binsCollected ?? driver?.completedBins ?? 0;
              const total = shift.binCount || driver?.totalBins || 0;
              const pct = total > 0 ? Math.min(100, (collected / total) * 100) : 0;

              return (
                <li key={shift.id} className="p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {shift.driverName}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                        STATUS_PILL[shift.status] || STATUS_PILL.scheduled
                      )}
                    >
                      {STATUS_LABEL[shift.status] || shift.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 shrink-0">
                      {collected}/{total} bins
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {shift.status === 'scheduled' && 'Ready to start'}
                    {shift.status === 'active' && (eta ? `ETA ${eta}` : 'In progress')}
                    {shift.status === 'completed' && 'Completed'}
                  </p>
                </li>
              );
            })}
          </ul>

          {liveDrivers.length > 0 && (
            <div className="relative h-56 lg:h-auto lg:min-h-[220px] rounded-xl overflow-hidden border border-gray-100">
              <Map
                mapId="binly-home-live"
                defaultCenter={
                  liveDrivers[0].currentLocation
                    ? {
                        lat: liveDrivers[0].currentLocation.latitude,
                        lng: liveDrivers[0].currentLocation.longitude,
                      }
                    : DEFAULT_CENTER
                }
                defaultZoom={12}
                gestureHandling="cooperative"
                disableDefaultUI={true}
                style={{ width: '100%', height: '100%' }}
              >
                <BinMarkersLayer size="sm" showLabels={false} />
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
              </Map>
              <Link
                href="/operations/live-map"
                className="absolute bottom-3 right-3 z-10 bg-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-card flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" /> Live Map
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
