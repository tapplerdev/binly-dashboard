'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import { X, Clock, Route as RouteIcon, MapPin, Warehouse, Info } from 'lucide-react';
import { useModalClose } from './modal-wrapper';
import { ZoneMarkersLayer } from './map-layers';
import { RoutePreviewPolyline, LatLng } from './preview-polyline';
import {
  ShiftRoutePreview,
  PreviewStop,
  PreviewStopType,
  physicalStopCount,
} from '@/lib/types/route-preview';

const STOP_STYLES: Record<PreviewStopType, { color: string; label: string }> = {
  collection: { color: '#4880FF', label: 'Collect' },
  placement: { color: '#22C55E', label: 'Place' },
  pickup: { color: '#F59E0B', label: 'Pickup' },
  dropoff: { color: '#8B5CF6', label: 'Dropoff' },
  service: { color: '#64748B', label: 'Service' },
  warehouse_stop: { color: '#0F172A', label: 'Warehouse' },
};

function stopTitle(stop: PreviewStop): string {
  switch (stop.type) {
    case 'collection':
      return stop.bin_number != null ? `Collect Bin #${stop.bin_number}` : 'Collect';
    case 'placement':
      // Placements are proposed locations with no bin number assigned yet
      // (new_bin_number is 0), so lead with the action, not "#0".
      return stop.new_bin_number ? `Place Bin #${stop.new_bin_number}` : 'Place new bin';
    case 'pickup':
      return stop.bin_number != null ? `Pick up Bin #${stop.bin_number}` : 'Pick up';
    case 'dropoff':
      return stop.bin_number != null ? `Drop off Bin #${stop.bin_number}` : 'Drop off';
    case 'service':
      return stop.label || 'Service stop';
    case 'warehouse_stop':
      return 'Warehouse stop';
    default:
      return 'Stop';
  }
}

// A placement run reloads at the warehouse for every bin, so the raw stop list is
// a wall of identical "warehouse" rows. Collapse consecutive warehouse loads into a
// single "Load N bins" row, mark the final one as the return, and number only the
// real destinations (1..N) — both for the rail and the map markers.
type RailRow =
  | { key: string; kind: 'load'; count: number; address: string }
  | { key: string; kind: 'return'; address: string }
  | { key: string; kind: 'work'; stop: PreviewStop; visit: number };

function buildRail(stops: PreviewStop[]): {
  rows: RailRow[];
  workStops: { stop: PreviewStop; visit: number }[];
} {
  const rows: RailRow[] = [];
  const workStops: { stop: PreviewStop; visit: number }[] = [];
  // The route always ends back at the warehouse; treat a trailing warehouse stop
  // as the return rather than a load.
  const returnIdx =
    stops.length > 0 && stops[stops.length - 1].type === 'warehouse_stop'
      ? stops.length - 1
      : -1;
  let visit = 0;
  let i = 0;
  while (i < stops.length) {
    if (i === returnIdx) {
      rows.push({ key: `ret-${i}`, kind: 'return', address: stops[i].address });
      i++;
      continue;
    }
    if (stops[i].type === 'warehouse_stop') {
      const startIdx = i;
      const address = stops[i].address;
      let count = 0;
      while (i < stops.length && i !== returnIdx && stops[i].type === 'warehouse_stop') {
        count++;
        i++;
      }
      rows.push({ key: `load-${startIdx}`, kind: 'load', count, address });
    } else {
      visit++;
      workStops.push({ stop: stops[i], visit });
      rows.push({ key: `work-${stops[i].sequence_order}`, kind: 'work', stop: stops[i], visit });
      i++;
    }
  }
  return { rows, workStops };
}

/** Fits the map to all preview points once, on mount. */
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds, 64);
  }, [map, points]);
  return null;
}

