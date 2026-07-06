'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { latLngToCell, cellToBoundary } from 'h3-js';
import { Card } from '@/components/ui/card';
import { Toast } from '@/components/ui/toast';
import { Warehouse, MapPin, AlertTriangle, Hexagon, X } from 'lucide-react';
import { createMoveRequest, MoveRequestConflictError } from '@/lib/api/move-requests';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { WarehouseMarkerLayer } from '@/components/binly/map-layers';
import { getBins } from '@/lib/api/bins';
import type { Bin } from '@/lib/types/bin';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** H3 resolution 8 ≈ 0.7 km² cells — neighborhood-scale for a Bay Area fleet. */
const HEX_RES = 8;

/** Quantile palette for the yield choropleth (cold blue → strong green). */
const YIELD_PALETTE = ['#dbeafe', '#93c5fd', '#86efac', '#22c55e', '#15803d'];

interface BinYield {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  collections_90d: number;
  yield_proxy_90d: number;
  incidents_90d: number;
  days_active_90d: number;
  yield_per_bin_week: number;
}

interface Candidate {
  id: string;
  address: string;
  street: string;
  city: string;
  zip?: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
  yield_prior: number;
  gap: number;
  incident_risk: number;
  cannibalization: number;
  in_no_go_zone: boolean;
  nearest_bin_m: number;
}

interface HexBucket {
  hex: string;
  bins: BinYield[];
  yieldPerBinWeek: number; // Σ yield / Σ bin-weeks
  collections: number;
  incidents: number;
}

async function fetchBinYields(): Promise<BinYield[]> {
  const r = await fetch(`${API_BASE_URL}/api/analytics/growth/bin-yield`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch bin yields');
  return (await r.json()).data ?? [];
}

async function fetchCandidates(): Promise<{ candidates: Candidate[]; warehouse_available: number }> {
  const r = await fetch(`${API_BASE_URL}/api/analytics/growth/candidates`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch candidates');
  return (await r.json()).data;
}

function hexColor(value: number, breaks: number[]): string {
  let idx = 0;
  for (let i = 0; i < breaks.length; i++) if (value >= breaks[i]) idx = i + 1;
  return YIELD_PALETTE[Math.min(idx, YIELD_PALETTE.length - 1)];
}

/** ONE score encoding shared by pins and table chips — same score, same color. */
function scoreTier(c: Candidate): string {
  return c.in_no_go_zone ? 'bg-gray-400' : c.score >= 60 ? 'bg-green-600' : c.score >= 35 ? 'bg-amber-500' : 'bg-gray-400';
}

/**
 * Imperative hex overlay (no Polygon component in @vis.gl). Hover feedback +
 * selected-hex highlight are wired here so "click a hex" is discoverable.
 */
function HexLayer({
  hexes,
  breaks,
  selectedHexId,
  onSelect,
}: {
  hexes: HexBucket[];
  breaks: number[];
  selectedHexId: string | null;
  onSelect: (h: HexBucket) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const polys = hexes.map(h => {
      const isSelected = h.hex === selectedHexId;
      const boundary = cellToBoundary(h.hex); // [[lat, lng], ...]
      const poly = new google.maps.Polygon({
        paths: boundary.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: isSelected ? '#4880FF' : '#ffffff',
        strokeWeight: isSelected ? 2.5 : 1,
        strokeOpacity: 0.9,
        fillColor: hexColor(h.yieldPerBinWeek, breaks),
        fillOpacity: isSelected ? 0.7 : 0.55,
        map,
      });
      poly.addListener('click', () => onSelect(h));
      poly.addListener('mouseover', () => poly.setOptions({ fillOpacity: 0.75, strokeWeight: 2 }));
      poly.addListener('mouseout', () =>
        poly.setOptions({ fillOpacity: isSelected ? 0.7 : 0.55, strokeWeight: isSelected ? 2.5 : 1 }),
      );
      return poly;
    });
    return () => polys.forEach(p => p.setMap(null));
  }, [map, hexes, breaks, selectedHexId, onSelect]);
  return null;
}

/**
 * Dashed warehouse → candidate polyline. Deps are primitives so the line
 * doesn't rebuild on unrelated renders, and the bounds fit fires once per
 * focused candidate (keyed on fitKey), not on every state change.
 */
function ConnectionLine({
  fromLat,
  fromLng,
  toLat,
  toLng,
  fitKey,
}: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fitKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      path: [
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
      ],
      strokeOpacity: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2.5, strokeColor: '#f97316' },
        offset: '0',
        repeat: '14px',
      }],
      map,
    });
    return () => line.setMap(null);
  }, [map, fromLat, fromLng, toLat, toLng]);

  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: fromLat, lng: fromLng });
    bounds.extend({ lat: toLat, lng: toLng });
    map.fitBounds(bounds, 80);
    // Fit once per focused candidate only — refitting on every render yanks the zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

