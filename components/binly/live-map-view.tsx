'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { useNoGoZones } from '@/lib/hooks/use-zones';
import { usePotentialLocations, potentialLocationKeys } from '@/lib/hooks/use-potential-locations';
import { useActiveDrivers } from '@/lib/hooks/use-active-drivers';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
import { useWarehouseLocation, warehouseKeys } from '@/lib/hooks/use-warehouse';
import {
  Bin,
  isMappableBin,
  getBinMarkerColor,
  getFillLevelCategory,
} from '@/lib/types/bin';
import { NoGoZone, getZoneColor, getZoneColorRgba, getZoneOpacity } from '@/lib/types/zone';
import { PotentialLocation } from '@/lib/api/potential-locations';
import { Card } from '@/components/ui/card';
import { Loader2, Filter, ChevronDown } from 'lucide-react';
import { ZoneDetailsDrawer } from './zone-details-drawer';
import { BinDetailDrawer } from './bin-detail-drawer';
import { PotentialLocationDetailsDrawer } from './potential-location-details-drawer';
import { MapSearchBar } from './map-search-bar';
import { PotentialLocationPin } from '@/components/ui/potential-location-pin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

// Default map center (San Jose, CA area - center of bin operations)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Map controller for programmatic zoom/pan (must be child of Map to use useMap hook)
function MapController({
  targetLocation,
  onComplete,
}: {
  targetLocation: { lat: number; lng: number; zoom?: number } | null;
  onComplete: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !targetLocation) return;

    map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    if (targetLocation.zoom) {
      map.setZoom(targetLocation.zoom);
    }

    // Call onComplete after animation
    const timeout = setTimeout(() => {
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, targetLocation, onComplete]);

  return null;
}

// Zone rendering component (must be child of Map to use useMap hook)
function ZoneCircles({
  zones,
  showNoGoZones,
  onZoneClick,
  onZoomChange,
}: {
  zones: NoGoZone[];
  showNoGoZones: boolean;
  onZoneClick: (zone: NoGoZone) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Track zoom level changes
  useEffect(() => {
    if (!map) return;

    const zoomListener = map.addListener('zoom_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined) {
        setZoom(currentZoom);
        onZoomChange?.(currentZoom);
        console.log('🔍 Zoom changed to:', currentZoom);
      }
    });

    // Set initial zoom
    const initialZoom = map.getZoom();
    if (initialZoom !== undefined) {
      setZoom(initialZoom);
      onZoomChange?.(initialZoom);
    }

    return () => {
      google.maps.event.removeListener(zoomListener);
    };
  }, [map, onZoomChange]);

  useEffect(() => {
    console.log('🗺️ Zone rendering effect triggered:', {
      hasMap: !!map,
      showNoGoZones,
      zonesCount: zones.length,
      zoom,
      renderMode: zoom < 14 ? 'pixel-markers' : 'geographic-circles',
    });

    if (!map || !showNoGoZones) {
      console.log('⏭️ Skipping zone rendering:', { hasMap: !!map, showNoGoZones });
      return;
    }

    const circles: google.maps.Circle[] = [];

    zones.forEach((zone) => {
      // At high zoom (14+), use accurate geographic circles
      // At low zoom (<14), circles are handled via AdvancedMarker in JSX below
      if (zoom >= 14) {
        // Calculate zoom-dependent radius for smooth scaling
        const baseRadius = zone.radius_meters;
        const zoomScaleFactor = Math.pow(2, 15 - zoom);
        const adjustedRadius = baseRadius * Math.min(zoomScaleFactor, 8); // Cap at 8x for realistic appearance

        console.log('🔴 Creating geographic circle for zone:', {
          name: zone.name,
          center: { lat: zone.center_latitude, lng: zone.center_longitude },
          baseRadius: zone.radius_meters,
          adjustedRadius: Math.round(adjustedRadius),
          zoomLevel: zoom,
          scaleFactor: zoomScaleFactor.toFixed(2),
          color: getZoneColor(zone.conflict_score),
          opacity: getZoneOpacity(zone.status),
          score: zone.conflict_score,
        });

        const circle = new google.maps.Circle({
          strokeColor: getZoneColor(zone.conflict_score),
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: getZoneColor(zone.conflict_score),
          fillOpacity: getZoneOpacity(zone.status),
          map,
          center: { lat: zone.center_latitude, lng: zone.center_longitude },
          radius: adjustedRadius,
          clickable: true,
        });

        circle.addListener('click', () => {
          console.log('🖱️ Zone circle clicked:', zone.name);
          onZoneClick(zone);
        });

        circles.push(circle);
      }
    });

    console.log(`✅ Total circles created: ${circles.length} (zoom: ${zoom})`);

    return () => {
      console.log(`🧹 Cleaning up ${circles.length} circles`);
      circles.forEach((circle) => circle.setMap(null));
    };
  }, [map, zones, showNoGoZones, zoom, onZoneClick]);

  return null;
}

