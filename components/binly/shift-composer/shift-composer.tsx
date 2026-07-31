'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import {
  ZoneMarkersLayer,
  WarehouseMarkerLayer,
  RecenterOnWarehouse,
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
  Truck,
  Import,
  MapPin,
  AlertTriangle,
  Clock,
  Route as RouteIcon,
  Wrench,
  Flag,
  Plus,
  Minus,
  Camera,
} from 'lucide-react';

import { apiFetch, getAuthHeaders } from '@/lib/api/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : fallback);
      });
    } catch {
      resolve(fallback);
    }
  });
}

interface DeploymentEntry {
  bin_id: string;
  bin_number: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
}

interface ServiceStop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
  duration_minutes: number;
  photo_required: boolean;
}

interface CustomPoint {
  latitude: number;
  longitude: number;
  address: string;
}

type PlacingMode =
  | { kind: 'deploy'; bin: Bin }
  | { kind: 'service' }
  | { kind: 'start' }
  | { kind: 'end' }
  | null;

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
  defaultDriverId?: string;
  /** YYYY-MM-DD */
  scheduledDate: string;
}

/**
 * Map-canvas shift composer — the single create-shift experience. The map is
 * the workspace: click bins to add stops, place warehouse deployments,
 * service stops, and custom start/end points directly on it, preview the
 * OR-Tools route (the same engine start-shift runs, warehouse-anchored) as
 * an animated polyline, then create. Supersedes the classic CreateShiftDrawer
 * (retired in shifts-view.tsx).
 */
