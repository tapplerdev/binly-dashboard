'use client';

import { useCallback, useMemo, useState } from 'react';
import { Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useQuery } from '@tanstack/react-query';
import { X, Truck, Sparkles, MapPin, Loader2, Wand2 } from 'lucide-react';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { BinMarkersLayer, ZoneMarkersLayer, WarehouseMarkerLayer } from '@/components/binly/map-layers';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import type { Bin } from '@/lib/types/bin';
import { cn } from '@/lib/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

/** Same shape shifts-view stages and create-with-tasks consumes. */
export interface RedeploymentItem {
  bin_id: string;
  bin_number: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
}

/** Growth candidate subset (same endpoint the Growth tab + RelocateSuggestModal use). */
interface ScoredCandidate {
  id: string;
  address: string;
  street: string;
  city: string;
  zip?: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
  in_no_go_zone: boolean;
  nearest_bin_m: number;
}

async function fetchCandidates(): Promise<{ candidates: ScoredCandidate[] }> {
  const r = await fetch(`${API_BASE_URL}/api/analytics/growth/candidates`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch growth candidates');
  return (await r.json()).data;
}

/** Maps JS is already loaded via the dashboard-level APIProvider. */
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

function candidateAddress(c: ScoredCandidate): string {
  if (c.street && c.city) return `${c.street}, ${c.city}${c.zip ? ' ' + c.zip : ''}`;
  return c.address;
}

/** Backend emits last_moved as Unix seconds; the Bin type predates it. */
function daysInStorage(bin: Bin): number | null {
  const ts = (bin as unknown as { last_moved?: number | null }).last_moved;
  if (!ts || ts <= 0) return null;
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  return days >= 0 ? days : null;
}

interface RedeploymentPickerModalProps {
  onClose: () => void;
  /** Replaces the staged list wholesale — the modal is the source of truth while open. */
  onConfirm: (items: RedeploymentItem[]) => void;
  initialDeployments?: RedeploymentItem[];
}

/**
 * Map-first picker for redeployments: choose stored bins on the left, give
 * each a destination by clicking the map or using an AI-suggested spot
 * (Growth candidate scoring). Stages RedeploymentItem[] — the backend mints
 * the redeployment move + placement task from it at shift creation.
 */
export function RedeploymentPickerModal({ onClose, onConfirm, initialDeployments = [] }: RedeploymentPickerModalProps) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const [deployments, setDeployments] = useState<RedeploymentItem[]>(initialDeployments);
  const [placingBin, setPlacingBin] = useState<Bin | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const { data: allBins = [], isLoading: binsLoading } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const { data: candidateData } = useQuery({
    queryKey: ['growth-candidates'],
    queryFn: fetchCandidates,
    staleTime: 5 * 60 * 1000,
  });

  const warehouseBins = useMemo(
    () => allBins.filter((b) => b.status === 'in_storage'),
    [allBins],
  );

  const suggestions = useMemo(
    () =>
      (candidateData?.candidates ?? [])
        .filter((c) => !c.in_no_go_zone && c.latitude != null && c.longitude != null)
        .slice(0, 8),
    [candidateData],
  );

  const deployedByBin = useMemo(
    () => new Map(deployments.map((d) => [d.bin_id, d])),
    [deployments],
  );
  const unplacedBins = useMemo(
    () => warehouseBins.filter((b) => !deployedByBin.has(b.id)),
    [warehouseBins, deployedByBin],
  );
  const usedSpots = useMemo(
    () => new Set(deployments.map((d) => `${d.destination_latitude},${d.destination_longitude}`)),
    [deployments],
  );

  const assign = useCallback((bin: Bin, address: string, lat: number, lng: number) => {
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
  }, []);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!placingBin) return;
      const bin = placingBin;
      setPlacingBin(null);
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);
      // If the bin got a destination while the geocode was in flight (e.g.
      // the user used a suggestion meanwhile), the later action wins.
      setDeployments((prev) =>
        prev.some((d) => d.bin_id === bin.id)
          ? prev
          : [
              ...prev,
              {
                bin_id: bin.id,
                bin_number: bin.bin_number,
                destination_address: address,
                destination_latitude: lat,
                destination_longitude: lng,
              },
            ],
      );
    },
    [placingBin],
  );

  // Apply a suggestion to the armed bin if one is armed, else the first
  // bin without a destination (stored bins are fungible).
  const applySuggestion = useCallback(
    (c: ScoredCandidate) => {
      if (c.latitude == null || c.longitude == null) return;
      if (usedSpots.has(`${c.latitude},${c.longitude}`)) return;
      const bin = placingBin ?? unplacedBins[0];
      if (!bin) return;
      setPlacingBin(null);
      assign(bin, candidateAddress(c), c.latitude, c.longitude);
    },
    [placingBin, unplacedBins, usedSpots, assign],
  );

  // Pair every unplaced bin (list order) with the best unused suggestions.
  const autoAssign = useCallback(() => {
    const spots = suggestions.filter(
      (c) => !usedSpots.has(`${c.latitude},${c.longitude}`),
    );
    setDeployments((prev) => {
      const next = [...prev];
      const placed = new Set(prev.map((d) => d.bin_id));
      let i = 0;
      for (const bin of warehouseBins) {
        if (placed.has(bin.id)) continue;
        const c = spots[i++];
        if (!c || c.latitude == null || c.longitude == null) break;
        next.push({
          bin_id: bin.id,
          bin_number: bin.bin_number,
          destination_address: candidateAddress(c),
          destination_latitude: c.latitude,
          destination_longitude: c.longitude,
        });
      }
      return next;
    });
    setPlacingBin(null);
  }, [suggestions, usedSpots, warehouseBins]);

  const removeDeployment = (binId: string) =>
    setDeployments((prev) => prev.filter((d) => d.bin_id !== binId));

  const center = warehouse
    ? { lat: warehouse.latitude, lng: warehouse.longitude }
    : DEFAULT_CENTER;

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-full p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <Truck className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Redeployment</h2>
              <p className="text-xs text-gray-500">Deploy stored bins to the field — click the map or use a suggested spot</p>
            </div>
            <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Left rail */}
            <div className="w-[360px] border-r border-gray-200 bg-gray-50 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Warehouse · {warehouseBins.length} {warehouseBins.length === 1 ? 'bin' : 'bins'}
                  </p>
                  {binsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading bins…
                    </div>
                  ) : warehouseBins.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No bins currently in warehouse storage.</p>
                  ) : (
                    <div className="space-y-2">
                      {warehouseBins.map((bin) => {
                        const placed = deployedByBin.get(bin.id);
                        const arming = placingBin?.id === bin.id;
                        const days = daysInStorage(bin);
                        return (
                          <div
                            key={bin.id}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2 bg-white text-sm',
                              placed && 'border-teal-200 bg-teal-50',
                              arming && 'border-teal-500 ring-1 ring-teal-200',
                              !placed && !arming && 'border-gray-200',
                            )}
                          >
                            <Truck className={cn('w-4 h-4 shrink-0', placed || arming ? 'text-teal-600' : 'text-gray-400')} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                Bin #{bin.bin_number}
                                {days != null && days > 0 && (
                                  <span className="ml-2 text-[11px] font-normal text-gray-400">in storage {days}d</span>
                                )}
                              </p>
                              {placed ? (
                                <p className="text-xs text-teal-700 truncate">→ {placed.destination_address}</p>
                              ) : arming ? (
                                <p className="text-xs text-teal-600">Click the map or a suggested spot…</p>
                              ) : null}
                            </div>
                            {placed ? (
                              <button
                                type="button"
                                onClick={() => removeDeployment(bin.id)}
                                className="text-gray-400 hover:text-red-500 shrink-0"
                                title="Remove destination"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : arming ? (
                              <button
                                type="button"
                                onClick={() => setPlacingBin(null)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700 shrink-0"
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPlacingBin(bin)}
                                className="text-xs font-medium text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md px-2 py-1 shrink-0"
                              >
                                Place →
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {suggestions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Suggested spots
                      </p>
                      {unplacedBins.length > 0 && (
                        <button
                          type="button"
                          onClick={autoAssign}
                          className="flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900"
                        >
                          <Wand2 className="w-3 h-3" /> Auto-assign {Math.min(unplacedBins.length, suggestions.filter((c) => !usedSpots.has(`${c.latitude},${c.longitude}`)).length)}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {suggestions.map((c) => {
                        const used = usedSpots.has(`${c.latitude},${c.longitude}`);
                        return (
                          <div
                            key={c.id}
                            className={cn(
                              'rounded-lg border border-gray-200 bg-white px-3 py-2',
                              used && 'opacity-50',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                                {Math.round(c.score)}
                              </span>
                              <span className="flex-1 text-sm text-gray-900 truncate">{c.street || c.address}</span>
                              {!used && (
                                <button
                                  type="button"
                                  onClick={() => applySuggestion(c)}
                                  disabled={!placingBin && unplacedBins.length === 0}
                                  className="text-xs font-medium text-teal-700 hover:text-teal-900 disabled:opacity-40 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-md px-2 py-0.5"
                                >
                                  Use
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {c.city} · nearest bin {Math.round(c.nearest_bin_m)} m
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            <div className={cn('flex-1 relative', placingBin && 'cursor-crosshair')}>
              <GoogleMap
                mapId="binly-redeployment-picker"
                defaultCenter={center}
                defaultZoom={12}
                mapTypeId="hybrid"
                gestureHandling="greedy"
                disableDefaultUI={false}
                streetViewControl={false}
                className="w-full h-full"
                onClick={(e) => {
                  const ll = e.detail.latLng;
                  if (ll) void handleMapClick(ll.lat, ll.lng);
                }}
              >
                <BinMarkersLayer size="sm" showLabels={false} zIndex={1} />
                <ZoneMarkersLayer />
                <WarehouseMarkerLayer />

                {suggestions.map((c) =>
                  c.latitude != null && c.longitude != null ? (
                    <AdvancedMarker
                      key={c.id}
                      position={{ lat: c.latitude, lng: c.longitude }}
                      zIndex={40}
                      onClick={(e) => {
                        e.stop();
                        applySuggestion(c);
                      }}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full bg-white border-2 border-teal-500 flex items-center justify-center text-[11px] font-bold text-teal-800 shadow',
                          usedSpots.has(`${c.latitude},${c.longitude}`) && 'opacity-40',
                        )}
                      >
                        {Math.round(c.score)}
                      </div>
                    </AdvancedMarker>
                  ) : null,
                )}

                {deployments.map((d) => (
                  <AdvancedMarker
                    key={d.bin_id}
                    position={{ lat: d.destination_latitude, lng: d.destination_longitude }}
                    zIndex={60}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-teal-600 text-white text-[11px] font-bold border-2 border-white shadow-lg">
                      <Truck className="w-3 h-3" /> #{d.bin_number}
                    </div>
                  </AdvancedMarker>
                ))}
              </GoogleMap>

              {(placingBin || geocoding) && (
                <div className="absolute left-3 right-3 bottom-3 bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm text-teal-800 flex items-center gap-2 shadow">
                  {geocoding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Looking up address…
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 text-teal-600" />
                      Click a suggested spot or anywhere on the map to place Bin #{placingBin!.bin_number}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-200">
            <p className="flex-1 text-sm text-gray-500">
              {deployments.length === 0
                ? 'No destinations set yet'
                : `${deployments.length} ${deployments.length === 1 ? 'redeployment' : 'redeployments'} staged`}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(deployments);
                handleClose();
              }}
              disabled={geocoding || (deployments.length === 0 && initialDeployments.length === 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
            >
              {deployments.length === 0
                ? initialDeployments.length > 0
                  ? 'Remove all'
                  : 'Add redeployments'
                : `Add ${deployments.length} ${deployments.length === 1 ? 'redeployment' : 'redeployments'}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
