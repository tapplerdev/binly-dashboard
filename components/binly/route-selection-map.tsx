'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Route } from '@/lib/types/route';
import { Bin } from '@/lib/types/bin';
import { getRoutes } from '@/lib/api/routes';
import { getBins } from '@/lib/api/bins';
import { X, MapPin, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Warehouse location - routes start and end here
const WAREHOUSE_LOCATION = {
  lat: 11.1867045,
  lng: -74.2362302,
  address: 'Cl. 29 #1-65, Gaira, Santa Marta, Magdalena'
};

// Route color
const ROUTE_COLOR = '#4880FF';

interface RouteSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedRoute: Route, routeBins: Bin[]) => void;
}

// ============================================================================
// RETIRED CODE - Route Polyline Rendering (2026-01-31)
// ============================================================================
// Reason: Moving to template-based system where routes aren't pre-optimized.
// Showing polylines with animated routes implies pre-calculated route order,
// which is misleading since templates are just bin collections. Actual route
// optimization happens when driver starts shift using HERE Maps API with
// real-time traffic and driver's current location.
//
// This code is preserved for potential future use if we want to show
// route previews after optimization or for visualization purposes.
// ============================================================================
/*
// Route Polyline Component - RETIRED - Renders animated polyline for selected route
function RoutePolylineRetired({ route, routeBins }: { route: Route; routeBins: Bin[] }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const glowPolylineRef = useRef<google.maps.Polyline | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fetch and draw polyline
  useEffect(() => {
    if (!map || routeBins.length < 2) return;

    async function drawRoute() {
      try {
        // Build route: warehouse -> bins -> warehouse (round trip)
        const binCoordinates = routeBins
          .filter(bin => bin.latitude && bin.longitude)
          .map(bin => `${bin.longitude},${bin.latitude}`);

        if (binCoordinates.length < 2) return;

        const warehouseCoordinate = `${WAREHOUSE_LOCATION.lng},${WAREHOUSE_LOCATION.lat}`;
        const coordinates = [warehouseCoordinate, ...binCoordinates, warehouseCoordinate].join(';');

        // Mapbox Directions API endpoint
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=pk.eyJ1IjoiYmlubHl5YWkiLCJhIjoiY21pNzN4bzlhMDVheTJpcHdqd2FtYjhpeSJ9.sQM8WHE2C9zWH0xG107xhw`;

        const response = await fetch(mapboxUrl);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          // Convert Mapbox GeoJSON coordinates to Google Maps LatLng
          const path = data.routes[0].geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
          }));

          // Create glow polyline (thicker, semi-transparent layer underneath)
          const glowLine = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: ROUTE_COLOR,
            strokeOpacity: 0.3,
            strokeWeight: 12,
            map: map,
            clickable: false,
            zIndex: 999,
          });

          // Create main polyline
          const line = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: ROUTE_COLOR,
            strokeOpacity: 1,
            strokeWeight: 6,
            map: map,
            clickable: false,
            zIndex: 1000,
          });

          polylineRef.current = line;
          glowPolylineRef.current = glowLine;

          // Fit map bounds to show entire route
          const bounds = new google.maps.LatLngBounds();
          path.forEach((point) => bounds.extend(point));
          map.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });
        }
      } catch (error) {
        console.error('Error fetching route polyline:', error);
      }
    }

    drawRoute();

    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (glowPolylineRef.current) glowPolylineRef.current.setMap(null);
    };
  }, [map, route, routeBins]);

  // Pulsing animation
  useEffect(() => {
    let opacity = 1;
    let opacityDirection = -0.008;
    let strokeWeight = 6;
    let weightDirection = -0.05;
    let glowOpacity = 0.3;
    let glowOpacityDirection = -0.006;

    const animate = () => {
      // Pulsing values
      opacity += opacityDirection;
      if (opacity <= 0.85 || opacity >= 1) opacityDirection *= -1;

      strokeWeight += weightDirection;
      if (strokeWeight <= 5 || strokeWeight >= 7) weightDirection *= -1;

      glowOpacity += glowOpacityDirection;
      if (glowOpacity <= 0.15 || glowOpacity >= 0.4) glowOpacityDirection *= -1;

      // Apply to polylines
      if (polylineRef.current) {
        polylineRef.current.setOptions({
          strokeOpacity: opacity,
          strokeWeight: strokeWeight,
        });
      }

      if (glowPolylineRef.current) {
        glowPolylineRef.current.setOptions({
          strokeOpacity: glowOpacity,
          strokeWeight: 14 + (strokeWeight - 5) * 2,
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return null;
}
*/
// ============================================================================
// END RETIRED CODE
// ============================================================================

// Map Controller - Handles auto-fitting bounds when route is selected
function MapController({ routeBins }: { routeBins: Bin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || routeBins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    routeBins.forEach(bin => {
      if (bin.latitude && bin.longitude) {
        bounds.extend({ lat: bin.latitude, lng: bin.longitude });
      }
    });

    // Include warehouse
    bounds.extend(WAREHOUSE_LOCATION);

    // Fit bounds with padding
    map.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });
  }, [map, routeBins]);

  return null;
}