export function ShiftComposer({ onClose, defaultDriverId, scheduledDate }: ShiftComposerProps) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const queryClient = useQueryClient();

  const { data: allBins = [] } = useBins();
  const { data: drivers = [] } = useDrivers();
  const { data: warehouse } = useWarehouseLocation();

  // Selection
  const [driverId, setDriverId] = useState(defaultDriverId ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<DeploymentEntry[]>([]);
  const [serviceStops, setServiceStops] = useState<ServiceStop[]>([]);
  const [placing, setPlacing] = useState<PlacingMode>(null);
  const [panel, setPanel] = useState<'collect' | 'deploy' | 'details'>('collect');
  const [showTemplates, setShowTemplates] = useState(false);
  const [importedRouteId, setImportedRouteId] = useState<string | null>(null);

  // Details (folded in from the classic drawer)
  const [availableAt, setAvailableAt] = useState<'now' | '1h' | '2h' | 'custom'>('now');
  const [customAvailableTime, setCustomAvailableTime] = useState('');
  const [finishBy, setFinishBy] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [shiftLabel, setShiftLabel] = useState('');
  const [lockRouteOrder, setLockRouteOrder] = useState(false);
  const [customStart, setCustomStart] = useState<CustomPoint | null>(null);
  const [customEnd, setCustomEnd] = useState<CustomPoint | null>(null);

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

  const previewValid =
    preview != null &&
    preview.optimized_bin_ids.length === selectedIds.length &&
    preview.optimized_bin_ids.every((id) => selectedIds.includes(id));

  const orderedIds = previewValid && preview ? preview.optimized_bin_ids : selectedIds;
  const seqByBin = useMemo(() => {
    const m = new globalThis.Map<string, number>();
    orderedIds.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [orderedIds]);

  const toggleBin = useCallback((bin: Bin) => {
    setSelectedIds((prev) =>
      prev.includes(bin.id) ? prev.filter((id) => id !== bin.id) : [...prev, bin.id]
    );
    setError(null);
  }, []);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!placing) return;
      const mode = placing;
      setPlacing(null);
      const address = await reverseGeocode(lat, lng);
      if (mode.kind === 'deploy') {
        setDeployments((prev) => [
          ...prev.filter((d) => d.bin_id !== mode.bin.id),
          {
            bin_id: mode.bin.id,
            bin_number: mode.bin.bin_number,
            destination_address: address,
            destination_latitude: lat,
            destination_longitude: lng,
          },
        ]);
      } else if (mode.kind === 'service') {
        setServiceStops((prev) => [
          ...prev,
          {
            id: `svc-${lat.toFixed(5)}-${lng.toFixed(5)}-${prev.length}`,
            label: 'Service stop',
            latitude: lat,
            longitude: lng,
            address,
            duration_minutes: 10,
            photo_required: false,
          },
        ]);
        setPanel('collect');
      } else if (mode.kind === 'start') {
        setCustomStart({ latitude: lat, longitude: lng, address });
      } else if (mode.kind === 'end') {
        setCustomEnd({ latitude: lat, longitude: lng, address });
      }
    },
    [placing]
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
      const res = await apiFetch(`${API_BASE_URL}/api/routes/optimize-preview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bin_ids: selectedIds,
          ...(customStart && {
            start_location: {
              latitude: customStart.latitude,
              longitude: customStart.longitude,
            },
          }),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Preview failed (${res.status})`);
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
    if (selectedIds.length === 0 && deployments.length === 0 && serviceStops.length === 0) {
      setError('Add at least one stop.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const collectionTasks = orderedIds
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
      const serviceTasks = serviceStops.map((s) => ({
        task_type: 'service',
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address,
        task_label: s.label,
        photo_required: s.photo_required,
        service_duration_seconds: s.duration_minutes * 60,
      }));

      const isCustomShift =
        !!shiftLabel ||
        !!finishBy ||
        availableAt !== 'now' ||
        customStart != null ||
        customEnd != null;

      const payload: Record<string, unknown> = {
        driver_id: driverId,
        truck_bin_capacity: capacity,
        warehouse_latitude: warehouse?.latitude ?? DEFAULT_CENTER.lat,
        warehouse_longitude: warehouse?.longitude ?? DEFAULT_CENTER.lng,
        warehouse_address: warehouse?.address ?? 'Warehouse',
        lock_route_order: lockRouteOrder,
        tasks: [...collectionTasks, ...serviceTasks],
        scheduled_date: scheduledDate,
        ...(deployments.length > 0 && { warehouse_deployments: deployments }),
        ...(importedRouteId && { route_id: importedRouteId }),
        ...(isCustomShift && { shift_type: 'custom' }),
        ...(shiftLabel && { shift_label: shiftLabel }),
        ...(finishBy && { scheduled_end: new Date(finishBy).toISOString() }),
        ...(availableAt !== 'now' && {
          scheduled_start:
            availableAt === '1h'
              ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
              : availableAt === '2h'
                ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                : customAvailableTime
                  ? new Date(customAvailableTime).toISOString()
                  : undefined,
        }),
        ...(customStart && {
          start_latitude: customStart.latitude,
          start_longitude: customStart.longitude,
          start_address: customStart.address,
        }),
        ...(customEnd && {
          end_latitude: customEnd.latitude,
          end_longitude: customEnd.longitude,
          end_address: customEnd.address,
        }),
      };

      const res = await apiFetch(`${API_BASE_URL}/api/manager/shifts/create-with-tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Create failed (${res.status})`);

      const skipped = body?.data?.skipped_bins as
        | { bin_number: number; status: string }[]
        | undefined;
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      if (skipped && skipped.length > 0) {
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

  const stats =
    previewValid && preview
      ? { km: preview.total_distance_km, hours: preview.estimated_duration_hours }
      : null;

  const placingHint =
    placing?.kind === 'deploy'
      ? `Click the map to place Bin #${placing.bin.bin_number}`
      : placing?.kind === 'service'
        ? 'Click the map to add a service stop'
        : placing?.kind === 'start'
          ? 'Click the map to set the custom START point'
          : placing?.kind === 'end'
            ? 'Click the map to set the custom END point'
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
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-card"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Toolbar: driver chips + schedule */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-medium text-gray-500 mr-1 shrink-0">Driver</span>
              {drivers.map((d) => {
                const selected = driverId === d.id;
                const dot =
                  d.status === 'available'
                    ? 'bg-green-500'
                    : d.status === 'on-shift'
                      ? 'bg-amber-500'
                      : 'bg-gray-300';
                return (
                  <button
                    key={d.id}
                    onClick={() => setDriverId(selected ? '' : d.id)}
                    className={cn(
                      'flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border text-sm shrink-0 transition-card',
                      selected
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                    title={d.status.replace('-', ' ')}
                  >
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                        selected ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {d.name
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    {d.name}
                    <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs font-medium text-gray-500">Starts</span>
              {(['now', '1h', '2h', 'custom'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAvailableAt(opt)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-card',
                    availableAt === opt
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {opt === 'now' ? 'Now' : opt === 'custom' ? 'Custom' : `+${opt}`}
                </button>
              ))}
              {availableAt === 'custom' && (
                <input
                  type="datetime-local"
                  value={customAvailableTime}
                  onChange={(e) => setCustomAvailableTime(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                />
              )}
              <span className="text-xs font-medium text-gray-500 ml-2">Finish by</span>
              <input
                type="datetime-local"
                value={finishBy}
                onChange={(e) => setFinishBy(e.target.value)}
                className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
          {placingHint && (
            <div className="flex items-center gap-2 px-5 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
              <MapPin className="w-4 h-4 shrink-0" />
              {placingHint}
              <button
                onClick={() => setPlacing(null)}
                className="ml-auto text-xs font-medium hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Body: map + rail */}
          <div className="flex-1 flex min-h-0">
            <div className={cn('flex-1 relative', placing && 'cursor-crosshair')}>
              <Map
                mapId="binly-shift-composer"
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={11}
                gestureHandling="greedy"
                disableDefaultUI={true}
                style={{ width: '100%', height: '100%' }}
                onClick={(e) => {
                  const ll = e.detail.latLng;
                  if (ll) void handleMapClick(ll.lat, ll.lng);
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
                      onClick={() => (placing ? undefined : toggleBin(bin))}
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
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-teal-600 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <Truck className="w-3 h-3" /> #{d.bin_number}
                    </div>
                  </AdvancedMarker>
                ))}
                {serviceStops.map((s) => (
                  <AdvancedMarker
                    key={s.id}
                    position={{ lat: s.latitude, lng: s.longitude }}
                    zIndex={60}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-600 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <Wrench className="w-3 h-3" /> {s.label}
                    </div>
                  </AdvancedMarker>
                ))}
                {customStart && (
                  <AdvancedMarker
                    position={{ lat: customStart.latitude, lng: customStart.longitude }}
                    zIndex={70}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <Flag className="w-3 h-3" /> Start
                    </div>
                  </AdvancedMarker>
                )}
                {customEnd && (
                  <AdvancedMarker
                    position={{ lat: customEnd.latitude, lng: customEnd.longitude }}
                    zIndex={70}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <Flag className="w-3 h-3" /> End
                    </div>
                  </AdvancedMarker>
                )}
                <PreviewPolyline
                  preview={previewValid ? preview : null}
                  warehouse={warehouse ?? null}
                />
                {/* Opens on this organization's warehouse, not a hardcoded city. */}
                <RecenterOnWarehouse />
              </Map>

              {/* Stat bar overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl shadow-lg text-sm">
                <span className="font-semibold text-gray-900">
                  {selectedIds.length} stop{selectedIds.length === 1 ? '' : 's'}
                </span>
                {deployments.length > 0 && (
                  <span className="text-teal-700 font-medium">
                    +{deployments.length} redeploy
                  </span>
                )}
                {serviceStops.length > 0 && (
                  <span className="text-violet-700 font-medium">
                    +{serviceStops.length} service
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
                <PanelTab
                  active={panel === 'details'}
                  onClick={() => setPanel('details')}
                  label="Details"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {panel === 'collect' && (
                  <CollectPanel
                    orderedIds={orderedIds}
                    binById={binById}
                    serviceStops={serviceStops}
                    previewValid={previewValid}
                    onImport={() => setShowTemplates(true)}
                    onRemoveBin={toggleBin}
                    onAddService={() => setPlacing({ kind: 'service' })}
                    onUpdateService={(id, patch) =>
                      setServiceStops((prev) =>
                        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
                      )
                    }
                    onRemoveService={(id) =>
                      setServiceStops((prev) => prev.filter((s) => s.id !== id))
                    }
                  />
                )}
                {panel === 'deploy' && (
                  <DeployPanel
                    warehouseBins={warehouseBins}
                    deployments={deployments}
                    onPlace={(bin) => setPlacing({ kind: 'deploy', bin })}
                    onRemove={(binId) =>
                      setDeployments((prev) => prev.filter((d) => d.bin_id !== binId))
                    }
                  />
                )}
                {panel === 'details' && (
                  <DetailsPanel
                    capacity={capacity}
                    setCapacity={setCapacity}
                    shiftLabel={shiftLabel}
                    setShiftLabel={setShiftLabel}
                    lockRouteOrder={lockRouteOrder}
                    setLockRouteOrder={setLockRouteOrder}
                    customStart={customStart}
                    customEnd={customEnd}
                    onSetStart={() => setPlacing({ kind: 'start' })}
                    onSetEnd={() => setPlacing({ kind: 'end' })}
                    onClearStart={() => setCustomStart(null)}
                    onClearEnd={() => setCustomEnd(null)}
                    warehouseAddress={warehouse?.address ?? 'Warehouse'}
                  />
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

// ── Rail panels ─────────────────────────────────────────────────────────────

function CollectPanel({
  orderedIds,
  binById,
  serviceStops,
  previewValid,
  onImport,
  onRemoveBin,
  onAddService,
  onUpdateService,
  onRemoveService,
}: {
  orderedIds: string[];
  binById: globalThis.Map<string, Bin>;
  serviceStops: ServiceStop[];
  previewValid: boolean;
  onImport: () => void;
  onRemoveBin: (bin: Bin) => void;
  onAddService: () => void;
  onUpdateService: (id: string, patch: Partial<ServiceStop>) => void;
  onRemoveService: (id: string) => void;
}) {
  return (
    <>
      <div className="flex gap-2 mb-3">
        <button
          onClick={onImport}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-primary hover:text-primary transition-card"
        >
          <Import className="w-4 h-4" /> Template
        </button>
        <button
          onClick={onAddService}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-violet-500 hover:text-violet-600 transition-card"
        >
          <Wrench className="w-4 h-4" /> Service stop
        </button>
      </div>

      {orderedIds.length === 0 && serviceStops.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Click bins on the map to add them.
        </p>
      ) : (
        <>
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
                    onClick={() => onRemoveBin(bin)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          {serviceStops.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Service stops</p>
              <ul className="space-y-1.5">
                {serviceStops.map((s) => (
                  <li key={s.id} className="p-2 rounded-xl bg-violet-50/60">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-violet-600 shrink-0" />
                      <input
                        value={s.label}
                        onChange={(e) => onUpdateService(s.id, { label: e.target.value })}
                        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-900 focus:outline-none focus:border-b focus:border-violet-400"
                      />
                      <button
                        onClick={() => onRemoveService(s.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{s.address}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <select
                        value={s.duration_minutes}
                        onChange={(e) =>
                          onUpdateService(s.id, { duration_minutes: Number(e.target.value) })
                        }
                        className="text-xs rounded-lg border border-gray-200 px-1.5 py-0.5 bg-white"
                      >
                        {[5, 10, 15, 30, 60].map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.photo_required}
                          onChange={(e) =>
                            onUpdateService(s.id, { photo_required: e.target.checked })
                          }
                          className="accent-violet-600"
                        />
                        <Camera className="w-3 h-3" /> photo
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previewValid && (
            <p className="mt-3 text-[11px] text-gray-400 text-center">
              Order shown is the OR-Tools optimized route (warehouse → stops → warehouse).
            </p>
          )}
        </>
      )}
    </>
  );
}

function DeployPanel({
  warehouseBins,
  deployments,
  onPlace,
  onRemove,
}: {
  warehouseBins: Bin[];
  deployments: DeploymentEntry[];
  onPlace: (bin: Bin) => void;
  onRemove: (binId: string) => void;
}) {
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">
        Warehouse shelf — pick a bin, then click its new spot on the map. Each placement
        creates a redeployment move with the shift.
      </p>
      {warehouseBins.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No bins in the warehouse.</p>
      ) : (
        <ul className="space-y-1.5">
          {warehouseBins.map((bin) => {
            const placed = deployments.find((d) => d.bin_id === bin.id);
            return (
              <li
                key={bin.id}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-card"
              >
                <Truck
                  className={cn(
                    'w-4 h-4 shrink-0',
                    placed ? 'text-teal-600' : 'text-gray-400'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">Bin #{bin.bin_number}</p>
                  {placed && (
                    <p className="text-xs text-teal-700 truncate">
                      → {placed.destination_address}
                    </p>
                  )}
                </div>
                {placed ? (
                  <button
                    onClick={() => onRemove(bin.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onPlace(bin)}
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
  );
}

function DetailsPanel({
  capacity,
  setCapacity,
  shiftLabel,
  setShiftLabel,
  lockRouteOrder,
  setLockRouteOrder,
  customStart,
  customEnd,
  onSetStart,
  onSetEnd,
  onClearStart,
  onClearEnd,
  warehouseAddress,
}: {
  capacity: number;
  setCapacity: (n: number) => void;
  shiftLabel: string;
  setShiftLabel: (s: string) => void;
  lockRouteOrder: boolean;
  setLockRouteOrder: (b: boolean) => void;
  customStart: CustomPoint | null;
  customEnd: CustomPoint | null;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
  warehouseAddress: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Shift label</p>
        <input
          value={shiftLabel}
          onChange={(e) => setShiftLabel(e.target.value)}
          placeholder="Optional — e.g. South SJ sweep"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Truck bin capacity</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCapacity(Math.max(1, capacity - 1))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-card"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
          <span className="w-10 text-center text-sm font-semibold text-gray-900">
            {capacity}
          </span>
          <button
            onClick={() => setCapacity(Math.min(12, capacity + 1))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-card"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-400 ml-1">bins on truck</span>
        </div>
      </div>

      <LocationRow
        title="Start point"
        custom={customStart}
        warehouseAddress={warehouseAddress}
        onSet={onSetStart}
        onClear={onClearStart}
      />
      <LocationRow
        title="End point"
        custom={customEnd}
        warehouseAddress={warehouseAddress}
        onSet={onSetEnd}
        onClear={onClearEnd}
      />

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={lockRouteOrder}
          onChange={(e) => setLockRouteOrder(e.target.checked)}
          className="mt-0.5 accent-[#4880FF]"
        />
        <span>
          <span className="text-sm font-medium text-gray-900 block">Lock route order</span>
          <span className="text-xs text-gray-500">
            Keep the stop order fixed — no re-optimization at start or mid-shift.
          </span>
        </span>
      </label>
    </div>
  );
}

function LocationRow({
  title,
  custom,
  warehouseAddress,
  onSet,
  onClear,
}: {
  title: string;
  custom: CustomPoint | null;
  warehouseAddress: string;
  onSet: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{title}</p>
      <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200">
        <Flag className="w-4 h-4 text-gray-400 shrink-0" />
        <p className="text-xs text-gray-700 truncate flex-1">
          {custom ? custom.address : warehouseAddress}
        </p>
        {custom ? (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500 shrink-0 transition-colors"
          >
            Reset
          </button>
        ) : (
          <button
            onClick={onSet}
            className="text-xs font-medium text-primary hover:text-primary/80 shrink-0 transition-colors"
          >
            Set on map →
          </button>
        )}
      </div>
    </div>
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
 * limit); falls back to straight legs if directions fail.
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
      .catch(() => draw(waypoints.map(([lng, lat]) => ({ lat, lng }))));

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, preview, warehouse]);

  return null;
}
