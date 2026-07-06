'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { latLngToCell, cellToBoundary } from 'h3-js';
import { Card } from '@/components/ui/card';
import { Warehouse, MapPin, AlertTriangle } from 'lucide-react';
import { createMoveRequest, MoveRequestConflictError } from '@/lib/api/move-requests';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { getBins } from '@/lib/api/bins';
import type { Bin } from '@/lib/types/bin';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** H3 resolution 8 ≈ 0.7 km² cells — neighborhood-scale for a Bay Area fleet. */
const HEX_RES = 8;

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

/** Quantile color scale: cold blue → warm green for yield density. */
function hexColor(value: number, breaks: number[]): string {
  const palette = ['#dbeafe', '#93c5fd', '#86efac', '#22c55e', '#15803d'];
  let idx = 0;
  for (let i = 0; i < breaks.length; i++) if (value >= breaks[i]) idx = i + 1;
  return palette[Math.min(idx, palette.length - 1)];
}

/**
 * Imperative overlay: @vis.gl/react-google-maps has no Polygon component, so
 * hexes are drawn as google.maps.Polygon instances keyed to the map lifecycle.
 */
function HexLayer({ hexes, breaks, onSelect }: { hexes: HexBucket[]; breaks: number[]; onSelect: (h: HexBucket) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const polys = hexes.map(h => {
      const boundary = cellToBoundary(h.hex); // [[lat, lng], ...]
      const poly = new google.maps.Polygon({
        paths: boundary.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#ffffff',
        strokeWeight: 1,
        strokeOpacity: 0.9,
        fillColor: hexColor(h.yieldPerBinWeek, breaks),
        fillOpacity: 0.55,
        map,
      });
      poly.addListener('click', () => onSelect(h));
      return poly;
    });
    return () => polys.forEach(p => p.setMap(null));
  }, [map, hexes, breaks, onSelect]);
  return null;
}

/**
 * Dashed warehouse → candidate polyline while a candidate is focused; the
 * map pans to fit both ends so the deployment journey reads at a glance.
 */
function ConnectionLine({ from, to }: { from: google.maps.LatLngLiteral; to: google.maps.LatLngLiteral }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      path: [from, to],
      strokeOpacity: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2.5, strokeColor: '#f97316' },
        offset: '0',
        repeat: '14px',
      }],
      map,
    });
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(from);
    bounds.extend(to);
    map.fitBounds(bounds, 80);
    return () => line.setMap(null);
  }, [map, from, to]);
  return null;
}

/**
 * Deploy modal — house pattern (useModalClose + global modal classes) so it
 * gets the same fade+scale and full-page backdrop as every other modal.
 */
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
      onDeployed(`✓ Redeployment move created to ${candidate.street}`);
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
              className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!binId || submitting}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none"
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

