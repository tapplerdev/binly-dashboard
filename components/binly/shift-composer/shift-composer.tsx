'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import {
  ZoneMarkersLayer,
  WarehouseMarkerLayer,
} from '@/components/binly/map-layers';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { RouteSelectionMap } from '@/components/binly/route-selection-map';
import { useBins } from '@/lib/hooks/use-bins';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { getBinMarkerColor, isMappableBin } from '@/lib/types/bin';
import type { Bin } from '@/lib/types/bin';
import type { Route } from '@/lib/types/route';
import { cn } from '@/lib/utils';
import {
  X,
  Wand2,
  Loader2,
  Trash2,
  PackagePlus,
  Import,
  MapPin,
  AlertTriangle,
  Clock,
  RouteIcon,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;
    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

interface DeploymentEntry {
  bin_id: string;
  bin_number: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
}

interface PreviewResult {
  optimized_bin_ids: string[];
  total_distance_km: number;
  estimated_duration_hours: number;
  bins: {
    id: string;
    bin_number: number;
    current_street: string;
    latitude: number;
    longitude: number;
    fill_percentage: number;
    sequence_order: number;
  }[];
  warehouse: { latitude: number; longitude: number };
  optimizer_used?: string;
}

interface ShiftComposerProps {
  onClose: () => void;
  /** Fall back to the classic form drawer (time windows, custom locations…). */
  onSwitchToClassic: () => void;
  defaultDriverId?: string;
  /** YYYY-MM-DD */
  scheduledDate: string;
}

/**
 * Map-canvas shift composer: the map is the workspace. Click bins to add
 * them, drag warehouse bins onto the street via place-mode, preview the
 * OR-Tools route (the same engine start-shift runs, warehouse-anchored)
 * as an animated polyline with numbered stops, then create.
 */
export function ShiftComposer({
  onClose,
  onSwitchToClassic,
  defaultDriverId,
  scheduledDate,
}: ShiftComposerProps) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const queryClient = useQueryClient();

  const { data: allBins = [] } = useBins();
  const { data: drivers = [] } = useDrivers();
  const { data: warehouse } = useWarehouseLocation();

  const [driverId, setDriverId] = useState(defaultDriverId ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // insertion order
  const [deployments, setDeployments] = useState<DeploymentEntry[]>([]);
  const [placingBin, setPlacingBin] = useState<Bin | null>(null);
  const [panel, setPanel] = useState<'collect' | 'deploy'>('collect');
  const [showTemplates, setShowTemplates] = useState(false);
  const [importedRouteId, setImportedRouteId] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const streetBins = useMemo(
    () =>
      allBins
        .filter(isMappableBin)
        .filter((b) => b.status === 'active' || b.status === 'pending_move'),
    [allBins]
  );
  const warehouseBins = useMemo(
    () => allBins.filter((b) => b.status === 'in_storage'),
    [allBins]
  );
  const binById = useMemo(() => new globalThis.Map(allBins.map((b) => [b.id, b])), [allBins]);

  // Preview is only valid for the exact selection it was computed from.
  const previewValid =
    preview != null &&
    preview.optimized_bin_ids.length === selectedIds.length &&
    preview.optimized_bin_ids.every((id) => selectedIds.includes(id));

  // Stop order: optimized when a valid preview exists, else selection order.
  const orderedIds = previewValid && preview ? preview.optimized_bin_ids : selectedIds;
  const seqByBin = useMemo(() => {
    const m = new globalThis.Map<string, number>();
    orderedIds.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [orderedIds]);

  const toggleBin = useCallback(
    (bin: Bin) => {
      setSelectedIds((prev) =>
        prev.includes(bin.id) ? prev.filter((id) => id !== bin.id) : [...prev, bin.id]
      );
      setError(null);
    },
    []
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!placingBin) return;
      const bin = placingBin;
      setPlacingBin(null);
      // Reverse-geocode best-effort; coordinates are the fallback address.
      const finish = (address: string) =>
        setDeployments((prev) => [
          ...prev.filter((d) => d.bin_id !== bin.id),
          {
            bin_id: bin.id,
            bin_number: bin.bin_number,
            destination_address: address,
            destination_latitude: lat,
            destination_longitude: lng,
          },
        ]);
      try {
        new google.maps.Geocoder().geocode(
          { location: { lat, lng } },
          (results, status) => {
            finish(
              status === 'OK' && results && results[0]
                ? results[0].formatted_address
                : `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            );
          }
        );
      } catch {
        finish(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    },
    [placingBin]
  );

  const handleTemplateImport = (route: Route, routeBins: Bin[]) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      for (const b of routeBins) if (!next.includes(b.id)) next.push(b.id);
      return next;
    });
    setImportedRouteId(route.id);
    setShowTemplates(false);
  };

  const runPreview = async () => {
    if (selectedIds.length === 0) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/routes/optimize-preview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bin_ids: selectedIds }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || `Preview failed (${res.status})`);
      }
      setPreview((await res.json()) as PreviewResult);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const createShift = async () => {
    if (!driverId) {
      setError('Pick a driver first.');
      return;
    }
    if (selectedIds.length === 0 && deployments.length === 0) {
      setError('Add at least one stop.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const tasks = orderedIds
        .map((id) => binById.get(id))
        .filter((b): b is Bin => !!b && b.latitude != null && b.longitude != null)
        .map((b) => ({
          task_type: 'collection',
          bin_id: b.id,
          bin_number: b.bin_number,
          latitude: b.latitude as number,
          longitude: b.longitude as number,
          address: b.location_name || `${b.current_street}, ${b.city}`,
          fill_percentage: b.fill_percentage ?? 0,
        }));

      const payload: Record<string, unknown> = {
        driver_id: driverId,
        truck_bin_capacity: 4,
        warehouse_latitude: warehouse?.latitude ?? DEFAULT_CENTER.lat,
        warehouse_longitude: warehouse?.longitude ?? DEFAULT_CENTER.lng,
        warehouse_address: warehouse?.address ?? 'Warehouse',
        lock_route_order: false,
        tasks,
        scheduled_date: scheduledDate,
      };
      if (deployments.length > 0) payload.warehouse_deployments = deployments;
      if (importedRouteId) payload.route_id = importedRouteId;

      const res = await fetch(`${API_BASE_URL}/api/manager/shifts/create-with-tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `Create failed (${res.status})`);
      }
      const skipped = body?.data?.skipped_bins as
        | { bin_number: number; status: string }[]
        | undefined;
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      if (skipped && skipped.length > 0) {
        // Keep the composer open so the exclusion is impossible to miss.
        setError(
          `Shift created, but ${skipped.length} bin(s) were excluded: ` +
            skipped.map((s) => `#${s.bin_number} (${s.status.replace('_', ' ')})`).join(', ')
        );
        setCreating(false);
        return;
      }
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create shift');
      setCreating(false);
    }
  };

  const stats = previewValid && preview
    ? {
        km: preview.total_distance_km,
        hours: preview.estimated_duration_hours,
      }
    : null;

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-full p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <RouteIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">New shift</h2>
              <span className="text-sm text-gray-400">{scheduledDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onSwitchToClassic}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 transition-colors"
              >
                Advanced form →
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-gray-100 transition-card"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
          {placingBin && (
            <div className="flex items-center gap-2 px-5 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
              <MapPin className="w-4 h-4 shrink-0" />
              Click the map to place Bin #{placingBin.bin_number}
              <button
                onClick={() => setPlacingBin(null)}
                className="ml-auto text-xs font-medium hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Body: map + rail */}
          <div className="flex-1 flex min-h-0">
            <div className={cn('flex-1 relative', placingBin && 'cursor-crosshair')}>
              <Map
                mapId="binly-shift-composer"
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={11}
                gestureHandling="greedy"
                disableDefaultUI={true}
                style={{ width: '100%', height: '100%' }}
                onClick={(e) => {
                  const ll = e.detail.latLng;
                  if (ll) handleMapClick(ll.lat, ll.lng);
                }}
              >
                <ZoneMarkersLayer />
                <WarehouseMarkerLayer />
                {streetBins.map((bin) => {
                  const seq = seqByBin.get(bin.id);
                  const selected = seq != null;
                  return (
                    <AdvancedMarker
                      key={bin.id}
                      position={{ lat: bin.latitude as number, lng: bin.longitude as number }}
                      zIndex={selected ? 50 : 10}
                      onClick={() => (placingBin ? undefined : toggleBin(bin))}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-full border-2 font-bold text-white transition-transform hover:scale-110',
                          selected
                            ? 'w-8 h-8 text-[12px] border-primary ring-2 ring-primary/40 shadow-lg'
                            : 'w-5 h-5 text-[8px] border-white shadow'
                        )}
                        style={{
                          backgroundColor: selected
                            ? '#4880FF'
                            : getBinMarkerColor(bin.fill_percentage, bin.status),
                          opacity: selected ? 1 : 0.85,
                        }}
                        title={`Bin #${bin.bin_number} — ${bin.fill_percentage ?? 0}%`}
                      >
                        {selected ? seq : bin.bin_number}
                      </div>
                    </AdvancedMarker>
                  );
                })}
                {deployments.map((d) => (
                  <AdvancedMarker
                    key={`dep-${d.bin_id}`}
                    position={{ lat: d.destination_latitude, lng: d.destination_longitude }}
                    zIndex={60}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <PackagePlus className="w-3 h-3" /> #{d.bin_number}
                    </div>
                  </AdvancedMarker>
                ))}
                <PreviewPolyline
                  preview={previewValid ? preview : null}
                  warehouse={warehouse ?? null}
                />
              </Map>

              {/* Stat bar overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl shadow-lg text-sm">
                <span className="font-semibold text-gray-900">
                  {selectedIds.length} stop{selectedIds.length === 1 ? '' : 's'}
                </span>
                {deployments.length > 0 && (
                  <span className="text-emerald-700 font-medium">
                    +{deployments.length} deploy
                  </span>
                )}
                {stats && (
                  <>
                    <span className="text-gray-500">{stats.km.toFixed(1)} km</span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {Math.floor(stats.hours)}h {Math.round((stats.hours % 1) * 60)}m
                    </span>
                  </>
                )}
                <button
                  onClick={runPreview}
                  disabled={previewLoading || selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-card"
                >
                  {previewLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  Preview route
                </button>
                <button
                  onClick={createShift}
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-card"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create shift
                </button>
              </div>
            </div>

            {/* Right rail */}
            <div className="w-[340px] shrink-0 border-l border-gray-100 flex flex-col min-h-0">
              <div className="flex p-2 gap-1 border-b border-gray-100">
                <PanelTab
                  active={panel === 'collect'}
                  onClick={() => setPanel('collect')}
                  label={`Collect (${selectedIds.length})`}
                />
                <PanelTab
                  active={panel === 'deploy'}
                  onClick={() => setPanel('deploy')}
                  label={`Deploy (${deployments.length})`}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {panel === 'collect' ? (
                  <>
                    <button
                      onClick={() => setShowTemplates(true)}
                      className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-primary hover:text-primary transition-card"
                    >
                      <Import className="w-4 h-4" /> Import route template
                    </button>
                    {orderedIds.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">
                        Click bins on the map to add them.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {orderedIds.map((id, i) => {
                          const bin = binById.get(id);
                          if (!bin) return null;
                          return (
                            <li
                              key={id}
                              className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-card"
                            >
                              <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  Bin #{bin.bin_number}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {bin.current_street} · {bin.fill_percentage ?? 0}%
                                </p>
                              </div>
                              <button
                                onClick={() => toggleBin(bin)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {previewValid && (
                      <p className="mt-3 text-[11px] text-gray-400 text-center">
                        Order shown is the OR-Tools optimized route
                        (warehouse → stops → warehouse).
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      Warehouse shelf — pick a bin, then click its new spot on the
                      map. Each placement creates a redeployment move with the shift.
                    </p>
                    {warehouseBins.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">
                        No bins in the warehouse.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {warehouseBins.map((bin) => {
                          const placed = deployments.find((d) => d.bin_id === bin.id);
                          return (
                            <li
                              key={bin.id}
                              className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-card"
                            >
                              <PackagePlus
                                className={cn(
                                  'w-4 h-4 shrink-0',
                                  placed ? 'text-emerald-600' : 'text-gray-400'
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  Bin #{bin.bin_number}
                                </p>
                                {placed && (
                                  <p className="text-xs text-emerald-700 truncate">
                                    → {placed.destination_address}
                                  </p>
                                )}
                              </div>
                              {placed ? (
                                <button
                                  onClick={() =>
                                    setDeployments((prev) =>
                                      prev.filter((d) => d.bin_id !== bin.id)
                                    )
                                  }
                                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  onClick={() => setPlacingBin(bin)}
                                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  Place →
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTemplates && (
        <RouteSelectionMap
          onClose={() => setShowTemplates(false)}
          onConfirm={handleTemplateImport}
        />
      )}
    </>
  );
}

function PanelTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-card',
        active ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50'
      )}
    >
      {label}
    </button>
  );
}

/**
 * Road-snapped, animated route line: warehouse → optimized stops → warehouse.
 * Geometry from the Mapbox Directions API (chunked past its 25-coordinate
 * limit); falls back to straight legs if directions fail. Draw-on animation
 * runs once per preview.
 */
function PreviewPolyline({
  preview,
  warehouse,
}: {
  preview: PreviewResult | null;
  warehouse: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any prior line/animation.
    if (animRef.current) cancelAnimationFrame(animRef.current);
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
    if (!map || !preview || preview.bins.length === 0) return;

    const wh = preview.warehouse ?? warehouse;
    if (!wh) return;

    const waypoints: [number, number][] = [
      [wh.longitude, wh.latitude],
      ...preview.bins.map((b) => [b.longitude, b.latitude] as [number, number]),
      [wh.longitude, wh.latitude],
    ];

    let cancelled = false;

    const fetchGeometry = async (): Promise<google.maps.LatLngLiteral[]> => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) throw new Error('no mapbox token');
      const path: google.maps.LatLngLiteral[] = [];
      // Mapbox Directions caps at 25 coordinates per request — chunk with
      // one-point overlap so legs join seamlessly.
      for (let start = 0; start < waypoints.length - 1; start += 24) {
        const chunk = waypoints.slice(start, Math.min(start + 25, waypoints.length));
        if (chunk.length < 2) break;
        const coords = chunk.map(([lng, lat]) => `${lng},${lat}`).join(';');
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`
        );
        if (!res.ok) throw new Error('directions failed');
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as
          | [number, number][]
          | undefined;
        if (!geometry) throw new Error('no geometry');
        for (const [lng, lat] of geometry) path.push({ lat, lng });
      }
      return path;
    };

    const draw = (fullPath: google.maps.LatLngLiteral[]) => {
      if (cancelled || fullPath.length < 2) return;
      const line = new google.maps.Polyline({
        path: [],
        geodesic: false,
        strokeColor: '#4880FF',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      polylineRef.current = line;
      // ~1.6s draw-on regardless of path length.
      const step = Math.max(1, Math.ceil(fullPath.length / 96));
      let idx = 0;
      const tick = () => {
        if (cancelled) return;
        idx = Math.min(fullPath.length, idx + step);
        line.setPath(fullPath.slice(0, idx));
        if (idx < fullPath.length) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);
    };

    fetchGeometry()
      .then(draw)
      .catch(() =>
        // Straight-leg fallback keeps the sequence readable without roads.
        draw(waypoints.map(([lng, lat]) => ({ lat, lng })))
      );

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, preview, warehouse]);

  return null;
}