// Pulsing Marker Component - Shows bins without implying order
function PulsingMarker({ bin, index, total }: { bin: Bin; index: number; total: number }) {
  return (
    <AdvancedMarker
      key={bin.id}
      position={{ lat: bin.latitude, lng: bin.longitude }}
      zIndex={10}
    >
      <div className="relative">
        {/* Pulsing ring animation */}
        <div className="absolute inset-0 -m-2">
          <div className="w-12 h-12 rounded-full bg-primary opacity-30 animate-ping" />
        </div>

        {/* Bin number marker - no special colors for first/last (template, not optimized route) */}
        <div
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg bg-primary ring-2 ring-white"
          title={`Bin #${bin.bin_number}`}
        >
          {bin.bin_number}
        </div>
      </div>
    </AdvancedMarker>
  );
}

export function RouteSelectionMap({ onClose, onConfirm }: RouteSelectionMapProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch routes and bins on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [routesData, binsData] = await Promise.all([
          getRoutes(),
          getBins()
        ]);

        setRoutes(routesData);
        setAllBins(binsData);
      } catch (err) {
        console.error('Failed to fetch routes:', err);
        setError('Failed to load routes. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Get the selected route
  const selectedRoute = useMemo(() => {
    return routes.find(r => r.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  // Get bins for the selected route - preserve optimized order
  const routeBins = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.bin_ids
      .map(binId => allBins.find(bin => bin.id === binId))
      .filter((bin): bin is Bin => bin !== undefined && bin.latitude != null && bin.longitude != null);
  }, [selectedRoute, allBins]);

  const handleConfirm = () => {
    if (!selectedRoute) return;
    onConfirm(selectedRoute, routeBins);
  };

  const formatDate = (isoDate: string | undefined) => {
    if (!isoDate) return 'N/A';
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-gray-600">Loading routes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full h-[90vh] max-w-7xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Template for Shift</h2>
              <p className="text-sm text-gray-600 mt-1">Click on a template to view bins on the map</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Left Side */}
          <div className="flex-1 relative">
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
              <Map
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                mapId="route-selection-map"
                disableDefaultUI={true}
                gestureHandling="greedy"
                zoomControl={true}
                clickableIcons={false}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                {/* Map Controller - Auto-fit bounds when route selected */}
                {selectedRoute && routeBins.length > 0 && (
                  <MapController routeBins={routeBins} />
                )}

                {/* Route Polyline - RETIRED - No longer showing polylines for templates */}
                {/* Templates are unoptimized bin collections - routes optimized when driver starts shift */}

                {/* Pulsing Bin Markers */}
                {routeBins.map((bin, index) => (
                  <PulsingMarker
                    key={bin.id}
                    bin={bin}
                    index={index}
                    total={routeBins.length}
                  />
                ))}

                {/* Warehouse Marker */}
                {selectedRoute && (
                  <AdvancedMarker
                    position={{ lat: WAREHOUSE_LOCATION.lat, lng: WAREHOUSE_LOCATION.lng }}
                    zIndex={5}
                  >
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
              </Map>
            </APIProvider>

            {/* Info Overlay */}
            {selectedRoute && (
              <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs pointer-events-auto">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedRoute.name}</h3>
                {selectedRoute.description && (
                  <p className="text-sm text-gray-600 mb-2">{selectedRoute.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{selectedRoute.bin_count} bins</span>
                  <span>•</span>
                  <span>{selectedRoute.geographic_area}</span>
                </div>
              </div>
            )}
          </div>

          {/* Templates List - Right Side */}
          <div className="w-96 border-l border-gray-200 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white shrink-0">
              <p className="text-sm font-medium text-gray-700">
                {routes.length} {routes.length === 1 ? 'template' : 'templates'} available
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {routes.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No templates found</p>
                  <p className="text-xs text-gray-400 mt-1">Create templates in Operations → Routes</p>
                </div>
              ) : (
                routes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedRouteId === route.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{route.name}</h3>
                      {selectedRouteId === route.id && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {route.description && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{route.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {route.bin_count} bins
                      </span>
                      <span>•</span>
                      <span>{route.geographic_area}</span>
                    </div>

                    {route.schedule_pattern && (
                      <div className="mt-2 text-xs text-gray-500">
                        Schedule: {route.schedule_pattern}
                      </div>
                    )}

                    {route.created_at && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        Created {formatDate(route.created_at)}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selectedRoute ? (
                  <>
                    Selected: <span className="font-medium text-gray-900">{selectedRoute.name}</span> ({routeBins.length} bins)
                  </>
                ) : (
                  'Select a template to import'
                )}
              </p>
              {selectedRoute && (
                <p className="text-xs text-gray-500 mt-1">
                  Route will be optimized when driver starts shift
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedRoute}>
                Import Template ({routeBins.length} bins)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
