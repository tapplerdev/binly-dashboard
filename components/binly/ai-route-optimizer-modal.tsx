'use client';

import { useState, useMemo, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  X, Check, Minus, Plus, AlertTriangle, Calendar, Sparkles,
  Loader2, Package, TrendingUp,
} from 'lucide-react';
import { Route } from '@/lib/types/route';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { updateRoute } from '@/lib/api/routes';
import { BinCollectionStats } from '@/lib/api/route-performance';
import { haversine } from '@/lib/utils/geo';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

const ROUTE_COLORS = ['#4880FF', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#EC4899'];

interface Change {
  id: string;
  type: 'remove' | 'add';
  binId: string;
  binNumber: number;
  binStreet: string;
  binCity: string;
  binLat: number;
  binLng: number;
  fillPct: number;
  routeId: string;
  routeName: string;
  reason: string;
  checked: boolean;
  distance?: number;
}

interface Suggestion {
  routeId: string;
  routeName: string;
  message: string;
}

interface AIRouteOptimizerModalProps {
  templates: Route[];
  bins: Bin[];
  binCollectionStats: Record<string, BinCollectionStats>;
  onClose: () => void;
  onApply: () => void;
}

export function AIRouteOptimizerModal({ templates, bins, binCollectionStats, onClose, onApply }: AIRouteOptimizerModalProps) {
  const { data: warehouse } = useWarehouseLocation();
  const [tab, setTab] = useState<'changes' | 'preview' | 'schedule'>('changes');
  const [changes, setChanges] = useState<Change[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applying, setApplying] = useState(false);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [previewView, setPreviewView] = useState<'after' | 'before'>('after');
  const [selectedPreviewRoute, setSelectedPreviewRoute] = useState<string | null>(null);

  const activeBins = useMemo(() =>
    bins.filter(b => (b.status === 'active' || b.status === 'needs_check' || b.status === 'pending_move') && b.latitude && b.longitude),
  [bins]);

  const binById = useMemo(() => {
    const m = new Map<string, Bin>();
    bins.forEach(b => m.set(b.id, b));
    return m;
  }, [bins]);

  // Route centroids
  const routeCentroids = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    templates.forEach(t => {
      const tBins = (t.bin_ids || []).map(id => binById.get(id)).filter((b): b is Bin => !!b && !!b.latitude && !!b.longitude);
      if (tBins.length === 0) return;
      m.set(t.id, {
        lat: tBins.reduce((s, b) => s + b.latitude!, 0) / tBins.length,
        lng: tBins.reduce((s, b) => s + b.longitude!, 0) / tBins.length,
      });
    });
    return m;
  }, [templates, binById]);

  // Analysis
  useMemo(() => {
    if (initialized) return;
    setInitialized(true);

    const proposed: Change[] = [];
    const sugs: Suggestion[] = [];
    let idx = 0;

    // REMOVE: inactive + low performers
    templates.forEach(t => {
      (t.bin_ids || []).forEach(binId => {
        const bin = binById.get(binId);
        if (!bin || bin.status === 'retired' || bin.status === 'missing' || bin.status === 'in_storage') {
          proposed.push({
            id: `c-${idx++}`, type: 'remove', binId,
            binNumber: bin?.bin_number ?? 0, binStreet: bin?.current_street ?? 'Unknown',
            binCity: bin?.city ?? '', binLat: bin?.latitude ?? 0, binLng: bin?.longitude ?? 0,
            fillPct: 0, routeId: t.id, routeName: t.name,
            reason: bin ? `In ${bin.status === 'in_storage' ? 'warehouse' : bin.status}` : 'Bin no longer exists',
            checked: true,
          });
          return;
        }
        const stats = binCollectionStats[binId];
        if (stats && stats.check_count >= 5 && stats.avg_fill < 15) {
          proposed.push({
            id: `c-${idx++}`, type: 'remove', binId,
            binNumber: bin.bin_number, binStreet: bin.current_street, binCity: bin.city,
            binLat: bin.latitude ?? 0, binLng: bin.longitude ?? 0,
            fillPct: Math.round(stats.avg_fill), routeId: t.id, routeName: t.name,
            reason: `Avg ${Math.round(stats.avg_fill)}% fill over ${stats.check_count} checks`,
            checked: true,
          });
        }
      });
    });

    // ADD: uncovered bins
    const coveredIds = new Set<string>();
    templates.forEach(t => (t.bin_ids || []).forEach(id => coveredIds.add(id)));

    activeBins.forEach(bin => {
      if (coveredIds.has(bin.id)) return;
      let nearestRoute: Route | null = null;
      let nearestDist = Infinity;
      templates.forEach(t => {
        const c = routeCentroids.get(t.id);
        if (!c) return;
        const d = haversine(bin.latitude!, bin.longitude!, c.lat, c.lng);
        if (d < nearestDist) { nearestDist = d; nearestRoute = t; }
      });
      if (nearestRoute) {
        proposed.push({
          id: `c-${idx++}`, type: 'add', binId: bin.id,
          binNumber: bin.bin_number, binStreet: bin.current_street, binCity: bin.city,
          binLat: bin.latitude!, binLng: bin.longitude!,
          fillPct: bin.fill_percentage ?? 0, routeId: nearestRoute.id, routeName: nearestRoute.name,
          reason: `${nearestDist.toFixed(1)} mi from route center`,
          checked: true, distance: nearestDist,
        });
      }
    });

    // Suggestions
    const afterCounts = new Map<string, number>();
    templates.forEach(t => {
      let count = (t.bin_ids || []).length;
      proposed.forEach(c => {
        if (c.routeId === t.id && c.checked) count += c.type === 'add' ? 1 : -1;
      });
      afterCounts.set(t.id, count);
    });
    templates.forEach(t => {
      const count = afterCounts.get(t.id) || 0;
      if (count > 30) sugs.push({ routeId: t.id, routeName: t.name, message: `${count} bins — consider splitting into 2 routes` });
      if (count > 0 && count < 5) sugs.push({ routeId: t.id, routeName: t.name, message: `Only ${count} bins — consider merging with nearest route` });
    });

    setChanges(proposed);
    setSuggestions(sugs);
  }, [initialized, templates, binById, binCollectionStats, activeBins, routeCentroids]);

  const toggleChange = useCallback((id: string) => {
    setChanges(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  }, []);

  // Group changes by route
  const changesByRoute = useMemo(() => {
    const m = new Map<string, { route: Route; removes: Change[]; adds: Change[] }>();
    templates.forEach(t => m.set(t.id, { route: t, removes: [], adds: [] }));
    changes.forEach(c => {
      const entry = m.get(c.routeId);
      if (!entry) return;
      if (c.type === 'remove') entry.removes.push(c);
      else entry.adds.push(c);
    });
    return Array.from(m.values()).filter(e => e.removes.length > 0 || e.adds.length > 0);
  }, [changes, templates]);

  // Preview routes
  const previewRoutes = useMemo(() => {
    return templates.map((t, i) => {
      const currentBinIds = new Set(t.bin_ids || []);
      changes.filter(c => c.checked && c.routeId === t.id).forEach(c => {
        if (c.type === 'remove') currentBinIds.delete(c.binId);
        if (c.type === 'add') currentBinIds.add(c.binId);
      });
      const newIds = Array.from(currentBinIds);
      const newBins = newIds.map(id => binById.get(id)).filter((b): b is Bin => !!b && !!b.latitude);
      const avgFill = newBins.length > 0 ? Math.round(newBins.reduce((s, b) => s + (b.fill_percentage ?? 0), 0) / newBins.length) : 0;
      return {
        ...t, newBinIds: newIds, newBins, newBinCount: newIds.length,
        oldBinCount: (t.bin_ids || []).length, delta: newIds.length - (t.bin_ids || []).length,
        avgFill, color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      };
    });
  }, [templates, changes, binById]);

  // Schedule
  const schedule = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routes = previewRoutes.filter(r => r.newBinCount > 0).map(r => ({
      ...r, freq: r.avgFill >= 60 ? 3 : r.avgFill >= 35 ? 2 : 1,
    })).sort((a, b) => b.freq - a.freq);

    const daySlots: typeof routes[number][][] = days.map(() => []);
    routes.forEach(route => {
      const step = Math.max(1, Math.floor(days.length / route.freq));
      for (let i = 0; i < route.freq && i < days.length; i++) {
        const idx = (i * step) % days.length;
        daySlots[idx].push(route);
      }
    });
    return days.map((d, i) => ({ day: d, routes: daySlots[i] }));
  }, [previewRoutes]);

  const totalChecked = changes.filter(c => c.checked).length;
  const checkedRemoves = changes.filter(c => c.checked && c.type === 'remove').length;
  const checkedAdds = changes.filter(c => c.checked && c.type === 'add').length;

  const handleApply = async () => {
    setApplying(true);
    try {
      for (const r of previewRoutes) {
        if (r.delta !== 0) await updateRoute(r.id, { bin_ids: r.newBinIds });
      }
      onApply();
      onClose();
    } catch { alert('Failed to apply some changes.'); }
    finally { setApplying(false); }
  };

  // Map bins for current tab
  const mapBins = useMemo(() => {
    if (tab === 'preview') {
      const route = selectedPreviewRoute ? previewRoutes.find(r => r.id === selectedPreviewRoute) : null;
      if (previewView === 'after' && route) return route.newBins.filter(isMappableBin);
      if (previewView === 'before' && route) {
        return (route.bin_ids || []).map(id => binById.get(id)).filter((b): b is Bin => !!b && isMappableBin(b));
      }
      return activeBins.filter(isMappableBin);
    }
    return activeBins.filter(isMappableBin);
  }, [tab, previewView, selectedPreviewRoute, previewRoutes, activeBins, binById]);

  const removeBinIds = new Set(changes.filter(c => c.checked && c.type === 'remove').map(c => c.binId));
  const addBinIds = new Set(changes.filter(c => c.checked && c.type === 'add').map(c => c.binId));

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full h-[90vh] max-w-7xl flex flex-col overflow-hidden pointer-events-auto">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Route Optimizer
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {checkedRemoves} removal{checkedRemoves !== 1 ? 's' : ''}, {checkedAdds} addition{checkedAdds !== 1 ? 's' : ''} proposed
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(['changes', 'preview', 'schedule'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t === 'changes' ? `Changes (${totalChecked})` : t === 'preview' ? 'Preview' : 'Schedule'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">

            {/* === CHANGES TAB === */}
            {tab === 'changes' && (
              <>
                <div className="w-[420px] border-r border-gray-200 overflow-y-auto shrink-0 p-3 space-y-4">
                  {changesByRoute.length === 0 ? (
                    <div className="text-center py-16">
                      <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 font-medium">Routes are optimized</p>
                    </div>
                  ) : (
                    changesByRoute.map(({ route, removes, adds }) => (
                      <div key={route.id} className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <h4 className="text-sm font-semibold text-gray-900">{route.name}</h4>
                          <p className="text-[10px] text-gray-500">{route.geographic_area}</p>
                        </div>

                        {removes.length > 0 && (
                          <div className="p-2 space-y-1">
                            <p className="text-[10px] font-bold text-red-600 uppercase px-1">Remove ({removes.length})</p>
                            {removes.map(c => (
                              <label key={c.id}
                                onMouseEnter={() => setSelectedBinId(c.binId)}
                                onMouseLeave={() => setSelectedBinId(null)}
                                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                                  c.checked ? 'bg-red-50' : 'opacity-50'
                                } ${selectedBinId === c.binId ? 'ring-2 ring-purple-300' : ''}`}>
                                <input type="checkbox" checked={c.checked} onChange={() => toggleChange(c.id)}
                                  className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                  style={{ backgroundColor: '#ef4444' }}>
                                  {c.binNumber}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 truncate">{c.binStreet}, {c.binCity}</p>
                                  <p className="text-[10px] text-red-600">{c.reason}</p>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500">{c.fillPct}%</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {adds.length > 0 && (
                          <div className="p-2 space-y-1 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-green-600 uppercase px-1">Add ({adds.length})</p>
                            {adds.map(c => (
                              <label key={c.id}
                                onMouseEnter={() => setSelectedBinId(c.binId)}
                                onMouseLeave={() => setSelectedBinId(null)}
                                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                                  c.checked ? 'bg-green-50' : 'opacity-50'
                                } ${selectedBinId === c.binId ? 'ring-2 ring-purple-300' : ''}`}>
                                <input type="checkbox" checked={c.checked} onChange={() => toggleChange(c.id)}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                  style={{ backgroundColor: '#22c55e' }}>
                                  {c.binNumber}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 truncate">{c.binStreet}, {c.binCity}</p>
                                  <p className="text-[10px] text-green-600">{c.distance?.toFixed(1)} mi from route center</p>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500">{c.fillPct}%</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {suggestions.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Suggestions
                      </p>
                      {suggestions.map((s, i) => (
                        <div key={i} className="text-xs text-amber-800">
                          <span className="font-medium">{s.routeName}:</span> {s.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map */}
                <div className="flex-1 relative">
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap mapId="optimizer-changes-map"
                      defaultCenter={warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : DEFAULT_CENTER}
                      defaultZoom={11} mapTypeId="hybrid" disableDefaultUI={false}
                      streetViewControl={false} gestureHandling="greedy"
                      style={{ width: '100%', height: '100%' }}>
                      {mapBins.map(bin => {
                        const isRemove = removeBinIds.has(bin.id);
                        const isAdd = addBinIds.has(bin.id);
                        const isSelected = selectedBinId === bin.id;
                        const fill = bin.fill_percentage ?? 0;
                        return (
                          <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }}
                            zIndex={isSelected ? 20 : isRemove || isAdd ? 15 : 10}>
                            <div className={`rounded-full border-2 shadow-lg flex items-center justify-center transition-all duration-200 ${
                              isSelected ? 'w-10 h-10 ring-4 ring-purple-400/60 animate-pulse border-white'
                                : isRemove ? 'w-9 h-9 border-red-300 ring-2 ring-red-400/40'
                                : isAdd ? 'w-9 h-9 border-green-300 ring-2 ring-green-400/40'
                                : 'w-7 h-7 border-white'
                            }`}
                              style={{ backgroundColor: isRemove ? '#ef4444' : isAdd ? '#22c55e' : getBinMarkerColor(fill, bin.status) }}>
                              <span className={`font-bold text-white ${isSelected || isRemove || isAdd ? 'text-[11px]' : 'text-[9px]'}`}>
                                {bin.bin_number}
                              </span>
                            </div>
                          </AdvancedMarker>
                        );
                      })}
                    </GoogleMap>
                  </APIProvider>
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow px-3 py-2 flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 border border-white shadow" /> Removing</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 border border-white shadow" /> Adding</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow" /> Existing</span>
                  </div>
                </div>
              </>
            )}

            {/* === PREVIEW TAB === */}
            {tab === 'preview' && (
              <>
                <div className="w-[420px] border-r border-gray-200 overflow-y-auto shrink-0">
                  {/* Summary */}
                  <div className="p-4 bg-purple-50 border-b border-purple-100">
                    <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4" /> Optimization Summary
                    </h3>
                    <p className="text-xs text-purple-700 leading-relaxed">
                      {checkedRemoves > 0 ? `Removing ${checkedRemoves} underperforming/inactive bins. ` : ''}
                      {checkedAdds > 0 ? `Adding ${checkedAdds} uncovered bins to nearest routes. ` : ''}
                      {totalChecked > 0 ? 'This improves coverage and eliminates wasted stops.' : 'No changes selected.'}
                    </p>
                  </div>

                  {/* Before/After toggle */}
                  <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                    <button onClick={() => setPreviewView('after')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        previewView === 'after' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
                      }`}>After</button>
                    <button onClick={() => setPreviewView('before')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        previewView === 'before' ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
                      }`}>Before</button>
                  </div>

                  {/* Route cards */}
                  <div className="p-3 space-y-2">
                    {previewRoutes.map((r, i) => (
                      <button key={r.id} onClick={() => setSelectedPreviewRoute(selectedPreviewRoute === r.id ? null : r.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-all ${
                          selectedPreviewRoute === r.id ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">{r.name}</h4>
                              {r.delta !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  r.delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>{r.delta > 0 ? '+' : ''}{r.delta}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                              <span>{previewView === 'after' ? r.newBinCount : r.oldBinCount} bins</span>
                              <span>{r.avgFill}% avg fill</span>
                              <span className="text-gray-400">{r.geographic_area}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative">
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap mapId="optimizer-preview-map"
                      defaultCenter={warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : DEFAULT_CENTER}
                      defaultZoom={11} mapTypeId="hybrid" disableDefaultUI={false}
                      streetViewControl={false} gestureHandling="greedy"
                      style={{ width: '100%', height: '100%' }}>
                      {(() => {
                        const route = selectedPreviewRoute ? previewRoutes.find(r => r.id === selectedPreviewRoute) : null;
                        const binsToShow = route
                          ? (previewView === 'after' ? route.newBins : (route.bin_ids || []).map(id => binById.get(id)).filter((b): b is Bin => !!b))
                              .filter(isMappableBin)
                          : activeBins.filter(isMappableBin);

                        return binsToShow.map(bin => (
                          <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }} zIndex={10}>
                            <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                              style={{ backgroundColor: route ? route.color : getBinMarkerColor(bin.fill_percentage, bin.status) }}>
                              <span className="text-[10px] font-bold text-white">{bin.bin_number}</span>
                            </div>
                          </AdvancedMarker>
                        ));
                      })()}
                    </GoogleMap>
                  </APIProvider>
                </div>
              </>
            )}

            {/* === SCHEDULE TAB === */}
            {tab === 'schedule' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5 mb-1.5">
                      <Calendar className="w-4 h-4" /> Recommended Weekly Schedule
                    </h3>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Routes with higher average fill rates are scheduled more frequently to prevent overflow.
                      Lower-fill routes run less often to optimize driver time. Adjust as needed for your operations.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {schedule.map(day => (
                      <div key={day.day} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <h4 className="text-xs font-bold text-gray-700">{day.day}</h4>
                        </div>
                        <div className="p-2">
                          {day.routes.length === 0 ? (
                            <p className="text-[11px] text-gray-400 px-1 py-2">No routes</p>
                          ) : (
                            <div className="space-y-1.5">
                              {day.routes.map((r, i) => (
                                <div key={i} className="rounded px-2.5 py-2 border-l-[3px]" style={{ borderColor: r.color, backgroundColor: `${r.color}08` }}>
                                  <p className="text-xs font-medium text-gray-900 truncate">{r.name}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                    <span>{r.newBinCount} bins</span>
                                    <span>{r.avgFill}% fill</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 flex items-center justify-between">
            <p className="text-sm text-gray-500">{totalChecked} change{totalChecked !== 1 ? 's' : ''} selected</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={handleApply} disabled={totalChecked === 0 || applying}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Apply {totalChecked} Change{totalChecked !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
