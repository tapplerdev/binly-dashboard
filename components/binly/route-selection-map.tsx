'use client';

import { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Route } from '@/lib/types/route';
import { Bin } from '@/lib/types/bin';
import { getBinMarkerColor } from '@/lib/types/bin';
import { getRoutes } from '@/lib/api/routes';
import { getBins } from '@/lib/api/bins';
import { X, MapPin, Calendar, Loader2, Search, ChevronDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

interface RouteSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedRoute: Route, routeBins: Bin[]) => void;
}

// ============================================================================
// RETIRED CODE - Route Polyline Rendering (2026-01-31)
// ============================================================================
// Preserved for potential future use. See git history.
// ============================================================================

// Map Controller - Auto-fits bounds when route is selected
function MapController({ routeBins, warehouseLocation }: {
  routeBins: Bin[];
  warehouseLocation: { lat: number; lng: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || routeBins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    routeBins.forEach(bin => {
      if (bin.latitude && bin.longitude) {
        bounds.extend({ lat: bin.latitude, lng: bin.longitude });
      }
    });
    bounds.extend(warehouseLocation);
    map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
  }, [map, routeBins, warehouseLocation]);

  return null;
}

// Pulsing Marker — colored by fill level so urgency is visible on the map
function PulsingMarker({ bin }: { bin: Bin }) {
  const fillPct = bin.fill_percentage ?? 0;
  const color = getBinMarkerColor(fillPct, bin.status);

  return (
    <AdvancedMarker
      position={{ lat: bin.latitude, lng: bin.longitude }}
      zIndex={10}
    >
      <div className="relative">
        <div className="absolute inset-0 -m-2">
          <div className="w-12 h-12 rounded-full opacity-30 animate-ping" style={{ backgroundColor: color }} />
        </div>
        <div
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-white"
          style={{ backgroundColor: color }}
          title={`Bin #${bin.bin_number} — ${fillPct}%`}
        >
          {bin.bin_number % 100}
        </div>
      </div>
    </AdvancedMarker>
  );
}

// Compute urgency counts for a set of bins
function getUrgencyCounts(bins: Bin[]) {
  let critical = 0; // 80%+
  let high = 0;     // 50–79%
  for (const bin of bins) {
    const pct = bin.fill_percentage ?? 0;
    if (bin.status === 'missing') continue;
    if (pct >= 80) critical++;
    else if (pct >= 50) high++;
  }
  return { critical, high };
}

type SortKey = 'urgency' | 'bins' | 'name';

