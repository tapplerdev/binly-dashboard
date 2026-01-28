'use client';

import { useEffect, useState, useRef } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Route } from '@/lib/types/route';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin } from '@/lib/types/bin';
import { Loader2 } from 'lucide-react';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Warehouse location - all routes start and end here
const WAREHOUSE_LOCATION = {
  lat: 37.3009357,
  lng: -121.9493848,
  address: '1185 Campbell Ave, San Jose, CA 95126, United States'
};

// Format duration: show minutes if < 1 hour, otherwise show hours
const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)}h`;
};

// Route colors based on status/type
const ROUTE_COLORS = [
  '#4880FF', // Primary blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#EC4899', // Pink
];

interface RoutesMapViewProps {
  routes: Route[];
  visibleRouteIds: Set<string>;
  onRouteSelect?: (route: Route) => void;
  onViewDetails?: (route: Route) => void;
  selectedRouteId?: string | null;
  hoveredRouteId?: string | null;
}

// Zoom To Route Component - Handles camera zoom when route is selected
function ZoomToRoute({ route, allBins }: { route: Route; allBins: Bin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !route) return;

    const routeBins = allBins.filter(bin => route.bin_ids.includes(bin.id) && isMappableBin(bin));

    if (routeBins.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      routeBins.forEach(bin => {
        bounds.extend({ lat: bin.latitude, lng: bin.longitude });
      });

      // Smooth pan and zoom to route bounds
      map.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });
    }
  }, [map, route, allBins]);

  return null;
}

// All Routes Polylines Component - Must be child of Map to use useMap
interface AllRoutesPolylinesProps {
  routes: Route[];
  visibleRouteIds: Set<string>;
  allBins: Bin[];
  onRouteSelect?: (route: Route) => void;
  onViewDetails?: (route: Route) => void;
  selectedRouteId?: string | null;
  hoveredRouteId?: string | null;
}

function AllRoutesPolylines({ routes, visibleRouteIds, allBins, onRouteSelect, onViewDetails, selectedRouteId, hoveredRouteId }: AllRoutesPolylinesProps) {
  const map = useMap();
  const [loading, setLoading] = useState(true);
  const [hoveredRoute, setHoveredRoute] = useState<{ route: Route; position: google.maps.LatLng; color: string } | null>(null);

  // Use ref to store polylines - doesn't trigger re-renders
  const polylinesRef = useRef<Map<string, { polyline: google.maps.Polyline; glowPolyline: google.maps.Polyline; color: string }>>(new Map());

  // Track which routes we're currently fetching to prevent duplicates
  const fetchingRoutes = useRef<Set<string>>(new Set());

  // Store animation frame ID in ref to avoid re-renders
  const animationFrameRef = useRef<number | null>(null);

  // Simple animation loop - runs continuously and animates all polylines
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

      // Apply to ALL polylines
      polylinesRef.current.forEach((polylineData, routeId) => {
        const { polyline, glowPolyline } = polylineData;
        const isSelected = selectedRouteId === routeId;

        polyline.setOptions({
          strokeOpacity: opacity,
          strokeWeight: strokeWeight,
          zIndex: isSelected ? 1000 : 100,
        });

        glowPolyline.setOptions({
          strokeOpacity: glowOpacity,
          strokeWeight: 14 + (strokeWeight - 5) * 2,
          zIndex: isSelected ? 999 : 99,
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedRouteId]); // Restart when selection changes to update z-index

  // Incremental update effect - only add/remove changed routes
  useEffect(() => {
    if (!map || routes.length === 0 || allBins.length === 0) {
      setLoading(false);
      return;
    }

    const currentPolylines = polylinesRef.current;

    // 1. Remove polylines for routes that are no longer visible
    currentPolylines.forEach((polylineData, routeId) => {
      if (!visibleRouteIds.has(routeId)) {
        // Route was toggled off - remove its polylines
        polylineData.polyline.setMap(null);
        polylineData.glowPolyline.setMap(null);
        currentPolylines.delete(routeId);
      }
    });

    // 2. Add polylines for newly visible routes
    async function addNewRoutes() {
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];

        // Skip if not visible
        if (!visibleRouteIds.has(route.id)) continue;

        // Skip if already exists
        if (currentPolylines.has(route.id)) continue;

        // Skip if already fetching this route
        if (fetchingRoutes.current.has(route.id)) continue;

        // Mark as fetching
        fetchingRoutes.current.add(route.id);

        const routeBins = allBins.filter(bin => route.bin_ids.includes(bin.id) && isMappableBin(bin));

        if (routeBins.length < 2) continue; // Need at least 2 bins to draw a route

        try {
          // Build route: warehouse -> bins -> warehouse (round trip)
          const binCoordinates = routeBins.map(bin => `${bin.longitude},${bin.latitude}`);
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

            // Determine color for this route (cycle through colors)
            const routeColor = ROUTE_COLORS[i % ROUTE_COLORS.length];
            const isSelected = selectedRouteId === route.id;

            // Create glow polyline (thicker, semi-transparent layer underneath)
            const glowLine = new google.maps.Polyline({
              path: path,
              geodesic: false,
              strokeColor: routeColor,
              strokeOpacity: 0, // Start invisible, will animate when selected
              strokeWeight: 12,
              map: map,
              clickable: false,
              zIndex: isSelected ? 999 : 0,
            });

            // Create main polyline
            const line = new google.maps.Polyline({
              path: path,
              geodesic: false,
              strokeColor: routeColor,
              strokeOpacity: isSelected ? 1 : 0.8,
              strokeWeight: isSelected ? 6 : 4,
              map: map,
              clickable: true,
              zIndex: isSelected ? 1000 : 1,
            });

            // Add click listener - select route (zoom to it)
            if (onRouteSelect) {
              line.addListener('click', (event: google.maps.MapMouseEvent) => {
                console.log('Route selected (zoom):', route.name);
                onRouteSelect(route);
              });
            }

            // Add hover effect - show tooltip
            line.addListener('mouseover', (event: google.maps.MapMouseEvent) => {
              const currentIsSelected = selectedRouteId === route.id;
              if (!currentIsSelected) {
                line.setOptions({
                  strokeWeight: 5,
                  strokeOpacity: 0.9,
                  zIndex: 100,
                });
              }

              if (event.latLng) {
                setHoveredRoute({ route, position: event.latLng, color: routeColor });
              }
            });

            line.addListener('mouseout', () => {
              const currentIsSelected = selectedRouteId === route.id;
              if (!currentIsSelected) {
                line.setOptions({
                  strokeWeight: 4,
                  strokeOpacity: 0.8,
                  zIndex: 1,
                });
              }
              setHoveredRoute(null);
            });

            // Store polyline in the ref Map
            currentPolylines.set(route.id, { polyline: line, glowPolyline: glowLine, color: routeColor });
          }
        } catch (error) {
          console.error(`Error fetching route polyline for ${route.name}:`, error);
        } finally {
          // Mark as no longer fetching
          fetchingRoutes.current.delete(route.id);
        }
      }

      setLoading(false);
    }

    addNewRoutes();

    // Cleanup on unmount only
    return () => {
      polylinesRef.current.forEach((polylineData) => {
        polylineData.polyline.setMap(null);
        polylineData.glowPolyline.setMap(null);
      });
      polylinesRef.current.clear();
    };
  }, [map, routes, allBins, visibleRouteIds, onRouteSelect]);

  return (
    <>
      {/* Hover Tooltip */}
      {hoveredRoute && map && (
        <div
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border-2 p-4 mb-2 min-w-[280px]" style={{ borderColor: hoveredRoute.color }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredRoute.color }} />
              <h3 className="font-semibold text-gray-900 text-base">{hoveredRoute.route.name}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-sm">
                <span className="text-gray-500">Bins:</span>
                <span className="font-semibold text-gray-900 ml-1">{hoveredRoute.route.bin_count}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Duration:</span>
                <span className="font-semibold text-gray-900 ml-1">{formatDuration(hoveredRoute.route.estimated_duration_hours)}</span>
              </div>
            </div>

            {onViewDetails && (
              <button
                onClick={() => onViewDetails(hoveredRoute.route)}
                className="w-full py-2 rounded-lg text-sm font-medium text-white transition-all"
                style={{ backgroundColor: hoveredRoute.color }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                View Details
              </button>
            )}
          </div>
          {/* Arrow pointing down */}
          <div
            className="w-0 h-0 mx-auto"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${hoveredRoute.color}`,
            }}
          />
        </div>
      )}
    </>
  );
}

