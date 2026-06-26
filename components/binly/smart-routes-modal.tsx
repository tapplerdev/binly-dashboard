'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, MapPin, Clock, Route, Check, ArrowLeft, ChevronRight } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { generateSmartRoutes, RecommendedRoute, SmartRoutesResponse } from '@/lib/api/smart-routes';
import { createRoute } from '@/lib/api/routes';
import { useQueryClient } from '@tanstack/react-query';
import { useModalClose } from '@/components/binly/modal-wrapper';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const WAREHOUSE = { lat: 37.6368013, lng: -122.1269379 };

interface SmartRoutesModalProps {
  onClose: () => void;
}

// Decode OSRM polyline6 (precision 6) to lat/lng array
function decodePolyline(encoded: string, precision = 6): Array<{ lat: number; lng: number }> {
  const factor = Math.pow(10, precision);
  const points: Array<{ lat: number; lng: number }> = [];
  let lat = 0, lng = 0, index = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

// Draws a road-snapped polyline via OSRM route API
function RoutePolyline({ bins, color }: { bins: Array<{ latitude: number; longitude: number }>; color: string }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || bins.length === 0) return;
    let cancelled = false;

    const fetchRoute = async () => {
      // Build coords: warehouse → bins in order → warehouse
      const coords = [
        `${WAREHOUSE.lng},${WAREHOUSE.lat}`,
        ...bins.map(b => `${b.longitude},${b.latitude}`),
        `${WAREHOUSE.lng},${WAREHOUSE.lat}`,
      ].join(';');

      try {
        const resp = await fetch(`http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline6`);
        const data = await resp.json();
        if (cancelled || !data.routes?.[0]?.geometry) return;

        const path = decodePolyline(data.routes[0].geometry, 6);

        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });
      } catch {
        // Fallback to straight lines if OSRM fails
        if (cancelled) return;
        const path = [WAREHOUSE, ...bins.map(b => ({ lat: b.latitude, lng: b.longitude })), WAREHOUSE];
        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new google.maps.Polyline({ path, strokeColor: color, strokeOpacity: 0.5, strokeWeight: 2, map });
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, bins, color]);

  return null;
}

