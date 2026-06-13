'use client';

import { useState, useMemo } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  X, Check, AlertTriangle, Calendar, Sparkles,
  Loader2, Package, TrendingUp, Clock,
} from 'lucide-react';
import { Route } from '@/lib/types/route';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { updateRoute, createRoute, deleteRoute } from '@/lib/api/routes';
import { smartReoptimize, ReoptRoute, ReoptBin, LowPerformerBin } from '@/lib/api/route-performance';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const ROUTE_COLORS = ['#4880FF', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#EC4899'];

interface AIRouteOptimizerModalProps {
  templates: Route[];
  bins: Bin[];
  allBinsWithRetired: Bin[];
  binCollectionStats: Record<string, { avg_fill: number; check_count: number }>;
  onClose: () => void;
  onApply: () => void;
}

export function AIRouteOptimizerModal({ templates, bins, onClose, onApply }: AIRouteOptimizerModalProps) {
  const { data: warehouse } = useWarehouseLocation();
  const [phase, setPhase] = useState<'config' | 'results'>('config');
  const [tab, setTab] = useState<'preview' | 'schedule'>('preview');
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null);

  // Config
  const [maxBinsPerRoute, setMaxBinsPerRoute] = useState(30);
  const [targetDurationHours, setTargetDurationHours] = useState(10);
  const [lowPerformerThreshold, setLowPerformerThreshold] = useState(15);

  // Results from backend
  const [resultRoutes, setResultRoutes] = useState<ReoptRoute[]>([]);
  const [lowPerformers, setLowPerformers] = useState<LowPerformerBin[]>([]);
  const [deleteRouteIds, setDeleteRouteIds] = useState<string[]>([]);
  const [solverInfo, setSolverInfo] = useState<{ runtime_ms: number; feasible: boolean; unassigned: number; num_vehicles: number } | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const routeIds = templates.map(t => t.id);
      const result = await smartReoptimize(routeIds, maxBinsPerRoute, lowPerformerThreshold);
      if (!result) throw new Error('No response from optimizer');
      setResultRoutes(result.routes);
      setLowPerformers(result.low_performers || []);
      setDeleteRouteIds(result.delete_route_ids || []);
      setSolverInfo(result.solver);
      setPhase('results');
    } catch (err: any) {
      setError(err.message || 'Optimization failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      // Update existing templates
      for (const route of resultRoutes) {
        if (route.route_id) {
          await updateRoute(route.route_id, {
            bin_ids: route.bin_ids,
            name: route.suggested_name,
            geographic_area: route.geographic_area,
            estimated_duration_hours: route.estimated_duration_hours,
            schedule_pattern: route.schedule_pattern,
          });
        } else {
          // Create new template for routes that don't map to existing ones
          await createRoute({
            name: route.suggested_name,
            geographic_area: route.geographic_area,
            bin_ids: route.bin_ids,
            estimated_duration_hours: route.estimated_duration_hours,
            schedule_pattern: route.schedule_pattern,
          });
        }
      }
      // Delete templates that got 0 bins
      for (const id of deleteRouteIds) {
        try { await deleteRoute(id); } catch { /* ignore */ }
      }
      onApply();
      onClose();
    } catch {
      alert('Failed to apply some changes.');
    } finally {
      setApplying(false);
    }
  };

  // Schedule from results
  const schedule = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routes = resultRoutes.map((r, i) => ({
      ...r, color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      freq: r.avg_fill >= 60 ? 3 : r.avg_fill >= 35 ? 2 : 1,
    })).sort((a, b) => b.freq - a.freq);

    const daySlots: typeof routes[number][][] = days.map(() => []);
    routes.forEach(route => {
      const step = Math.max(1, Math.floor(days.length / route.freq));
      for (let i = 0; i < route.freq && i < days.length; i++) {
        daySlots[(i * step) % days.length].push(route);
      }
    });
    return days.map((d, i) => ({ day: d, routes: daySlots[i] }));
  }, [resultRoutes]);

  // Compute deltas vs original templates
  const routeDeltas = useMemo(() => {
    const m = new Map<string, number>();
    resultRoutes.forEach(r => {
      const orig = templates.find(t => t.id === r.route_id);
      m.set(r.route_id, r.bin_count - (orig?.bin_count ?? 0));
    });
    return m;
  }, [resultRoutes, templates]);

  const selectedRoute = selectedRouteIdx !== null ? resultRoutes[selectedRouteIdx] : null;

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
                {phase === 'config' ? 'Configure and analyze your routes'
                  : `${resultRoutes.length} optimized routes${deleteRouteIds.length > 0 ? ` · ${deleteRouteIds.length} templates removed` : ''}${lowPerformers.length > 0 ? ` · ${lowPerformers.length} low performers flagged` : ''}`}
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {phase === 'config' ? (
            /* CONFIG */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md w-full space-y-6">
                <div className="text-center mb-6">
                  <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    OR-Tools will redistribute all active bins across your {templates.length} route templates
                    for optimal driving distance, then suggest names and schedules.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max bins per route</label>
                  <input type="number" value={maxBinsPerRoute} onChange={e => setMaxBinsPerRoute(parseInt(e.target.value) || 30)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
                  <p className="text-xs text-gray-400 mt-1">Soft limit — allows +1/+2 overflow to avoid tiny leftover routes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target duration per route (hours)</label>
                  <input type="number" value={targetDurationHours} onChange={e => setTargetDurationHours(parseInt(e.target.value) || 10)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
                  <p className="text-xs text-gray-400 mt-1">Routes exceeding this will be highlighted in red</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low performer threshold (%)</label>
                  <input type="number" value={lowPerformerThreshold} onChange={e => setLowPerformerThreshold(parseInt(e.target.value) || 15)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
                  <p className="text-xs text-gray-400 mt-1">Bins below this avg fill (5+ checks) will be excluded from all routes</p>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

                <button onClick={runAnalysis} disabled={analyzing}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Running OR-Tools optimization...</> : <><Sparkles className="w-4 h-4" /> Analyze & Optimize</>}
                </button>

                <div className="text-center">
                  <p className="text-[10px] text-gray-400">
                    This calls OSRM for distance matrix + OR-Tools CVRP solver. Takes 5-15 seconds.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* RESULTS */
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 shrink-0">
                <button onClick={() => setTab('preview')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                    tab === 'preview' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500'
                  }`}>Routes ({resultRoutes.length})</button>
                <button onClick={() => setTab('schedule')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                    tab === 'schedule' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500'
                  }`}>Schedule</button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {tab === 'preview' && (
                  <>
                    {/* Route list */}
                    <div className="w-[420px] border-r border-gray-200 overflow-y-auto shrink-0">
                      {/* Solver info */}
                      <div className="p-3 bg-purple-50 border-b border-purple-100">
                        <p className="text-xs text-purple-700">
                          Optimized in {solverInfo?.runtime_ms}ms · {lowPerformers.length > 0 && `${lowPerformers.length} low performers flagged · `}
                          All {resultRoutes.reduce((s, r) => s + r.bin_count, 0)} active bins distributed
                        </p>
                      </div>

                      {/* Low performers */}
                      {lowPerformers.length > 0 && (
                        <div className="p-3 border-b border-gray-200">
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Low Performers — Consider Relocating ({lowPerformers.length})
                          </p>
                          <div className="space-y-1">
                            {lowPerformers.map(b => (
                              <div key={b.id} className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold flex items-center justify-center">{b.bin_number}</span>
                                <span className="truncate">{b.current_street}, {b.city}</span>
                                <span className="text-amber-600 shrink-0">{b.avg_fill}% avg · {b.check_count} checks</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Route cards */}
                      <div className="p-3 space-y-2">
                        {resultRoutes.map((r, i) => {
                          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                          const delta = routeDeltas.get(r.route_id) ?? 0;
                          const overDuration = r.estimated_duration_hours > targetDurationHours;
                          return (
                            <button key={i} onClick={() => setSelectedRouteIdx(selectedRouteIdx === i ? null : i)}
                              className={`w-full text-left rounded-lg border p-3 transition-all ${
                                selectedRouteIdx === i ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-3 h-full rounded-full shrink-0" style={{ backgroundColor: color, minHeight: '2rem' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs text-gray-400 truncate">{r.name || 'New route'}</p>
                                      <p className="text-sm font-semibold text-gray-900 truncate">{r.suggested_name}</p>
                                    </div>
                                    {delta !== 0 && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                        delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>{delta > 0 ? '+' : ''}{delta}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2.5 text-[11px] text-gray-500 mt-1">
                                    <span className="flex items-center gap-0.5"><Package className="w-3 h-3" />{r.bin_count}</span>
                                    <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{r.avg_fill}%</span>
                                    <span className={`flex items-center gap-0.5 ${overDuration ? 'text-red-600 font-medium' : ''}`}>
                                      <Clock className="w-3 h-3" />{r.estimated_duration_hours}h
                                    </span>
                                    <span>{r.estimated_distance_miles} mi</span>
                                  </div>
                                  <p className="text-[10px] text-purple-600 mt-0.5">{r.schedule_pattern}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
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
                          {/* Show selected route's bins, or all */}
                          {selectedRoute ? (
                            selectedRoute.bins.map(bin => (
                              <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }} zIndex={15}>
                                <div className="w-9 h-9 rounded-full border-2 border-white shadow-lg flex items-center justify-center ring-2"
                                  style={{ backgroundColor: ROUTE_COLORS[selectedRouteIdx! % ROUTE_COLORS.length], ringColor: `${ROUTE_COLORS[selectedRouteIdx! % ROUTE_COLORS.length]}40` }}>
                                  <span className="text-[10px] font-bold text-white">{bin.bin_number}</span>
                                </div>
                              </AdvancedMarker>
                            ))
                          ) : (
                            resultRoutes.flatMap((r, ri) =>
                              r.bins.map(bin => (
                                <AdvancedMarker key={bin.id} position={{ lat: bin.latitude, lng: bin.longitude }} zIndex={10}>
                                  <div className="w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center"
                                    style={{ backgroundColor: ROUTE_COLORS[ri % ROUTE_COLORS.length] }}>
                                    <span className="text-[9px] font-bold text-white">{bin.bin_number}</span>
                                  </div>
                                </AdvancedMarker>
                              ))
                            )
                          )}
                          {/* Warehouse */}
                          {warehouse && (
                            <AdvancedMarker position={{ lat: warehouse.latitude, lng: warehouse.longitude }} zIndex={20}>
                              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-purple-500">
                                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                              </div>
                            </AdvancedMarker>
                          )}
                        </GoogleMap>
                      </APIProvider>
                    </div>
                  </>
                )}

                {tab === 'schedule' && (
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5 mb-1.5">
                          <Calendar className="w-4 h-4" /> Recommended Weekly Schedule
                        </h3>
                        <p className="text-xs text-blue-700">
                          Higher avg fill routes run more frequently. Adjust as needed.
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
                                    <div key={i} className="rounded px-2.5 py-2 border-l-[3px]"
                                      style={{ borderColor: r.color, backgroundColor: `${r.color}08` }}>
                                      <p className="text-xs font-medium text-gray-900 truncate">{r.suggested_name}</p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                        <span>{r.bin_count} bins</span>
                                        <span>{r.avg_fill}% fill</span>
                                        <span>{r.estimated_duration_hours}h</span>
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
                <button onClick={() => setPhase('config')} className="text-sm text-purple-600 hover:text-purple-800 font-medium">
                  ← Reconfigure
                </button>
                <div className="flex gap-3">
                  <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
                  <button onClick={handleApply} disabled={applying || resultRoutes.length === 0}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Apply & Rename All Routes
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
