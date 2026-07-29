'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useQuery } from '@tanstack/react-query';
import { X, Truck, Sparkles, MapPin, Loader2, Wand2, ChevronDown, ChevronUp, Crosshair, Eye } from 'lucide-react';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { BinMarkersLayer, ZoneMarkersLayer, WarehouseMarkerLayer } from '@/components/binly/map-layers';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { hereReverseGeocode, HerePlaceDetails } from '@/lib/services/geocoding.service';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import type { Bin } from '@/lib/types/bin';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api/client';

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
  const r = await apiFetch(`${API_BASE_URL}/api/analytics/growth/candidates`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch growth candidates');
  return (await r.json()).data;
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

/** Flies the camera to a spot (timestamp forces re-pan). Same pan+zoom the placement modal uses. */
function MapController({ target }: { target: { lat: number; lng: number; ts: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(16);
  }, [map, target]);
  return null;
}

/** Teal score pin — same teardrop geometry as MapMarkerPin (components/ui/map-marker-pin.tsx). */
function CandidatePin({ score, size = 40 }: { score: number; size?: number }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
        <circle cx="24" cy="18" r="14" fill="#0d9488" stroke="white" strokeWidth="2.5" />
        <path d="M 24 32 L 17 32 L 24 45 L 31 32 Z" fill="#0d9488" />
        <text x="24" y="22.5" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          {Math.round(score)}
        </text>
      </svg>
    </div>
  );
}

interface RedeploymentPickerModalProps {
  onClose: () => void;
  /** Replaces the staged list wholesale — the modal is the source of truth while open. */
  onConfirm: (items: RedeploymentItem[]) => void;
  initialDeployments?: RedeploymentItem[];
}

/**
 * Map-first picker for redeployments. Each stored bin expands into its own
 * chooser: AI-suggested spots (Growth candidate scoring, View pans the map),
 * click-on-map placement (HERE reverse geocode), or a typed address (HERE
 * autocomplete). Stages RedeploymentItem[] — the backend mints the
 * redeployment move + placement task from it at shift creation.
 */