const tierConfig = {
  high:   { label: 'High',   color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-500',   pin: '#ef4444' },
  medium: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', pin: '#f59e0b' },
  low:    { label: 'Low',    color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200',  dot: 'bg-blue-500',  pin: '#3b82f6' },
};

export function SmartRoutesModal({ onClose }: SmartRoutesModalProps) {
  const { isClosing, handleClose } = useModalClose(onClose);
  const [step, setStep] = useState<'configure' | 'review' | 'saving'>('configure');
  const [maxBins, setMaxBins] = useState(30);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartRoutesResponse | null>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<Set<number>>(new Set());
  const [routeNames, setRouteNames] = useState<Record<number, string>>({});
  const [focusedRoute, setFocusedRoute] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await generateSmartRoutes({ max_bins_per_route: maxBins });
      setResult(data);
      const all = new Set<number>();
      data.recommended_routes.forEach((_, i) => all.add(i));
      setSelectedRoutes(all);
      setFocusedRoute(0);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setStep('saving');
    setSavedCount(0);

    const routesToSave = result.recommended_routes.filter((_, i) => selectedRoutes.has(i));
    let saved = 0;

    for (const route of routesToSave) {
      const originalIdx = result.recommended_routes.indexOf(route);
      const name = routeNames[originalIdx] || route.suggested_name;
      try {
        await createRoute({
          name,
          description: `Auto-generated: ${route.schedule_pattern}, ${route.stats.bin_count} bins`,
          geographic_area: route.geographic_area,
          schedule_pattern: route.schedule_pattern,
          bin_ids: route.bin_ids,
        });
        saved++;
        setSavedCount(saved);
      } catch (e) {
        console.error(`Failed to save route "${name}":`, e);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['routes'] });
    setTimeout(() => onClose(), 1500);
  };

  const toggleRoute = (idx: number) => {
    const next = new Set(selectedRoutes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedRoutes(next);
  };

  // Map center: focused route's bins or all bins
  const mapView = useMemo(() => {
    if (!result) return { center: { lat: 37.4, lng: -122.0 }, zoom: 10 };
    const routes = result.recommended_routes;
    const bins = focusedRoute !== null && routes[focusedRoute]
      ? routes[focusedRoute].bins
      : routes.flatMap(r => r.bins);

    if (bins.length === 0) return { center: { lat: 37.4, lng: -122.0 }, zoom: 10 };
    const lat = bins.reduce((s, b) => s + b.latitude, 0) / bins.length;
    const lng = bins.reduce((s, b) => s + b.longitude, 0) / bins.length;

    // Calculate zoom based on spread
    const latSpread = Math.max(...bins.map(b => b.latitude)) - Math.min(...bins.map(b => b.latitude));
    const lngSpread = Math.max(...bins.map(b => b.longitude)) - Math.min(...bins.map(b => b.longitude));
    const spread = Math.max(latSpread, lngSpread);
    const zoom = spread > 0.5 ? 9 : spread > 0.2 ? 10 : spread > 0.1 ? 11 : spread > 0.05 ? 12 : 13;

    return { center: { lat, lng }, zoom };
  }, [result, focusedRoute]);

  // Pins to show on map
  const mapPins = useMemo(() => {
    if (!result) return [];
    if (focusedRoute !== null && result.recommended_routes[focusedRoute]) {
      const route = result.recommended_routes[focusedRoute];
      const cfg = tierConfig[route.tier];
      return route.bins.map(b => ({
        id: b.id,
        lat: b.latitude,
        lng: b.longitude,
        label: `#${b.bin_number}`,
        color: cfg.pin,
        fillRate: b.avg_daily_fill_rate,
        focused: true,
      }));
    }
    // Show all routes with their tier colors, dimmed
    return result.recommended_routes.flatMap((route, idx) => {
      const cfg = tierConfig[route.tier];
      return route.bins.map(b => ({
        id: b.id,
        lat: b.latitude,
        lng: b.longitude,
        label: `#${b.bin_number}`,
        color: cfg.pin,
        fillRate: b.avg_daily_fill_rate,
        focused: false,
      }));
    });
  }, [result, focusedRoute]);

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center ${isClosing ? "animate-fade-out" : "animate-fade-in"}`}>
      <div className="bg-white rounded-2xl w-full max-w-[95vw] max-h-[92vh] h-[92vh] mx-4 overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">
              {step === 'configure' ? 'Auto-Generate Routes' : step === 'saving' ? 'Saving...' : 'Review Routes'}
            </h2>
            {result && step === 'review' && (
              <div className="flex items-center gap-2 ml-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{result.analysis.tiers.high} High</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{result.analysis.tiers.medium} Med</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{result.analysis.tiers.low} Low</span>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {step === 'configure' && (
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Analyze your bin fill rates and geographic locations to generate optimized route templates.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-red-500" /></span>
                  <span><strong>High Priority</strong> — bins predicted to hit 80% within 4 days</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-amber-500" /></span>
                  <span><strong>Medium Priority</strong> — 5-9 days to 80%</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-blue-500" /></span>
                  <span><strong>Low Priority</strong> — 10+ days to 80%</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Bins per Route</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" value={maxBins} onChange={e => setMaxBins(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" min={5} max={50} />
                  <span className="text-sm text-gray-500">bins per shift</span>
                </div>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
            </div>
          )}

          {step === 'review' && result && (
            <>
              {/* Left sidebar: route list */}
              <div className="w-96 border-r border-gray-200 flex flex-col min-h-0">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">{result.recommended_routes.length} Routes</span>
                  <button
                    onClick={() => setFocusedRoute(null)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${focusedRoute === null ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Show All
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {result.recommended_routes.map((route, idx) => {
                    const cfg = tierConfig[route.tier];
                    const isSelected = selectedRoutes.has(idx);
                    const isFocused = focusedRoute === idx;
                    const displayName = routeNames[idx] || route.suggested_name;

                    return (
                      <div
                        key={idx}
                        onClick={() => setFocusedRoute(isFocused ? null : idx)}
                        className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-all ${
                          isFocused ? 'bg-gray-50 border-l-[3px] border-l-gray-800' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
                        } ${!isSelected ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleRoute(idx); }}
                            onClick={e => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 shrink-0" />
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <input type="text" value={displayName}
                            onChange={e => { e.stopPropagation(); setRouteNames(prev => ({ ...prev, [idx]: e.target.value })); }}
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-semibold text-gray-800 bg-transparent border-none p-0 w-full focus:outline-none focus:ring-0 truncate"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-6 text-[10px] text-gray-500">
                          <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{route.stats.bin_count}</span>
                          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{route.stats.estimated_duration_hours}h</span>
                          <span className="flex items-center gap-0.5"><Route className="w-2.5 h-2.5" />{route.stats.estimated_distance_miles}mi</span>
                          <span className={`font-medium ${cfg.color}`}>{route.schedule_pattern}</span>
                        </div>

                        {/* Area breakdown + bin list when focused */}
                        {isFocused && (() => {
                          const areaCounts: Record<string, { count: number; totalRate: number }> = {};
                          route.bins.forEach(b => {
                            if (!areaCounts[b.city]) areaCounts[b.city] = { count: 0, totalRate: 0 };
                            areaCounts[b.city].count++;
                            areaCounts[b.city].totalRate += b.avg_daily_fill_rate;
                          });
                          const areas = Object.entries(areaCounts)
                            .map(([city, s]) => ({ city, count: s.count, avgRate: Math.round(s.totalRate / s.count * 10) / 10 }))
                            .sort((a, b) => b.count - a.count);
                          return (
                            <div className="mt-2 ml-6">
                              <div className="flex flex-wrap gap-1 mb-2">
                                {areas.map(a => (
                                  <span key={a.city} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {a.city} <span className="font-semibold">{a.count}</span> <span className="text-gray-400">· {a.avgRate}%/d</span>
                                  </span>
                                ))}
                              </div>
                              <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                                {route.bins.map(bin => (
                                  <div key={bin.id} className="flex items-center gap-1.5 text-[10px]">
                                    <span className="font-semibold text-gray-600 w-8">#{bin.bin_number}</span>
                                    <span className="text-gray-400 flex-1 truncate">{bin.current_street}</span>
                                    <span className="text-gray-400">{bin.avg_daily_fill_rate}%/d</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Map */}
              <div className="flex-1 min-h-0">
                {GOOGLE_MAPS_API_KEY ? (
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                      key={`${mapView.center.lat}-${mapView.center.lng}-${mapView.zoom}`}
                      defaultCenter={mapView.center}
                      defaultZoom={mapView.zoom}
                      mapId="binly-smart-routes"
                      disableDefaultUI
                      gestureHandling="greedy"
                      className="w-full h-full"
                    >
                      {/* Warehouse marker */}
                      <AdvancedMarker position={WAREHOUSE} zIndex={20} title="Warehouse">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                          </svg>
                        </div>
                      </AdvancedMarker>
                      {/* Route polyline for focused route */}
                      {focusedRoute !== null && result.recommended_routes[focusedRoute] && (
                        <RoutePolyline
                          bins={result.recommended_routes[focusedRoute].bins}
                          color={tierConfig[result.recommended_routes[focusedRoute].tier].pin}
                        />
                      )}
                      {/* Bin pins */}
                      {mapPins.map(pin => (
                        <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }}>
                          <div className="flex flex-col items-center">
                            <div
                              className="rounded-full border-2 border-white shadow-md flex items-center justify-center"
                              style={{
                                width: pin.focused ? 28 : 16,
                                height: pin.focused ? 28 : 16,
                                backgroundColor: pin.color,
                                opacity: pin.focused ? 1 : 0.4,
                              }}
                            >
                              {pin.focused && <span className="text-[8px] font-bold text-white">{pin.fillRate}</span>}
                            </div>
                            {pin.focused && (
                              <span className="text-[9px] font-semibold text-gray-700 mt-0.5 bg-white/90 px-1 rounded shadow-sm">
                                {pin.label}
                              </span>
                            )}
                          </div>
                        </AdvancedMarker>
                      ))}
                    </Map>
                  </APIProvider>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 text-sm">
                    Google Maps API key required
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'saving' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              {savedCount < selectedRoutes.size ? (
                <>
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <div className="text-sm text-gray-600">Saving {savedCount} of {selectedRoutes.size} routes...</div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-sm font-semibold text-green-700">All {savedCount} routes saved!</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {step === 'configure' ? (
              <>
                <button onClick={handleClose} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleAnalyze} disabled={isAnalyzing}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Bins'}
                </button>
              </>
            ) : step === 'review' ? (
              <>
                <button onClick={() => setStep('configure')}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{selectedRoutes.size} selected</span>
                  <button onClick={handleSave} disabled={selectedRoutes.size === 0}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" />
                    Save {selectedRoutes.size} as Templates
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