/** Deploy modal — house pattern (useModalClose + global modal classes). */
function DeployModal({
  candidate,
  warehouseBins,
  onClose,
  onDeployed,
}: {
  candidate: Candidate;
  warehouseBins: Bin[];
  onClose: () => void;
  onDeployed: (msg: string) => void;
}) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const [binId, setBinId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!binId) return;
    setSubmitting(true);
    setErr(null);
    try {
      await createMoveRequest({
        bin_id: binId,
        move_type: 'redeployment',
        scheduled_date: Math.floor(Date.now() / 1000) + 3 * 86400,
        reason_category: 'relocation_request',
        new_street: candidate.street,
        new_city: candidate.city,
        new_zip: candidate.zip || '',
        new_latitude: candidate.latitude ?? undefined,
        new_longitude: candidate.longitude ?? undefined,
        notes: `Growth candidate (score ${candidate.score}/100): ${candidate.address}`,
      });
      onDeployed(`Redeployment move created to ${candidate.street}`);
      handleClose();
    } catch (e) {
      setErr(
        e instanceof MoveRequestConflictError
          ? 'That bin already has an open move — pick another.'
          : 'Failed to create the move request.',
      );
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-sm">
          <div className="p-5">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              Deploy a warehouse bin to {candidate.street}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Score {candidate.score}/100 · {candidate.city} · creates a redeployment move you can assign to a shift.
            </p>
            <select
              value={binId}
              onChange={e => setBinId(e.target.value)}
              className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Choose a warehouse bin…</option>
              {warehouseBins.map(b => (
                <option key={b.id} value={b.id}>Bin #{b.bin_number}</option>
              ))}
            </select>
            {warehouseBins.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">No bins in the warehouse right now.</p>
            )}
            {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!binId || submitting}
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {submitting ? 'Creating…' : 'Create redeployment move'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const HEX_TIERS = [
  { label: 'Bottom 20%', chip: 'bg-blue-50 text-blue-700' },
  { label: 'Below average', chip: 'bg-blue-50 text-blue-600' },
  { label: 'Average', chip: 'bg-green-50 text-green-700' },
  { label: 'Above average', chip: 'bg-green-100 text-green-700' },
  { label: 'Top 20%', chip: 'bg-green-600 text-white' },
];

export function GrowthView() {
  const queryClient = useQueryClient();
  const { data: warehouse } = useWarehouseLocation();
  const { data: binYields = [], isLoading: loadingYields, error: yieldsError } = useQuery({
    queryKey: ['growth-bin-yield'],
    queryFn: fetchBinYields,
    staleTime: 5 * 60 * 1000,
  });
  const { data: candData, isLoading: loadingCands, error: candsError } = useQuery({
    queryKey: ['growth-candidates'],
    queryFn: fetchCandidates,
    staleTime: 5 * 60 * 1000,
  });
  const { data: allBins = [] } = useQuery({
    queryKey: ['bins-for-deploy'],
    queryFn: () => getBins(),
    staleTime: 5 * 60 * 1000,
  });

  const [selectedHex, setSelectedHex] = useState<HexBucket | null>(null);
  const [deployFor, setDeployFor] = useState<Candidate | null>(null);
  // Focus is stored as an id and DERIVED to an object so it survives refetches
  // and self-clears when the candidate is converted away.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const warehouseBins = useMemo(
    () => (allBins as Bin[]).filter(b => b.status === 'in_storage'),
    [allBins],
  );

  const hexes = useMemo<HexBucket[]>(() => {
    const byHex = new Map<string, BinYield[]>();
    binYields.forEach(b => {
      if (b.latitude == null || b.longitude == null) return;
      const cell = latLngToCell(b.latitude, b.longitude, HEX_RES);
      const arr = byHex.get(cell) ?? [];
      arr.push(b);
      byHex.set(cell, arr);
    });
    return Array.from(byHex.entries()).map(([hex, bins]) => {
      const binWeeks = bins.reduce((s, b) => s + b.days_active_90d / 7, 0);
      return {
        hex,
        bins,
        yieldPerBinWeek: binWeeks > 0 ? bins.reduce((s, b) => s + b.yield_proxy_90d, 0) / binWeeks : 0,
        collections: bins.reduce((s, b) => s + b.collections_90d, 0),
        incidents: bins.reduce((s, b) => s + b.incidents_90d, 0),
      };
    });
  }, [binYields]);

  const breaks = useMemo(() => {
    const vals = hexes.map(h => h.yieldPerBinWeek).sort((a, b) => a - b);
    if (vals.length === 0) return [0, 0, 0, 0];
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
    return [q(0.2), q(0.4), q(0.6), q(0.8)];
  }, [hexes]);

  const mapCenter = useMemo(() => {
    const pts = binYields.filter(b => b.latitude != null && b.longitude != null);
    if (pts.length === 0) return { lat: 37.33, lng: -121.89 };
    return {
      lat: pts.reduce((s, b) => s + (b.latitude as number), 0) / pts.length,
      lng: pts.reduce((s, b) => s + (b.longitude as number), 0) / pts.length,
    };
  }, [binYields]);

  const candidates = candData?.candidates ?? [];
  const topCandidates = candidates.slice(0, 15);
  const focusCandidate = useMemo(
    () => candidates.find(c => c.id === focusId) ?? null,
    [candidates, focusId],
  );
  const maxBinYield = useMemo(
    () => (selectedHex ? Math.max(...selectedHex.bins.map(b => b.yield_per_bin_week), 1) : 1),
    [selectedHex],
  );

  const toggleFocus = (c: Candidate, scrollRow = false) => {
    setFocusId(prev => (prev === c.id ? null : c.id));
    if (scrollRow) rowRefs.current[c.id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  if (loadingYields || loadingCands) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 h-[600px] rounded-2xl bg-gray-100 animate-pulse" />
        <div className="xl:col-span-2 h-[600px] rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }
  if (yieldsError || candsError) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-600">Failed to load growth data.</p>
        <p className="text-xs text-gray-400 mt-1">Check the analytics endpoints and try again.</p>
      </Card>
    );
  }

  const hexTier = selectedHex
    ? HEX_TIERS[Math.min(breaks.filter(b => selectedHex.yieldPerBinWeek >= b).length, HEX_TIERS.length - 1)]
    : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch xl:h-[clamp(480px,62vh,680px)]">
      {/* ── Map card (60%) ─────────────────────────────────────────── */}
      <Card className="p-4 xl:col-span-3 flex flex-col">
        <div className="shrink-0 mb-3">
          <p className="text-sm font-semibold text-gray-900">Yield per Bin-Week by Area</p>
          <p className="text-xs text-gray-500">
            H3 hexes (~0.9 km across), trailing 90 days. Pins are candidate locations colored by score. Click a hex or
            a candidate.
          </p>
        </div>
        <div className="flex-1 h-[420px] xl:h-auto rounded-lg overflow-hidden relative">
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <GoogleMap
                defaultCenter={mapCenter}
                defaultZoom={11}
                mapId="binly-growth"
                disableDefaultUI
                gestureHandling="greedy"
                className="w-full h-full"
                onClick={() => setFocusId(null)}
              >
                <HexLayer hexes={hexes} breaks={breaks} selectedHexId={selectedHex?.hex ?? null} onSelect={setSelectedHex} />
                <WarehouseMarkerLayer />
                {warehouse && focusCandidate && focusCandidate.latitude != null && focusCandidate.longitude != null && (
                  <ConnectionLine
                    fromLat={warehouse.latitude}
                    fromLng={warehouse.longitude}
                    toLat={focusCandidate.latitude}
                    toLng={focusCandidate.longitude}
                    fitKey={focusCandidate.id}
                  />
                )}
                {topCandidates.map((c, idx) =>
                  c.latitude != null && c.longitude != null ? (
                    <AdvancedMarker
                      key={c.id}
                      position={{ lat: c.latitude, lng: c.longitude }}
                      zIndex={focusId === c.id ? 15 : 10}
                      onClick={() => toggleFocus(c, true)}
                    >
                      <div
                        className={`rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-white cursor-pointer transition-card hover:scale-110 ${
                          idx < 3 ? 'w-8 h-8 text-[11px]' : 'w-6 h-6 text-[9px]'
                        } ${scoreTier(c)} ${
                          focusId === c.id
                            ? 'scale-125 ring-2 ring-[#4880FF] ring-offset-1'
                            : hoverId === c.id
                              ? 'scale-110 ring-2 ring-gray-300'
                              : ''
                        }`}
                      >
                        {c.score}
                      </div>
                    </AdvancedMarker>
                  ) : null,
                )}
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm bg-gray-50">
              Google Maps API key not configured
            </div>
          )}

          {/* Legend — decode the greens + pin colors */}
          <div className="absolute bottom-4 left-3 bg-white/95 backdrop-blur-md rounded-xl card-shadow border border-gray-200 px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-500 mb-1">Yield per bin-week (90d)</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 tabular-nums">0</span>
              <div className="flex rounded-full overflow-hidden">
                {YIELD_PALETTE.map(c => (
                  <div key={c} className="w-6 h-2.5" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums">{breaks[3]?.toFixed(0)}+</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-100">
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-green-600 border border-white shadow-sm" /> Strong candidate
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white shadow-sm" /> Moderate
              </span>
            </div>
          </div>

          {/* Hex detail popover */}
          {selectedHex && hexTier && (
            <div className="absolute top-3 left-3 w-72 bg-white/95 backdrop-blur-md rounded-2xl card-shadow-hover border border-gray-100 overflow-hidden">
              <div className="flex items-start justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                    <Hexagon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {selectedHex.bins.length} bin{selectedHex.bins.length !== 1 ? 's' : ''} in this area
                    </p>
                    <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${hexTier.chip}`}>
                      {hexTier.label} yield
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedHex(null)}
                  className="p-1 -m-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-fast focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { v: String(Math.round(selectedHex.yieldPerBinWeek)), l: 'pts / bin-wk', warn: false },
                  { v: String(selectedHex.collections), l: 'collections', warn: false },
                  { v: String(selectedHex.incidents), l: 'incidents', warn: selectedHex.incidents > 0 },
                ].map(s => (
                  <div key={s.l} className="px-3 py-2 text-center">
                    <p className={`text-base font-bold ${s.warn ? 'text-red-600' : 'text-gray-900'}`}>{s.v}</p>
                    <p className="text-[10px] text-gray-400">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-36 overflow-y-auto py-1">
                {[...selectedHex.bins]
                  .sort((a, b) => b.yield_per_bin_week - a.yield_per_bin_week)
                  .map(b => (
                    <div key={b.id} className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-fast">
                      <span className="text-xs font-semibold text-gray-700 w-9 shrink-0">#{b.bin_number}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(100, (b.yield_per_bin_week / maxBinYield) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 w-12 text-right tabular-nums">
                        {b.yield_per_bin_week.toFixed(0)} pts
                      </span>
                    </div>
                  ))}
              </div>
              <p className="px-4 pb-2.5 pt-1 text-[10px] text-gray-400">Trailing 90 days</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Candidate table card (40%, internally scrolling) ──────────── */}
      <Card className="xl:col-span-2 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 shrink-0">
          <p className="text-sm font-semibold text-gray-900">Where should the next bins go?</p>
          <div className="flex items-center gap-2 mt-1.5 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
              <Warehouse className="w-3 h-3" /> {warehouseBins.length} ready to deploy
            </span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
              {candidates.length} candidates scored
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> nearby yield</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400" /> whitespace</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-300" /> incident risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-300" /> cannibalization</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Score</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Location</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Why</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Nearest</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topCandidates.map(c => (
                <tr
                  key={c.id}
                  ref={el => { rowRefs.current[c.id] = el; }}
                  onClick={() => toggleFocus(c)}
                  onMouseEnter={() => setHoverId(c.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={`cursor-pointer transition-colors ${
                    focusId === c.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                  } ${c.in_no_go_zone ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center justify-center w-9 h-6 rounded-lg font-bold text-white ${scoreTier(c)}`}>
                      {c.score}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900 truncate max-w-[150px]">{c.street}</p>
                    <p className="text-gray-500">{c.city}</p>
                    {c.in_no_go_zone && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-medium">
                        <AlertTriangle className="w-3 h-3" /> inside no-go zone
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 w-32">
                    <div
                      className="flex h-2 rounded-full overflow-hidden bg-gray-100"
                      title={
                        `Nearby yield +${(c.yield_prior * 40).toFixed(0)} · Whitespace +${(c.gap * 25).toFixed(0)} · ` +
                        `Incident risk −${(c.incident_risk * 20).toFixed(0)} · Cannibalization −${(c.cannibalization * 15).toFixed(0)}`
                      }
                    >
                      <div className="bg-green-500" style={{ width: `${c.yield_prior * 40}%` }} />
                      <div className="bg-blue-400" style={{ width: `${c.gap * 25}%` }} />
                      <div className="bg-red-300" style={{ width: `${c.incident_risk * 20}%` }} />
                      <div className="bg-orange-300" style={{ width: `${c.cannibalization * 15}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                      +{(c.yield_prior * 40 + c.gap * 25).toFixed(0)} / −{(c.incident_risk * 20 + c.cannibalization * 15).toFixed(0)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.nearest_bin_m < 200
                          ? 'bg-red-50 text-red-600'
                          : c.nearest_bin_m < 500
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {c.nearest_bin_m >= 1200 ? '1.2km+' : `${c.nearest_bin_m}m`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!c.in_no_go_zone && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeployFor(c);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        Deploy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topCandidates.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">
              No unconverted potential locations to score — drivers suggest candidates from the app.
            </p>
          )}
        </div>
      </Card>

      {/* Deploy modal */}
      {deployFor && (
        <DeployModal
          candidate={deployFor}
          warehouseBins={warehouseBins}
          onClose={() => setDeployFor(null)}
          onDeployed={msg => {
            setToastMsg(msg);
            queryClient.invalidateQueries({ queryKey: ['growth-candidates'] });
            queryClient.invalidateQueries({ queryKey: ['bins-for-deploy'] });
          }}
        />
      )}

      {toastMsg && <Toast message={toastMsg} type="success" onClose={() => setToastMsg(null)} />}
    </div>
  );
}
