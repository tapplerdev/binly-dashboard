'use client';

import { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Route } from '@/lib/types/route';
import { Bin } from '@/lib/types/bin';
import { getRoutes } from '@/lib/api/routes';
import { getBins } from '@/lib/api/bins';
import { X, MapPin, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

interface RouteSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedRoute: Route, routeBins: Bin[]) => void;
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

  // Get bins for the selected route
  const routeBins = useMemo(() => {
    if (!selectedRoute) return [];
    return allBins.filter(bin => selectedRoute.bin_ids.includes(bin.id));
  }, [selectedRoute, allBins]);

  // Calculate map center based on selected route bins
  const mapCenter = useMemo(() => {
    if (routeBins.length === 0) return DEFAULT_CENTER;

    const validBins = routeBins.filter(b => b.latitude && b.longitude);
    if (validBins.length === 0) return DEFAULT_CENTER;

    const avgLat = validBins.reduce((sum, b) => sum + b.latitude, 0) / validBins.length;
    const avgLng = validBins.reduce((sum, b) => sum + b.longitude, 0) / validBins.length;

    return { lat: avgLat, lng: avgLng };
  }, [routeBins]);

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
              <h2 className="text-2xl font-bold text-gray-900">Select Route for Shift</h2>
              <p className="text-sm text-gray-600 mt-1">Click on a route to view it on the map</p>
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
                center={mapCenter}
                defaultZoom={DEFAULT_ZOOM}
                zoom={selectedRoute ? 13 : DEFAULT_ZOOM}
                mapId="route-selection-map"
                disableDefaultUI={false}
                gestureHandling="greedy"
                className="w-full h-full"
              >
                {/* Bin Markers */}
                {routeBins.map((bin) => {
                  if (!bin.latitude || !bin.longitude) return null;

                  return (
                    <AdvancedMarker
                      key={bin.id}
                      position={{ lat: bin.latitude, lng: bin.longitude }}
                    >
                      <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white">
                        {bin.bin_number}
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </Map>
            </APIProvider>

            {/* Info Overlay */}
            {selectedRoute && (
              <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
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

          {/* Routes List - Right Side */}
          <div className="w-96 border-l border-gray-200 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white shrink-0">
              <p className="text-sm font-medium text-gray-700">
                {routes.length} {routes.length === 1 ? 'route' : 'routes'} available
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {routes.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No routes found</p>
                  <p className="text-xs text-gray-400 mt-1">Create routes in Operations → Routes</p>
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
            <p className="text-sm text-gray-600">
              {selectedRoute ? (
                <>
                  Selected: <span className="font-medium text-gray-900">{selectedRoute.name}</span> ({routeBins.length} bins)
                </>
              ) : (
                'Select a route to import'
              )}
            </p>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedRoute}>
                Import Route ({routeBins.length} bins)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