export function RoutePreviewMapModal({
  preview,
  onClose,
}: {
  preview: ShiftRoutePreview;
  onClose: () => void;
}) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const [roadSnapped, setRoadSnapped] = useState<boolean | null>(null);

  // Ordered path for the polyline: start anchor → every stop (the final stop is the
  // return-to-warehouse). Memoized so the polyline effect doesn't re-run each render.
  const { rows, workStops } = useMemo(() => buildRail(preview.stops), [preview]);

  const path = useMemo<LatLng[]>(() => {
    const raw: LatLng[] = [
      { latitude: preview.start_location.latitude, longitude: preview.start_location.longitude },
      ...preview.stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    ];
    // Collapse consecutive duplicate points (a run of warehouse reloads) so the
    // polyline shows each warehouse visit once, not N overlapping points.
    const out: LatLng[] = [];
    for (const p of raw) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.latitude - p.latitude) < 1e-6 && Math.abs(last.longitude - p.longitude) < 1e-6) {
        continue;
      }
      out.push(p);
    }
    return out;
  }, [preview]);

  const center = useMemo(
    () => ({ lat: preview.warehouse.latitude, lng: preview.warehouse.longitude }),
    [preview]
  );

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Route Preview</h2>
              <p className="text-xs text-gray-500">
                Optimized with {preview.optimizer_used} · as the driver would run it
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-gray-700">
                  <Clock className="w-4 h-4 text-primary" />
                  {preview.total_duration_formatted}
                </span>
                <span className="flex items-center gap-1.5 text-gray-700">
                  <RouteIcon className="w-4 h-4 text-primary" />
                  {preview.total_distance_km.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1.5 text-gray-700">
                  <MapPin className="w-4 h-4 text-primary" />
                  {physicalStopCount(preview.stops)} stops
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Warehouse-start caveat */}
          <div className="flex items-start gap-2 px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Previewed from the warehouse (no live GPS yet). When the driver actually
              starts, the route re-optimizes from their real location, so the first and
              last legs may shift slightly.
            </span>
          </div>

          {/* Body: ordered stop rail + map */}
          <div className="flex flex-1 min-h-0">
            {/* Left rail — ordered stops */}
            <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto">
              {preview.stops.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No stops to route.</p>
              ) : (
                <ol className="divide-y divide-gray-50">
                  {rows.map((row) => {
                    if (row.kind === 'load' || row.kind === 'return') {
                      const title =
                        row.kind === 'return'
                          ? 'Return to warehouse'
                          : `Load ${row.count} ${row.count === 1 ? 'bin' : 'bins'} at warehouse`;
                      return (
                        <li key={row.key} className="flex items-start gap-3 px-4 py-3 bg-slate-50/60">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white shrink-0">
                            <Warehouse className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                            <p className="text-xs text-gray-500 truncate">{row.address}</p>
                          </div>
                        </li>
                      );
                    }
                    const style = STOP_STYLES[row.stop.type];
                    return (
                      <li key={row.key} className="flex items-start gap-3 px-4 py-3">
                        <span
                          className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold shrink-0"
                          style={{ backgroundColor: style.color }}
                        >
                          {row.visit}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {stopTitle(row.stop)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{row.stop.address}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Map */}
            <div className="relative flex-1 min-h-0">
              <APIProvider
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                libraries={['marker']}
              >
                <Map
                  mapId="binly-route-preview"
                  defaultCenter={center}
                  defaultZoom={11}
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ZoneMarkersLayer />

                  {/* Warehouse marker */}
                  <AdvancedMarker position={center}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white shadow-md">
                      <Warehouse className="w-4 h-4" />
                    </div>
                  </AdvancedMarker>

                  {/* Destination markers numbered in visit order. Warehouse loads
                      all sit on the warehouse marker above, so they're not repeated. */}
                  {workStops.map(({ stop, visit }) => {
                    const style = STOP_STYLES[stop.type];
                    return (
                      <AdvancedMarker
                        key={stop.sequence_order}
                        position={{ lat: stop.latitude, lng: stop.longitude }}
                        title={`${visit}. ${stopTitle(stop)}`}
                      >
                        <div
                          className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shadow-md border-2 border-white"
                          style={{ backgroundColor: style.color }}
                        >
                          {visit}
                        </div>
                      </AdvancedMarker>
                    );
                  })}

                  <RoutePreviewPolyline path={path} onGeometryStatus={setRoadSnapped} />
                  <FitBounds points={path} />
                </Map>
              </APIProvider>

              {roadSnapped === false && (
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-white/90 border border-gray-200 text-xs text-gray-600 shadow-sm">
                  Road geometry unavailable — showing direct lines.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