export function RedeploymentPickerModal({ onClose, onConfirm, initialDeployments = [] }: RedeploymentPickerModalProps) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const [deployments, setDeployments] = useState<RedeploymentItem[]>(initialDeployments);
  const [expandedBinId, setExpandedBinId] = useState<string | null>(null);
  const [placingBin, setPlacingBin] = useState<Bin | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [addressText, setAddressText] = useState('');
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(null);

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
  const availableSuggestions = useMemo(
    () => suggestions.filter((c) => !usedSpots.has(`${c.latitude},${c.longitude}`)),
    [suggestions, usedSpots],
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

  const toggleExpanded = (bin: Bin) => {
    setAddressText('');
    setPlacingBin(null);
    setExpandedBinId((prev) => (prev === bin.id ? null : bin.id));
  };

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!placingBin) return;
      const bin = placingBin;
      setPlacingBin(null);
      setGeocoding(true);
      const result = await hereReverseGeocode(lat, lng);
      setGeocoding(false);
      const address = result?.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

  /** Assign a suggestion to an explicit bin (expanded row) or the best guess (map marker). */
  const applySuggestion = useCallback(
    (c: ScoredCandidate, explicitBin?: Bin) => {
      if (c.latitude == null || c.longitude == null) return;
      if (usedSpots.has(`${c.latitude},${c.longitude}`)) return;
      const expanded = expandedBinId ? warehouseBins.find((b) => b.id === expandedBinId) : undefined;
      const bin = explicitBin ?? placingBin ?? expanded ?? unplacedBins[0];
      if (!bin) return;
      setPlacingBin(null);
      setFocusedCandidateId(null);
      assign(bin, candidateAddress(c), c.latitude, c.longitude);
      setFocusTarget({ lat: c.latitude, lng: c.longitude, ts: Date.now() });
    },
    [usedSpots, expandedBinId, warehouseBins, placingBin, unplacedBins, assign],
  );

  const viewSuggestion = (c: ScoredCandidate) => {
    if (c.latitude == null || c.longitude == null) return;
    setFocusedCandidateId(c.id);
    setFocusTarget({ lat: c.latitude, lng: c.longitude, ts: Date.now() });
  };

  const handlePlaceSelect = (bin: Bin, place: HerePlaceDetails) => {
    const address = place.formattedAddress || `${place.street}, ${place.city} ${place.zip}`;
    assign(bin, address, place.latitude, place.longitude);
    setAddressText('');
    setFocusTarget({ lat: place.latitude, lng: place.longitude, ts: Date.now() });
  };

  // Pair every unplaced bin (list order) with the best unused suggestions.
  const autoAssign = useCallback(() => {
    const spots = [...availableSuggestions];
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
    setFocusedCandidateId(null);
  }, [availableSuggestions, warehouseBins]);

  const removeDeployment = (binId: string) =>
    setDeployments((prev) => prev.filter((d) => d.bin_id !== binId));

  const center = warehouse
    ? { lat: warehouse.latitude, lng: warehouse.longitude }
    : DEFAULT_CENTER;

  // The bin a map-pin click (or a focused pin's "Use for…" popup) assigns to.
  const expandedBin = expandedBinId ? warehouseBins.find((b) => b.id === expandedBinId) : undefined;
  const markerTargetBin = placingBin ?? expandedBin ?? unplacedBins[0];

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
              <p className="text-xs text-gray-500">Pick a bin, then choose a suggested spot, click the map, or type an address</p>
            </div>
            <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Left rail — expandable bin rows */}
            <div className="w-[380px] border-r border-gray-200 bg-gray-50 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Warehouse · {warehouseBins.length} {warehouseBins.length === 1 ? 'bin' : 'bins'}
                </p>
                {unplacedBins.length > 0 && availableSuggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={autoAssign}
                    className="flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900"
                  >
                    <Wand2 className="w-3 h-3" /> Auto-assign {Math.min(unplacedBins.length, availableSuggestions.length)}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {binsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading bins…
                  </div>
                ) : warehouseBins.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No bins currently in warehouse storage.</p>
                ) : (
                  warehouseBins.map((bin) => {
                    const placed = deployedByBin.get(bin.id);
                    const expanded = expandedBinId === bin.id;
                    const arming = placingBin?.id === bin.id;
                    const days = daysInStorage(bin);
                    return (
                      <div
                        key={bin.id}
                        className={cn(
                          'rounded-lg border bg-white',
                          placed && !expanded && 'border-teal-200',
                          expanded && 'border-teal-500 ring-1 ring-teal-100',
                          !placed && !expanded && 'border-gray-200',
                        )}
                      >
                        {/* Row header */}
                        <button
                          type="button"
                          onClick={() => toggleExpanded(bin)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left"
                        >
                          <Truck className={cn('w-4 h-4 shrink-0', placed || expanded ? 'text-teal-600' : 'text-gray-400')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              Bin #{bin.bin_number}
                              {days != null && days > 0 && (
                                <span className="ml-2 text-[11px] font-normal text-gray-400">in storage {days}d</span>
                              )}
                            </p>
                            {placed && (
                              <p className="text-xs text-teal-700 truncate">→ {placed.destination_address}</p>
                            )}
                          </div>
                          {placed && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDeployment(bin.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeDeployment(bin.id);
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 shrink-0 cursor-pointer"
                              title="Remove destination"
                            >
                              <X className="w-4 h-4" />
                            </span>
                          )}
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </button>

                        {/* Expanded chooser */}
                        {expanded && (
                          <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                            {/* AI suggestions */}
                            {availableSuggestions.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                                  <Sparkles className="w-3 h-3" /> Suggested spots
                                </p>
                                <div className="space-y-1.5">
                                  {availableSuggestions.slice(0, 4).map((c) => (
                                    <div
                                      key={c.id}
                                      className={cn(
                                        'flex items-center gap-2 rounded-md border px-2 py-1.5',
                                        focusedCandidateId === c.id ? 'border-teal-400 bg-teal-50/60' : 'border-gray-200',
                                      )}
                                    >
                                      <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-full px-1.5 py-0.5">
                                        {Math.round(c.score)}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-900 truncate">{c.street || c.address}</p>
                                        <p className="text-[10px] text-gray-400">{c.city} · nearest bin {Math.round(c.nearest_bin_m)} m</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => viewSuggestion(c)}
                                        className="text-gray-400 hover:text-teal-700"
                                        title="View on map"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applySuggestion(c, bin)}
                                        className="text-[11px] font-medium text-teal-700 hover:text-teal-900 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded px-1.5 py-0.5"
                                      >
                                        Use
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Manual placement */}
                            <div>
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                Or place manually
                              </p>
                              <button
                                type="button"
                                onClick={() => setPlacingBin(arming ? null : bin)}
                                className={cn(
                                  'w-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-md border px-2 py-1.5 mb-2',
                                  arming
                                    ? 'border-teal-500 bg-teal-600 text-white'
                                    : 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
                                )}
                              >
                                <Crosshair className="w-3.5 h-3.5" />
                                {arming ? 'Click the map… (cancel)' : 'Click on the map'}
                              </button>
                              <HerePlacesAutocomplete
                                value={addressText}
                                onChange={setAddressText}
                                onPlaceSelect={(place) => handlePlaceSelect(bin, place)}
                                placeholder="Or type an address…"
                                userLocation={warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : undefined}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Map — same setup as the live map (disableDefaultUI, shared layers) */}
            <div className={cn('flex-1 relative', placingBin && 'cursor-crosshair')}>
              <GoogleMap
                mapId="binly-redeployment-picker"
                defaultCenter={center}
                defaultZoom={12}
                minZoom={3}
                maxZoom={20}
                mapTypeId="hybrid"
                gestureHandling="greedy"
                disableDefaultUI={true}
                className="w-full h-full"
                onClick={(e) => {
                  const ll = e.detail.latLng;
                  if (ll) void handleMapClick(ll.lat, ll.lng);
                }}
              >
                <MapController target={focusTarget} />
                <BinMarkersLayer zIndex={1} />
                <ZoneMarkersLayer />
                <WarehouseMarkerLayer />

                {availableSuggestions.map((c) => {
                  const focused = focusedCandidateId === c.id;
                  return (
                    <AdvancedMarker
                      key={c.id}
                      position={{ lat: c.latitude!, lng: c.longitude! }}
                      zIndex={focused ? 55 : 40}
                      onClick={(e) => {
                        e.stop();
                        // With a bin in context (row expanded / click-armed) the pin
                        // assigns directly; otherwise it focuses and opens the popup.
                        const contextBin = placingBin ?? expandedBin;
                        if (contextBin) applySuggestion(c, contextBin);
                        else viewSuggestion(c);
                      }}
                    >
                      <div className="relative cursor-pointer transition-all duration-300 hover:scale-110 animate-scale-in">
                        {focused && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-teal-400 opacity-40 animate-ping" />
                          </div>
                        )}
                        <div className="relative z-10">
                          <CandidatePin score={c.score} />
                        </div>
                        {focused && (
                          <div
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[190px] max-w-[260px] animate-slide-in-up z-50 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs font-semibold text-gray-900">{c.street || c.address}</p>
                            <p className="text-[11px] text-gray-500 mb-1.5">
                              {c.city} · score {Math.round(c.score)} · nearest bin {Math.round(c.nearest_bin_m)} m
                            </p>
                            {markerTargetBin ? (
                              <button
                                type="button"
                                onClick={() => applySuggestion(c, markerTargetBin)}
                                className="w-full text-[11px] font-medium text-white bg-teal-600 hover:bg-teal-700 rounded px-2 py-1"
                              >
                                Use for Bin #{markerTargetBin.bin_number}
                              </button>
                            ) : (
                              <p className="text-[11px] text-gray-400">All bins have destinations</p>
                            )}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
                          </div>
                        )}
                      </div>
                    </AdvancedMarker>
                  );
                })}

                {deployments.map((d) => (
                  <AdvancedMarker
                    key={d.bin_id}
                    position={{ lat: d.destination_latitude, lng: d.destination_longitude }}
                    zIndex={60}
                  >
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-teal-600 text-white text-[11px] font-bold border-2 border-white shadow-lg animate-scale-in">
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
                      Click anywhere on the map to place Bin #{placingBin!.bin_number}
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
