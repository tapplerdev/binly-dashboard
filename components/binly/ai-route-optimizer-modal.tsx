'use client';

import { useState, useMemo, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  X, Check, Minus, Plus, AlertTriangle, Calendar, Sparkles,
  Loader2, Package, Clock, TrendingUp, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Route } from '@/lib/types/route';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { updateRoute } from '@/lib/api/routes';
import { BinCollectionStats } from '@/lib/api/route-performance';
import { haversine } from '@/lib/utils/geo';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

interface Change {
  id: string;
  type: 'remove' | 'add' | 'suggestion';
  binId?: string;
  binNumber?: number;
  binStreet?: string;
  binCity?: string;
  routeId: string;
  routeName: string;
  reason: string;
  checked: boolean;
  distance?: number; // miles from route center
}

interface ScheduleDay {
  day: string;
  routes: { name: string; binCount: number; avgFillRate: number }[];
}

interface AIRouteOptimizerModalProps {
  templates: Route[];
  bins: Bin[];
  binCollectionStats: Record<string, BinCollectionStats>;
  onClose: () => void;
  onApply: () => void; // refresh templates after applying
}

export function AIRouteOptimizerModal({ templates, bins, binCollectionStats, onClose, onApply }: AIRouteOptimizerModalProps) {
  const { data: warehouse } = useWarehouseLocation();
  const [tab, setTab] = useState<'changes' | 'preview' | 'schedule'>('changes');
  const [changes, setChanges] = useState<Change[]>([]);
  const [applying, setApplying] = useState(false);
  const [hoveredChangeId, setHoveredChangeId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Active bins only
  const activeBins = useMemo(() =>
    bins.filter(b => b.status === 'active' || b.status === 'needs_check' || b.status === 'pending_move'),
  [bins]);

  // Compute route centroids
  const routeCentroids = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    templates.forEach(t => {
      const tBins = (t.bin_ids || [])
        .map(id => bins.find(b => b.id === id))
        .filter((b): b is Bin => b !== undefined && b.latitude != null && b.longitude != null);
      if (tBins.length === 0) return;
      const avgLat = tBins.reduce((s, b) => s + b.latitude!, 0) / tBins.length;
      const avgLng = tBins.reduce((s, b) => s + b.longitude!, 0) / tBins.length;
      map.set(t.id, { lat: avgLat, lng: avgLng });
    });
    return map;
  }, [templates, bins]);

  // Run analysis on mount
  useMemo(() => {
    if (initialized) return;
    setInitialized(true);

    const proposed: Change[] = [];
    let changeIdx = 0;

    // 1a: Find bins to REMOVE
    templates.forEach(t => {
      (t.bin_ids || []).forEach(binId => {
        const bin = bins.find(b => b.id === binId);

        // Inactive bins (retired, missing, in_storage)
        if (!bin || bin.status === 'retired' || bin.status === 'missing' || bin.status === 'in_storage') {
          const status = bin?.status || 'deleted';
          proposed.push({
            id: `change-${changeIdx++}`,
            type: 'remove',
            binId,
            binNumber: bin?.bin_number,
            binStreet: bin?.current_street,
            binCity: bin?.city,
            routeId: t.id,
            routeName: t.name,
            reason: `Status: ${status}`,
            checked: true,
          });
          return;
        }

        // Low performers
        const stats = binCollectionStats[binId];
        if (stats && stats.check_count >= 5 && stats.avg_fill < 15) {
          proposed.push({
            id: `change-${changeIdx++}`,
            type: 'remove',
            binId,
            binNumber: bin.bin_number,
            binStreet: bin.current_street,
            binCity: bin.city,
            routeId: t.id,
            routeName: t.name,
            reason: `Avg ${Math.round(stats.avg_fill)}% fill over ${stats.check_count} checks — low performer`,
            checked: true,
          });
        }
      });
    });

    // 1b: Find bins to ADD (uncovered)
    const coveredIds = new Set<string>();
    templates.forEach(t => (t.bin_ids || []).forEach(id => coveredIds.add(id)));

    activeBins.forEach(bin => {
      if (coveredIds.has(bin.id)) return;
      if (!bin.latitude || !bin.longitude) return;

      // Find nearest route
      let nearestRoute: Route | null = null;
      let nearestDist = Infinity;
      templates.forEach(t => {
        const centroid = routeCentroids.get(t.id);
        if (!centroid) return;
        const dist = haversine(bin.latitude!, bin.longitude!, centroid.lat, centroid.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestRoute = t;
        }
      });

      if (nearestRoute) {
        proposed.push({
          id: `change-${changeIdx++}`,
          type: 'add',
          binId: bin.id,
          binNumber: bin.bin_number,
          binStreet: bin.current_street,
          binCity: bin.city,
          routeId: nearestRoute.id,
          routeName: nearestRoute.name,
          reason: `Nearest route center (${nearestDist.toFixed(1)} mi) — currently uncovered`,
          checked: true,
          distance: nearestDist,
        });
      }
    });

    // 1c: Suggestions (compute after add/remove)
    const afterCounts = new Map<string, number>();
    templates.forEach(t => {
      let count = (t.bin_ids || []).length;
      proposed.forEach(c => {
        if (c.routeId === t.id && c.type === 'remove' && c.checked) count--;
        if (c.routeId === t.id && c.type === 'add' && c.checked) count++;
      });
      afterCounts.set(t.id, count);
    });

    templates.forEach(t => {
      const count = afterCounts.get(t.id) || 0;
      if (count > 30) {
        proposed.push({
          id: `change-${changeIdx++}`,
          type: 'suggestion',
          routeId: t.id,
          routeName: t.name,
          reason: `${count} bins after changes — consider splitting into 2 routes`,
          checked: false,
        });
      }
      if (count > 0 && count < 5) {
        proposed.push({
          id: `change-${changeIdx++}`,
          type: 'suggestion',
          routeId: t.id,
          routeName: t.name,
          reason: `Only ${count} bins — consider merging with nearest route`,
          checked: false,
        });
      }
    });

    setChanges(proposed);
  }, [initialized, templates, bins, activeBins, binCollectionStats, routeCentroids]);

  // Toggle a change
  const toggleChange = useCallback((id: string) => {
    setChanges(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  }, []);

  // Compute preview (routes after applying checked changes)
  const previewRoutes = useMemo(() => {
    return templates.map(t => {
      const currentBinIds = new Set(t.bin_ids || []);
      const checkedChanges = changes.filter(c => c.checked && c.routeId === t.id);

      checkedChanges.forEach(c => {
        if (c.type === 'remove' && c.binId) currentBinIds.delete(c.binId);
        if (c.type === 'add' && c.binId) currentBinIds.add(c.binId);
      });

      const newBinIds = Array.from(currentBinIds);
      const newBins = newBinIds
        .map(id => activeBins.find(b => b.id === id))
        .filter((b): b is Bin => b !== undefined);
      const avgFill = newBins.length > 0
        ? Math.round(newBins.reduce((s, b) => s + (b.fill_percentage ?? 0), 0) / newBins.length)
        : 0;
      const delta = newBinIds.length - (t.bin_ids || []).length;

      return {
        ...t,
        newBinIds,
        newBinCount: newBinIds.length,
        oldBinCount: (t.bin_ids || []).length,
        delta,
        avgFill,
      };
    });
  }, [templates, changes, activeBins]);

  // Schedule recommendation
  const schedule = useMemo((): ScheduleDay[] => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routeSchedules: { name: string; binCount: number; avgFillRate: number; frequency: number }[] = [];

    previewRoutes.forEach(r => {
      if (r.newBinCount === 0) return;
      const routeBins = r.newBinIds
        .map(id => activeBins.find(b => b.id === id))
        .filter((b): b is Bin => b !== undefined);
      const avgRate = routeBins.length > 0
        ? routeBins.reduce((s, b) => s + (b.fill_percentage ?? 0), 0) / routeBins.length
        : 0;

      // Higher avg fill → more frequent
      const freq = avgRate >= 60 ? 2 : avgRate >= 35 ? 3 : 5;
      routeSchedules.push({ name: r.name, binCount: r.newBinCount, avgFillRate: Math.round(avgRate), frequency: freq });
    });

    // Distribute routes across days
    routeSchedules.sort((a, b) => a.frequency - b.frequency);
    const dayAssignments: ScheduleDay[] = days.map(d => ({ day: d, routes: [] }));

    routeSchedules.forEach(route => {
      // Assign to days evenly spaced
      const step = Math.max(1, Math.floor(days.length / Math.min(route.frequency, days.length)));
      for (let i = 0; i < Math.min(route.frequency, days.length); i++) {
        const dayIdx = (i * step) % days.length;
        // Find the day with fewest routes near this index
        let bestIdx = dayIdx;
        let bestCount = Infinity;
        for (let j = Math.max(0, dayIdx - 1); j <= Math.min(days.length - 1, dayIdx + 1); j++) {
          if (dayAssignments[j].routes.length < bestCount) {
            bestCount = dayAssignments[j].routes.length;
            bestIdx = j;
          }
        }
        dayAssignments[bestIdx].routes.push({
          name: route.name,
          binCount: route.binCount,
          avgFillRate: route.avgFillRate,
        });
      }
    });

    return dayAssignments;
  }, [previewRoutes, activeBins]);

  // Summary stats
  const checkedRemoves = changes.filter(c => c.checked && c.type === 'remove').length;
  const checkedAdds = changes.filter(c => c.checked && c.type === 'add').length;
  const suggestions = changes.filter(c => c.type === 'suggestion');
  const totalChanges = checkedRemoves + checkedAdds;

  // Apply changes
  const handleApply = async () => {
    setApplying(true);
    try {
      for (const route of previewRoutes) {
        if (route.delta !== 0) {
          await updateRoute(route.id, { bin_ids: route.newBinIds });
        }
      }
      onApply();
      onClose();
    } catch (err) {
      console.error('Failed to apply changes:', err);
      alert('Failed to apply some changes. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  // Map markers
  const mappableBins = activeBins.filter(isMappableBin);
  const removeBinIds = new Set(changes.filter(c => c.checked && c.type === 'remove').map(c => c.binId));
  const addBinIds = new Set(changes.filter(c => c.checked && c.type === 'add').map(c => c.binId));

  // Find hovered bin for map zoom
  const hoveredChange = changes.find(c => c.id === hoveredChangeId);
  const hoveredBin = hoveredChange?.binId ? bins.find(b => b.id === hoveredChange.binId) : null;

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
                {totalChanges > 0
                  ? `${checkedRemoves} removals, ${checkedAdds} additions proposed`
                  : 'Analyzing your routes...'}
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(['changes', 'preview', 'schedule'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'changes' ? `Changes (${totalChanges})` : t === 'preview' ? 'Preview' : 'Schedule'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {tab === 'changes' && (
              <>
                {/* Left: Change list */}
                <div className="w-[420px] border-r border-gray-200 overflow-y-auto shrink-0">
                  {changes.length === 0 ? (
                    <div className="text-center py-16">
                      <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 font-medium">Routes are optimized</p>
                      <p className="text-xs text-gray-400 mt-1">No changes recommended</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {/* Removes */}
                      {changes.filter(c => c.type === 'remove').length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Minus className="w-3.5 h-3.5" />
                            Remove ({changes.filter(c => c.type === 'remove').length})
                          </h3>
                          <div className="space-y-1.5">
                            {changes.filter(c => c.type === 'remove').map(c => (
                              <label
                                key={c.id}
                                onMouseEnter={() => setHoveredChangeId(c.id)}
                                onMouseLeave={() => setHoveredChangeId(null)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  c.checked ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white opacity-60'
                                } ${hoveredChangeId === c.id ? 'ring-2 ring-purple-200' : ''}`}
                              >
                                <input type="checkbox" checked={c.checked} onChange={() => toggleChange(c.id)}
                                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    Bin #{c.binNumber} from {c.routeName}
                                  </p>
                                  <p className="text-[11px] text-gray-500">{c.binStreet}, {c.binCity}</p>
                                  <p className="text-[11px] text-red-600 mt-0.5">{c.reason}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Adds */}
                      {changes.filter(c => c.type === 'add').length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            Add ({changes.filter(c => c.type === 'add').length})
                          </h3>
                          <div className="space-y-1.5">
                            {changes.filter(c => c.type === 'add').map(c => (
                              <label
                                key={c.id}
                                onMouseEnter={() => setHoveredChangeId(c.id)}
                                onMouseLeave={() => setHoveredChangeId(null)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  c.checked ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white opacity-60'
                                } ${hoveredChangeId === c.id ? 'ring-2 ring-purple-200' : ''}`}
                              >
                                <input type="checkbox" checked={c.checked} onChange={() => toggleChange(c.id)}
                                  className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    Bin #{c.binNumber} to {c.routeName}
                                  </p>
                                  <p className="text-[11px] text-gray-500">{c.binStreet}, {c.binCity}</p>
                                  <p className="text-[11px] text-green-600 mt-0.5">{c.reason}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {suggestions.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Suggestions ({suggestions.length})
                          </h3>
                          <div className="space-y-1.5">
                            {suggestions.map(c => (
                              <div key={c.id} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                                <p className="text-sm font-medium text-gray-900">{c.routeName}</p>
                                <p className="text-[11px] text-amber-700 mt-0.5">{c.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Map */}
                <div className="flex-1 relative">
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap
                      mapId="optimizer-map"
                      defaultCenter={warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : DEFAULT_CENTER}
                      defaultZoom={11}
                      mapTypeId="hybrid"
                      disableDefaultUI={false}
                      streetViewControl={false}
                      gestureHandling="greedy"
                      style={{ width: '100%', height: '100%' }}
                    >
                      {mappableBins.map(bin => {
                        const isRemove = removeBinIds.has(bin.id);
                        const isAdd = addBinIds.has(bin.id);
                        const isHovered = hoveredBin?.id === bin.id;
                        return (
                          <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }}
                            zIndex={isHovered ? 20 : isRemove || isAdd ? 15 : 10}>
                            <div className={`rounded-full border-2 shadow flex items-center justify-center transition-all ${
                              isHovered ? 'w-10 h-10 ring-4 ring-purple-400/50' :
                              isRemove ? 'w-8 h-8 border-red-400 bg-red-500' :
                              isAdd ? 'w-8 h-8 border-green-400 bg-green-500' :
                              'w-6 h-6 border-white opacity-60'
                            }`}
                              style={!isRemove && !isAdd ? { backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status) } : undefined}
                            >
                              {(isRemove || isAdd || isHovered) && (
                                <span className="text-[9px] font-bold text-white">
                                  {isRemove ? '✕' : isAdd ? '+' : bin.bin_number}
                                </span>
                              )}
                            </div>
                          </AdvancedMarker>
                        );
                      })}
                    </GoogleMap>
                  </APIProvider>
                </div>
              </>
            )}

            {tab === 'preview' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                  {/* AI Summary */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-4 h-4" /> Optimization Summary
                    </h3>
                    <p className="text-sm text-purple-700">
                      {checkedRemoves > 0 && `Removing ${checkedRemoves} underperforming or inactive bins. `}
                      {checkedAdds > 0 && `Adding ${checkedAdds} uncovered bins to their nearest routes. `}
                      {checkedRemoves === 0 && checkedAdds === 0 && 'No changes selected. '}
                      {totalChanges > 0 && `This improves route efficiency by eliminating wasted stops and ensuring all active bins are covered.`}
                    </p>
                  </div>

                  {/* Route cards */}
                  <div className="space-y-3">
                    {previewRoutes.map(r => (
                      <div key={r.id} className={`rounded-lg border p-4 ${
                        r.delta !== 0 ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">{r.name}</h4>
                          {r.delta !== 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              r.delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {r.delta > 0 ? '+' : ''}{r.delta} bins
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {r.newBinCount} bins {r.delta !== 0 && <span className="text-gray-400">(was {r.oldBinCount})</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {r.avgFill}% avg fill
                          </span>
                          <span className="text-gray-400">{r.geographic_area}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'schedule' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5 mb-2">
                      <Calendar className="w-4 h-4" /> Recommended Weekly Schedule
                    </h3>
                    <p className="text-sm text-blue-700">
                      Routes with higher avg fill rates are scheduled more frequently to prevent overflow.
                      Routes with lower fill rates run less often to save driver time.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {schedule.map(day => (
                      <div key={day.day} className="rounded-lg border border-gray-200 bg-white p-3">
                        <h4 className="text-xs font-bold text-gray-700 mb-2">{day.day}</h4>
                        {day.routes.length === 0 ? (
                          <p className="text-[11px] text-gray-400">No routes</p>
                        ) : (
                          <div className="space-y-1.5">
                            {day.routes.map((r, i) => (
                              <div key={i} className="bg-gray-50 rounded px-2 py-1.5">
                                <p className="text-xs font-medium text-gray-900 truncate">{r.name}</p>
                                <p className="text-[10px] text-gray-500">{r.binCount} bins · {r.avgFillRate}% fill</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {totalChanges} change{totalChanges !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={totalChanges === 0 || applying}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Apply {totalChanges} Change{totalChanges !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