export function RoutesMapView({ routes, visibleRouteIds, onRouteSelect, onViewDetails, selectedRouteId }: RoutesMapViewProps) {
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  // Load all bins once
  useEffect(() => {
    async function loadBins() {
      try {
        setLoading(true);
        const bins = await getBins();
        setAllBins(bins);
      } catch (error) {
        console.error('Failed to load bins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBins();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm text-gray-600">Loading routes map...</p>
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl border border-gray-200">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm text-gray-600 mb-1">No routes to display</p>
          <p className="text-xs text-gray-500">Create your first route to see it on the map</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId="binly-routes-overview-map"
        minZoom={3}
        maxZoom={20}
        gestureHandling="greedy"
        disableDefaultUI={true}
        restriction={{
          latLngBounds: {
            north: 85,
            south: -85,
            west: -180,
            east: 180,
          },
          strictBounds: false,
        }}
        className="w-full h-full rounded-xl"
        mapTypeId="roadmap"
      >
        {/* Zoom to selected route */}
        {selectedRouteId && routes.find(r => r.id === selectedRouteId) && (
          <ZoomToRoute
            route={routes.find(r => r.id === selectedRouteId)!}
            allBins={allBins}
          />
        )}

        {/* All Routes Polylines */}
        <AllRoutesPolylines
          routes={routes}
          visibleRouteIds={visibleRouteIds}
          allBins={allBins}
          onRouteSelect={onRouteSelect}
          onViewDetails={onViewDetails}
          selectedRouteId={selectedRouteId}
          hoveredRouteId={hoveredRouteId}
        />

        {/* Bin Markers - Show numbered markers with START/END labels for all visible routes */}
        {routes.filter(r => visibleRouteIds.has(r.id)).map((route) => {
          const routeBins = allBins.filter(bin => route.bin_ids.includes(bin.id) && isMappableBin(bin));
          const routeIndex = routes.findIndex(r => r.id === route.id);
          const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
          const isSelectedRoute = selectedRouteId === route.id;

          return routeBins.map((bin, index) => {
            const isFirst = index === 0;
            const isLast = index === routeBins.length - 1;

            return (
              <AdvancedMarker
                key={`${route.id}-${bin.id}`}
                position={{ lat: bin.latitude, lng: bin.longitude }}
                zIndex={isSelectedRoute ? 10 : 8}
              >
                <div className="relative">
                  {/* Bin number marker */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                      isFirst ? 'bg-green-600 ring-4 ring-green-200' :
                      isLast ? 'bg-red-600 ring-4 ring-red-200' :
                      'bg-primary'
                    }`}
                    style={{
                      opacity: isSelectedRoute ? 1 : 0.85
                    }}
                    title={`Bin #${bin.bin_number}`}
                  >
                    {bin.bin_number}
                  </div>

                  {/* Label for first/last */}
                  {(isFirst || isLast) && (
                    <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold ${
                      isFirst ? 'text-green-700' : 'text-red-700'
                    }`}
                    style={{
                      opacity: isSelectedRoute ? 1 : 0.85
                    }}>
                      {isFirst ? 'START' : 'END'}
                    </div>
                  )}
                </div>
              </AdvancedMarker>
            );
          });
        })}

      </GoogleMap>
    </APIProvider>
  );
}