export function LiveMapView() {
  const queryClient = useQueryClient();
  const { data: warehouse } = useWarehouseLocation();

  // Get auth token from localStorage (Zustand persist storage)
  const getAuthToken = () => {
    try {
      const authStorage = localStorage.getItem('binly-auth-storage');
      if (!authStorage) return null;

      const parsed = JSON.parse(authStorage);
      return parsed?.state?.token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const token = getAuthToken();

  // React Query hooks for data fetching
  const { data: bins = [], isLoading: loadingBins, error: binsError } = useBins();
  const { data: zones = [], isLoading: loadingZones, error: zonesError } = useNoGoZones('active');
  const { data: potentialLocations = [], isLoading: loadingLocations, error: locationsError } = usePotentialLocations('active');
  const { drivers = [], isLoading: loadingDrivers } = useActiveDrivers({ token: token || undefined });

  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [selectedZone, setSelectedZone] = useState<NoGoZone | null>(null);
  const [selectedPotentialLocation, setSelectedPotentialLocation] = useState<PotentialLocation | null>(null);
  const [showFillLevels, setShowFillLevels] = useState(true);
  const [showNoGoZones, setShowNoGoZones] = useState(true);
  const [showPotentialLocations, setShowPotentialLocations] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [driverFilter, setDriverFilter] = useState<'all' | 'on_shift'>('all');
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const wsUrl = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`;

  // WebSocket connection for real-time updates
  const { status: wsStatus } = useWebSocket({
    url: wsUrl,
    onMessage: (message: WebSocketMessage) => {
      switch (message.type) {
        case 'potential_location_created':
          // Invalidate and refetch to get the new location
          queryClient.invalidateQueries({ queryKey: potentialLocationKeys.list('active') });
          break;

        case 'potential_location_deleted':
          // Remove from cache immediately for instant UI update
          const deleteData = message.data as { location_id: string };
          queryClient.setQueryData<PotentialLocation[]>(
            potentialLocationKeys.list('active'),
            (old) => old?.filter((loc) => loc.id !== deleteData.location_id) || []
          );
          // Close drawer if it's the deleted location
          setSelectedPotentialLocation((current) =>
            current?.id === deleteData.location_id ? null : current
          );
          break;

        case 'potential_location_converted':
          // Remove from potential locations list
          const convertData = message.data as { location_id: string; bin: unknown };
          queryClient.setQueryData<PotentialLocation[]>(
            potentialLocationKeys.list('active'),
            (old) => old?.filter((loc) => loc.id !== convertData.location_id) || []
          );
          // Close drawer if it's the converted location
          setSelectedPotentialLocation((current) =>
            current?.id === convertData.location_id ? null : current
          );
          // Refetch bins to show the new bin on the map
          queryClient.invalidateQueries({ queryKey: ['bins'] });
          break;

        case 'warehouse_location_updated':
          // Invalidate warehouse location cache to trigger refetch
          console.log('📍 Warehouse location updated via WebSocket, invalidating cache...');
          queryClient.invalidateQueries({ queryKey: warehouseKeys.location });
          break;

        default:
          // Ignore other message types
          break;
      }
    },
    autoReconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
  });

  // Check URL params for bin ID and zoom to it
  useEffect(() => {
    if (!bins.length) return;

    const urlParams = new URLSearchParams(window.location.search);
    const binId = urlParams.get('bin');

    if (binId) {
      const bin = bins.find((b) => b.id === binId);
      if (bin && isMappableBin(bin)) {
        // Zoom to the bin
        setTargetLocation({ lat: bin.latitude, lng: bin.longitude, zoom: 16 });
        setSelectedBin(bin);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [bins]);

  // Check URL params for lat/lng/zoom (from potential location "View on Live Map")
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    const zoom = urlParams.get('zoom');

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const zoomLevel = zoom ? parseInt(zoom) : 16;

      if (!isNaN(latitude) && !isNaN(longitude)) {
        console.log('🗺️ [LIVE MAP] Zooming to location from URL:', { lat: latitude, lng: longitude, zoom: zoomLevel });
        setTargetLocation({ lat: latitude, lng: longitude, zoom: zoomLevel });
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []); // Run once on mount

  // Combined loading and error states
  const loading = loadingBins || loadingZones || loadingLocations;
  const error = binsError?.message || zonesError?.message || locationsError?.message || null;

  // Memoize filtered bins to prevent recalculation on every render
  const mappableBins = useMemo(() => bins.filter(isMappableBin), [bins]);

  // Memoize potential locations with valid coordinates
  const mappablePotentialLocations = useMemo(
    () => potentialLocations.filter((loc) => loc.latitude != null && loc.longitude != null),
    [potentialLocations]
  );

  // Memoize filtered drivers based on filter mode
  const filteredDrivers = useMemo(() => {
    const driversWithLocation = drivers.filter((d) => d.currentLocation);

    if (driverFilter === 'on_shift') {
      return driversWithLocation.filter((d) => d.shiftId != null);
    }

    return driversWithLocation;
  }, [drivers, driverFilter]);

  // Handle search result selection
  const handleSearchResult = (result: { type: 'bin' | 'zone'; data: Bin | NoGoZone }) => {
    if (result.type === 'bin') {
      const bin = result.data as Bin;
      if (isMappableBin(bin)) {
        setTargetLocation({ lat: bin.latitude, lng: bin.longitude, zoom: 16 });
        setSelectedBin(bin);
        setSelectedZone(null);
      }
    } else {
      const zone = result.data as NoGoZone;
      setTargetLocation({ lat: zone.center_latitude, lng: zone.center_longitude, zoom: 14 });
      setSelectedZone(zone);
      setSelectedBin(null);
    }
  };

  return (
    <div className="relative h-[calc(100vh-64px)] lg:h-[calc(100vh-80px)] w-full">
      {/* Mobile Drag Handle - Top of screen for scrolling */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-20 z-20 pointer-events-auto">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-400/50 rounded-full" />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-gray-600">Loading map and bins...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="bg-red-50 border-red-200 p-4">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </Card>
        </div>
      )}

      {/* Search Bar (Desktop) and Navigation Tabs (All) - Top Center */}
      {!loading && (
        <>
          {/* Search Bar - Desktop only */}
          <div className="absolute top-4 lg:top-8 left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-3 lg:px-4 pointer-events-auto">
            <div className="flex flex-col gap-3">
              <div className="hidden lg:block">
                <MapSearchBar
                  bins={bins}
                  zones={zones}
                  onSelectResult={handleSearchResult}
                />
              </div>
            </div>
          </div>

          {/* Filter/Stats Button - Top Right */}
          <div className="absolute top-4 lg:top-8 right-3 lg:right-6 z-10 pointer-events-auto">
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-all group"
              >
                <Filter className="w-4 h-4 text-gray-700" />
                <span className="font-semibold text-sm text-gray-900 hidden sm:inline">Filters</span>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Panel */}
              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Stats Section */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Map Overview</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-600 mb-0.5">Total Bins</div>
                        <div className="text-2xl font-bold text-gray-900">{bins.length}</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-600 mb-0.5">Critical</div>
                        <div className="text-2xl font-bold text-red-600">
                          {bins.filter((b) => (b.fill_percentage ?? 0) >= 80).length}
                        </div>
                      </div>
                      {bins.filter((b) => b.status === 'missing').length > 0 && (
                        <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2">
                          <div className="text-xs text-gray-600 mb-0.5">Missing</div>
                          <div className="text-2xl font-bold text-gray-600">
                            {bins.filter((b) => b.status === 'missing').length}
                          </div>
                        </div>
                      )}
                      {zones.length > 0 && (
                        <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2">
                          <div className="text-xs text-gray-600 mb-0.5">No-Go Zones</div>
                          <div className="text-2xl font-bold text-red-600">{zones.length}</div>
                        </div>
                      )}
                      {potentialLocations.length > 0 && (
                        <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2">
                          <div className="text-xs text-gray-600 mb-0.5">Potential</div>
                          <div className="text-2xl font-bold text-orange-600">{potentialLocations.length}</div>
                        </div>
                      )}
                      {drivers.filter(d => d.currentLocation).length > 0 && (
                        <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2 col-span-2">
                          <div className="text-xs text-gray-600 mb-2">Active Drivers</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDriverFilter('all')}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                driverFilter === 'all'
                                  ? 'bg-green-600 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              All ({drivers.filter(d => d.currentLocation).length})
                            </button>
                            <button
                              onClick={() => setDriverFilter('on_shift')}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                driverFilter === 'on_shift'
                                  ? 'bg-green-600 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              On Shift ({drivers.filter(d => d.currentLocation && d.shiftId).length})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Filter Section */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Toggle Layers</h3>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <span className="text-sm text-gray-700">Bin Fill Levels</span>
                        <input
                          type="checkbox"
                          checked={showFillLevels}
                          onChange={(e) => setShowFillLevels(e.target.checked)}
                          className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      {zones.length > 0 && (
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <span className="text-sm text-gray-700">No-Go Zones</span>
                          <input
                            type="checkbox"
                            checked={showNoGoZones}
                            onChange={(e) => setShowNoGoZones(e.target.checked)}
                            className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                      )}
                      {potentialLocations.length > 0 && (
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <span className="text-sm text-gray-700">Potential Locations</span>
                          <input
                            type="checkbox"
                            checked={showPotentialLocations}
                            onChange={(e) => setShowPotentialLocations(e.target.checked)}
                            className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                      )}
                      {drivers.filter(d => d.currentLocation).length > 0 && (
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <span className="text-sm text-gray-700">Driver Locations</span>
                          <input
                            type="checkbox"
                            checked={showDrivers}
                            onChange={(e) => setShowDrivers(e.target.checked)}
                            className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Legend/Info Button - Bottom Right (Floating) */}
      {!loading && (
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="fixed bottom-28 lg:bottom-20 right-4 z-20 w-12 h-12 bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary/90 transition-all duration-200 group"
          title="Map Legend & Help"
        >
          <svg
            className="w-6 h-6 text-white transition-transform group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {bins.filter((b) => (b.fill_percentage ?? 0) >= 80).length > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
      )}

      {/* Collapsible Legend Panel - Bottom Right (Above button) */}
      {showLegend && (
        <div className="fixed bottom-44 lg:bottom-36 right-3 lg:right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-3 lg:p-4 w-72 max-h-[60vh] overflow-y-auto animate-scale-in">
          {/* Fill Levels Legend */}
          {showFillLevels && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Fill Level Legend
              </p>
              <div className="space-y-1.5">
                <LegendItem color="#10B981" label="Low (0-25%)" />
                <LegendItem color="#F59E0B" label="Medium (25-50%)" />
                <LegendItem color="#F97316" label="High (50-80%)" />
                <LegendItem color="#EF4444" label="Critical (80%+)" />
                <LegendItem color="#9CA3AF" label="Unknown" />
              </div>
            </div>
          )}

          {/* No-Go Zones Legend */}
          {showNoGoZones && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Zone Severity Legend
              </p>
              <div className="space-y-1.5">
                <LegendItem color="#F59E0B" label="Low (0-15)" />
                <LegendItem color="#F97316" label="Medium (16-30)" />
                <LegendItem color="#EF4444" label="High (31-50)" />
                <LegendItem color="#DC2626" label="Critical (51+)" />
              </div>
            </div>
          )}
        </div>
      )}


      {/* Bin Details Drawer - Right Side */}
      {selectedBin && (
        <BinDetailDrawer
          bin={selectedBin as any}
          onClose={() => setSelectedBin(null)}
        />
      )}

      {/* Zone Details Drawer - Right Side */}
      {selectedZone && (
        <ZoneDetailsDrawer
          zone={selectedZone}
          onClose={() => setSelectedZone(null)}
        />
      )}

      {/* Potential Location Details Drawer - Right Side */}
      {selectedPotentialLocation && (
        <PotentialLocationDetailsDrawer
          location={selectedPotentialLocation}
          onClose={() => setSelectedPotentialLocation(null)}
          onConvert={() => {}}
          onDelete={() => {}}
        />
      )}


      {/* Google Map */}
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          mapId="binly-live-map"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
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
          style={{ width: '100%', height: '100%' }}
        >
        {/* Map controller for search navigation */}
        <MapController
          targetLocation={targetLocation}
          onComplete={() => setTargetLocation(null)}
        />

        {/* Render zone circles (geographic at zoom >= 8) */}
        <ZoneCircles
          zones={zones}
          showNoGoZones={showNoGoZones}
          onZoneClick={(zone) => {
            setSelectedBin(null);
            setSelectedZone(zone);
          }}
          onZoomChange={setCurrentZoom}
        />

        {/* Render pixel-based zone markers at low/medium zoom (< 14) */}
        {showNoGoZones &&
          currentZoom < 14 &&
          zones.map((zone) => (
            <AdvancedMarker
              key={zone.id}
              position={{
                lat: zone.center_latitude,
                lng: zone.center_longitude,
              }}
              zIndex={1}
              onClick={() => {
                setSelectedBin(null);
                setSelectedZone(zone);
              }}
            >
              <div
                className="rounded-full shadow-lg cursor-pointer transition-all duration-300 hover:scale-110 animate-scale-in"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: getZoneColorRgba(zone.conflict_score, 0.4),
                }}
                title={`${zone.name} - Score: ${zone.conflict_score}`}
              />
            </AdvancedMarker>
          ))}

        {/* Render bin markers */}
        {showFillLevels &&
          mappableBins.map((bin) => (
            <AdvancedMarker
              key={bin.id}
              position={{ lat: bin.latitude, lng: bin.longitude }}
              zIndex={10}
              onClick={() => setSelectedBin(bin)}
            >
              <div
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-300 animate-scale-in"
                style={{
                  backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                }}
                title={`Bin #${bin.bin_number} - ${bin.status === 'missing' ? 'MISSING' : `${bin.fill_percentage ?? 0}%`}`}
              >
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {bin.bin_number}
                </div>
              </div>
            </AdvancedMarker>
          ))}

        {/* Render potential location markers */}
        {showPotentialLocations &&
          mappablePotentialLocations.map((location) => (
            <AdvancedMarker
              key={location.id}
              position={{ lat: location.latitude!, lng: location.longitude! }}
              zIndex={9}
              onClick={() => setSelectedPotentialLocation(location)}
            >
              <div
                className="cursor-pointer transition-all duration-300 hover:scale-110 animate-scale-in"
                title={`Potential Location: ${location.street}, ${location.city}`}
              >
                <PotentialLocationPin size={40} />
              </div>
            </AdvancedMarker>
          ))}

        {/* Render driver markers with initials */}
        {showDrivers &&
          filteredDrivers.map((driver) => {
              const initials = driver.driverName.split(' ').map(n => n[0]).join('').toUpperCase();
              const statusColor =
                driver.status === 'active'
                  ? '#10B981' // Green for active
                  : driver.status === 'paused'
                  ? '#F59E0B' // Orange for paused
                  : '#6B7280'; // Gray for inactive/ended

              return (
                <AdvancedMarker
                  key={driver.driverId}
                  position={{
                    lat: driver.currentLocation!.latitude,
                    lng: driver.currentLocation!.longitude,
                  }}
                  zIndex={15} // Higher than bins so drivers appear on top
                  onClick={() => {
                    // TODO: Add driver detail drawer if needed
                    console.log('Driver clicked:', driver.driverName);
                  }}
                >
                  <div className="relative">
                    {/* Driver avatar - simple circle with initials */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer transition-all duration-300 shadow-lg hover:scale-110 ${
                        driver.status === 'active' ? 'animate-pulse' : ''
                      }`}
                      style={{ backgroundColor: statusColor }}
                      title={`${driver.driverName} - ${driver.status}`}
                    >
                      {initials}
                    </div>

                    {/* Heading indicator (optional - only if heading is available) */}
                    {driver.currentLocation!.heading !== undefined && driver.status === 'active' && (
                      <div
                        className="absolute -top-2 left-1/2 -translate-x-1/2"
                        style={{
                          transform: `translateX(-50%) rotate(${driver.currentLocation!.heading}deg)`,
                        }}
                      >
                        <div
                          className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-transparent"
                          style={{ borderBottomColor: statusColor }}
                        />
                      </div>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

        {/* Warehouse marker - Home icon */}
        {warehouse && (
        <AdvancedMarker
          position={{ lat: warehouse.latitude, lng: warehouse.longitude }}
          zIndex={20} // Highest to appear above everything
          title={warehouse.address || "Warehouse - Base of Operations"}
        >
          <div className="relative">
            {/* Home icon container */}
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl border-4 border-white cursor-pointer transition-all duration-300 hover:scale-110">
              <svg
                className="w-7 h-7 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
          </div>
        </AdvancedMarker>
        )}
        </Map>
      </APIProvider>
    </div>
  );
}

// Helper Components
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