export function RouteSelectionMap({ onClose, onConfirm }: RouteSelectionMapProps) {
  const { data: warehouse } = useWarehouseLocation();
  const WAREHOUSE_LOCATION = {
    lat: warehouse?.latitude || 0,
    lng: warehouse?.longitude || 0,
    address: warehouse?.address || 'Warehouse',
  };

  const [routes, setRoutes] = useState<Route[]>([]);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [routesData, binsData] = await Promise.all([getRoutes(), getBins()]);
        setRoutes(routesData);
        setAllBins(binsData);
        // Auto-select first route for immediate preview
        if (routesData.length > 0) setSelectedRouteId(routesData[0].id);
      } catch (err) {
        console.error('Failed to fetch routes:', err);
        setError('Failed to load templates. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedRoute = useMemo(() => routes.find(r => r.id === selectedRouteId) || null, [routes, selectedRouteId]);

  const routeBins = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.bin_ids
      .map(id => allBins.find(b => b.id === id))
      .filter((b): b is Bin => b !== undefined && b.latitude != null && b.longitude != null);
  }, [selectedRoute, allBins]);

  // Pre-compute urgency for every route so cards can show badges + sort
  const routeUrgencyMap = useMemo(() => {
    const map = new Map<string, { critical: number; high: number }>();
    for (const route of routes) {
      const bins = route.bin_ids.map(id => allBins.find(b => b.id === id)).filter((b): b is Bin => !!b);
      map.set(route.id, getUrgencyCounts(bins));
    }
    return map;
  }, [routes, allBins]);

  // Filtered + sorted routes
  const displayedRoutes = useMemo(() => {
    let list = routes.filter(r =>
      !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sortKey === 'urgency') {
      list = [...list].sort((a, b) => {
        const ua = routeUrgencyMap.get(a.id) ?? { critical: 0, high: 0 };
        const ub = routeUrgencyMap.get(b.id) ?? { critical: 0, high: 0 };
        // Sort by critical first, then high
        if (ub.critical !== ua.critical) return ub.critical - ua.critical;
        return ub.high - ua.high;
      });
    } else if (sortKey === 'bins') {
      list = [...list].sort((a, b) => b.bin_count - a.bin_count);
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [routes, searchQuery, sortKey, routeUrgencyMap]);

  const handleConfirm = () => {
    if (!selectedRoute) return;
    onConfirm(selectedRoute, routeBins);
  };

  const formatDate = (iso: string | undefined) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const sortLabels: Record<SortKey, string> = {
    urgency: 'Most Urgent',
    bins: 'Most Bins',
    name: 'Name A–Z',
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={onClose} variant="outline" className="w-full">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full h-[90vh] max-w-7xl flex flex-col overflow-hidden pointer-events-auto">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Select Template for Shift</h2>
              <p className="text-sm text-gray-500 mt-0.5">Click a template to preview its bins on the map</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">

            {/* Map — Left */}
            <div className="flex-1 relative">
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                <GoogleMap
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={DEFAULT_ZOOM}
                  mapId="route-selection-map"
                  mapTypeId="hybrid"
                  gestureHandling="greedy"
                  streetViewControl={false}
                  disableDefaultUI={false}
                  className="w-full h-full"
                >
                  {selectedRoute && routeBins.length > 0 && (
                    <MapController routeBins={routeBins} warehouseLocation={WAREHOUSE_LOCATION} />
                  )}

                  {routeBins.map(bin => <PulsingMarker key={bin.id} bin={bin} />)}

                  {/* Warehouse marker */}
                  {selectedRoute && WAREHOUSE_LOCATION.lat !== 0 && (
                    <AdvancedMarker position={{ lat: WAREHOUSE_LOCATION.lat, lng: WAREHOUSE_LOCATION.lng }} zIndex={5}>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg ring-4 ring-amber-200">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          WAREHOUSE
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}
                </GoogleMap>
              </APIProvider>

              {/* No template selected hint */}
              {!selectedRoute && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 shadow-lg text-center">
                    <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Select a template to preview bins</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div className="w-96 border-l border-gray-200 flex flex-col bg-gray-50">

              {/* Search + Sort */}
              <div className="p-3 border-b border-gray-200 bg-white space-y-2 shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                {/* Sort */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">{displayedRoutes.length} template{displayedRoutes.length !== 1 ? 's' : ''}</p>
                  <div className="relative">
                    <button
                      onClick={() => setShowSortDropdown(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span>{sortLabels[sortKey]}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showSortDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden animate-slide-in-down">
                        {(['urgency', 'bins', 'name'] as SortKey[]).map(key => (
                          <button
                            key={key}
                            onClick={() => { setSortKey(key); setShowSortDropdown(false); }}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                              sortKey === key ? 'bg-primary/5 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {sortLabels[key]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Template cards OR bin detail list */}
              <div className="flex-1 overflow-y-auto">
                {routes.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No templates found</p>
                    <p className="text-xs text-gray-400 mt-1">Create templates in Operations → Routes</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {displayedRoutes.map(route => {
                      const urgency = routeUrgencyMap.get(route.id) ?? { critical: 0, high: 0 };
                      const isSelected = selectedRouteId === route.id;
                      const routeBinsForCard = route.bin_ids
                        .map(id => allBins.find(b => b.id === id))
                        .filter((b): b is Bin => !!b);

                      return (
                        <div key={route.id} className={`rounded-xl border-2 overflow-hidden transition-all ${
                          isSelected ? 'border-primary shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}>
                          {/* Card header — always visible, click to select */}
                          <button
                            onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                            className={`w-full text-left px-4 py-3 ${isSelected ? 'bg-primary/5' : 'bg-white'}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="font-semibold text-gray-900 text-sm leading-snug">{route.name}</h3>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {route.description && (
                              <p className="text-xs text-gray-500 mb-2 line-clamp-1">{route.description}</p>
                            )}

                            {/* Meta row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="w-3 h-3" />
                                {route.bin_count} bins
                              </span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{route.geographic_area}</span>

                              {/* Urgency badges */}
                              {urgency.critical > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200">
                                  🔴 {urgency.critical} critical
                                </span>
                              )}
                              {urgency.high > 0 && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded border border-orange-200">
                                  🟠 {urgency.high} high
                                </span>
                              )}
                              {urgency.critical === 0 && urgency.high === 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded border border-green-200">
                                  Low fill
                                </span>
                              )}
                            </div>

                            {route.schedule_pattern && (
                              <p className="text-xs text-gray-400 mt-1.5">Schedule: {route.schedule_pattern}</p>
                            )}
                            {route.created_at && (
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                <Calendar className="w-3 h-3" />
                                Created {formatDate(route.created_at)}
                              </div>
                            )}
                          </button>

                          {/* Bin detail list — expands when selected */}
                          {isSelected && routeBinsForCard.length > 0 && (
                            <div className="border-t border-primary/20 bg-white">
                              <div className="px-4 py-2 flex items-center gap-1.5 border-b border-gray-100">
                                <Package className="w-3.5 h-3.5 text-gray-400" />
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bins in template</p>
                              </div>
                              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                                {routeBinsForCard.map(bin => {
                                  const pct = bin.fill_percentage ?? 0;
                                  const color = getBinMarkerColor(pct, bin.status);
                                  return (
                                    <div key={bin.id} className="flex items-center gap-3 px-4 py-2">
                                      {/* Color dot */}
                                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-medium text-gray-800">Bin #{bin.bin_number}</p>
                                          <span className="text-xs text-gray-500 shrink-0">{pct}%</span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">
                                          {bin.location_name || `${bin.current_street}, ${bin.city}`}
                                        </p>
                                        <div className="mt-1 w-full bg-gray-100 rounded-full h-1">
                                          <div
                                            className="h-1 rounded-full"
                                            style={{ width: `${pct}%`, backgroundColor: color }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selectedRoute ? (
                  <>Selected: <span className="font-semibold text-gray-900">{selectedRoute.name}</span> ({routeBins.length} bins)</>
                ) : (
                  'Select a template to import'
                )}
              </p>
              {selectedRoute && (
                <p className="text-xs text-gray-500 mt-0.5">Route will be optimized when driver starts shift</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">Cancel</Button>
              <Button onClick={handleConfirm} disabled={!selectedRoute}>
                Import Template ({routeBins.length} bins)
              </Button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