export function GrowthView() {
  const { data: binYields = [], isLoading: loadingYields } = useQuery({
    queryKey: ['growth-bin-yield'],
    queryFn: fetchBinYields,
    staleTime: 5 * 60 * 1000,
  });
  const { data: candData, isLoading: loadingCands } = useQuery({
    queryKey: ['growth-candidates'],
    queryFn: fetchCandidates,
    staleTime: 5 * 60 * 1000,
  });
  const { data: allBins = [] } = useQuery({
    queryKey: ['bins-for-deploy'],
    queryFn: () => getBins(),
    staleTime: 5 * 60 * 1000,
  });

  const queryClient = useQueryClient();
  const { data: warehouse } = useWarehouseLocation();
  const [selectedHex, setSelectedHex] = useState<HexBucket | null>(null);
  const [deployFor, setDeployFor] = useState<Candidate | null>(null);
  const [focusCandidate, setFocusCandidate] = useState<Candidate | null>(null);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);

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


  if (loadingYields || loadingCands) {
    return <div className="text-center py-16 text-gray-500">Loading growth data…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Warehouse inventory banner */}
      <Card className="p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Warehouse className="w-4 h-4" />
        </div>
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{candData?.warehouse_available ?? 0} bins</span> in the warehouse ready to
          deploy · <span className="font-semibold">{candidates.length}</span> scored candidate locations
        </p>
        {deployMsg && <span className="text-xs font-medium text-green-700 ml-auto">{deployMsg}</span>}
      </Card>

      {/* Hex yield map */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Yield per Bin-Week by Area</p>
        <p className="text-xs text-gray-500 mb-3">
          H3 hexes (~0.9 km across) shaded by trailing-90-day yield proxy per bin-week — darker green earns more per
          bin. Orange pins are the top-scored candidate locations. Click a hex for details.
        </p>
        <div className="h-[420px] rounded-lg overflow-hidden relative">
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <GoogleMap
                defaultCenter={mapCenter}
                defaultZoom={11}
                mapId="binly-growth"
                disableDefaultUI={false}
                gestureHandling="greedy"
                className="w-full h-full"
              >
                <HexLayer hexes={hexes} breaks={breaks} onSelect={setSelectedHex} />
                {warehouse && (
                  <AdvancedMarker position={{ lat: warehouse.latitude, lng: warehouse.longitude }}>
                    <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow flex items-center justify-center text-white text-xs">🏭</div>
                  </AdvancedMarker>
                )}
                {warehouse && focusCandidate && focusCandidate.latitude != null && focusCandidate.longitude != null && (
                  <ConnectionLine
                    from={{ lat: warehouse.latitude, lng: warehouse.longitude }}
                    to={{ lat: focusCandidate.latitude, lng: focusCandidate.longitude }}
                  />
                )}
                {topCandidates.map(c =>
                  c.latitude != null && c.longitude != null ? (
                    <AdvancedMarker
                      key={c.id}
                      position={{ lat: c.latitude, lng: c.longitude }}
                      onClick={() => setFocusCandidate(prev => (prev?.id === c.id ? null : c))}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center text-[9px] font-bold text-white transition-transform ${
                          c.in_no_go_zone ? 'bg-gray-400' : 'bg-orange-500'
                        } ${focusCandidate?.id === c.id ? 'scale-125 ring-2 ring-orange-300' : ''}`}
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
          {selectedHex && (
            <div className="absolute top-3 left-3 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs max-w-[240px]">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900">{selectedHex.bins.length} bin{selectedHex.bins.length !== 1 ? 's' : ''} in this hex</p>
                <button onClick={() => setSelectedHex(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <p className="text-gray-600">Yield: <span className="font-semibold">{selectedHex.yieldPerBinWeek.toFixed(0)}</span> fill-pts/bin-week</p>
              <p className="text-gray-600">{selectedHex.collections} collections · {selectedHex.incidents} incidents (90d)</p>
              <div className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto">
                {selectedHex.bins.map(b => (
                  <p key={b.id} className="text-gray-500 truncate">
                    #{b.bin_number} · {b.yield_per_bin_week.toFixed(0)} pts/wk · {b.current_street}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Candidate scoring table */}
      <Card className="overflow-x-auto">
        <div className="px-4 pt-4">
          <p className="text-sm font-semibold text-gray-900">Where should the next bins go?</p>
          <p className="text-xs text-gray-500 mb-2">
            Driver-suggested locations scored 0–100: nearby yield (40%) + whitespace (25%) − incident risk (20%) −
            cannibalization (15%). RouteFit and host history land in a later pass.
          </p>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Score</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Location</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Nearby yield</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Whitespace</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Risk / Cannibal.</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Nearest bin</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topCandidates.map(c => (
              <tr
                key={c.id}
                onClick={() => setFocusCandidate(prev => (prev?.id === c.id ? null : c))}
                className={`cursor-pointer transition-colors ${
                  focusCandidate?.id === c.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                } ${c.in_no_go_zone ? 'opacity-50' : ''}`}
              >
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center justify-center w-9 h-6 rounded font-bold text-white ${
                    c.score >= 60 ? 'bg-green-600' : c.score >= 35 ? 'bg-amber-500' : 'bg-gray-400'
                  }`}>{c.score}</span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900 truncate max-w-[220px]">{c.street}</p>
                  <p className="text-gray-500">{c.city}</p>
                  {c.in_no_go_zone && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-medium">
                      <AlertTriangle className="w-3 h-3" /> inside no-go zone
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{(c.yield_prior * 100).toFixed(0)}</td>
                <td className="px-3 py-2 text-gray-700">{(c.gap * 100).toFixed(0)}</td>
                <td className="px-3 py-2 text-gray-700">−{(c.incident_risk * 100).toFixed(0)} / −{(c.cannibalization * 100).toFixed(0)}</td>
                <td className="px-3 py-2 text-gray-700">{c.nearest_bin_m >= 1200 ? '1.2km+' : `${c.nearest_bin_m}m`}</td>
                <td className="px-3 py-2 text-right">
                  {!c.in_no_go_zone && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeployFor(c); setDeployMsg(null); }}
                      className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors focus:outline-none"
                    >
                      Deploy here
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
      </Card>

      {/* Deploy modal (house pattern: fade+scale, full-page backdrop) */}
      {deployFor && (
        <DeployModal
          candidate={deployFor}
          warehouseBins={warehouseBins}
          onClose={() => setDeployFor(null)}
          onDeployed={msg => {
            setDeployMsg(msg);
            // Reactivity: refresh the candidate list + warehouse count so the
            // deployed spot re-scores and the banner updates immediately.
            queryClient.invalidateQueries({ queryKey: ['growth-candidates'] });
            queryClient.invalidateQueries({ queryKey: ['bins-for-deploy'] });
          }}
        />
      )}
    </div>
  );
}
