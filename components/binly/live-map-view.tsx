'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { useNoGoZones } from '@/lib/hooks/use-zones';
import { usePotentialLocations, potentialLocationKeys } from '@/lib/hooks/use-potential-locations';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
import {
  Bin,
  isMappableBin,
  getBinMarkerColor,
  getFillLevelCategory,
} from '@/lib/types/bin';
import { NoGoZone, getZoneColor, getZoneColorRgba, getZoneOpacity } from '@/lib/types/zone';
import { PotentialLocation } from '@/lib/api/potential-locations';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
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

  // React Query hooks for data fetching
  const { data: bins = [], isLoading: loadingBins, error: binsError } = useBins();
  const { data: zones = [], isLoading: loadingZones, error: zonesError } = useNoGoZones('active');
  const { data: potentialLocations = [], isLoading: loadingLocations, error: locationsError } = usePotentialLocations('active');

  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [selectedZone, setSelectedZone] = useState<NoGoZone | null>(null);
  const [selectedPotentialLocation, setSelectedPotentialLocation] = useState<PotentialLocation | null>(null);
  const [showFillLevels, setShowFillLevels] = useState(true);
  const [showNoGoZones, setShowNoGoZones] = useState(true);
  const [showPotentialLocations, setShowPotentialLocations] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);

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

      {/* Search Bar - Top Center */}
      {!loading && (
        <div className="absolute top-4 lg:top-8 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-3 lg:px-4">
          <MapSearchBar
            bins={bins}
            zones={zones}
            onSelectResult={handleSearchResult}
          />
        </div>
      )}

      {/* Legend Button - Top Right */}
      {!loading && (
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all duration-200 group"
          title="Show Legend"
        >
          <svg
            className="w-5 h-5 text-gray-700 group-hover:text-primary transition-colors"
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

      {/* Collapsible Legend Panel - Top Right */}
      {showLegend && (
        <div className="absolute top-16 right-3 lg:right-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-3 lg:p-4 w-56 lg:w-64 animate-scale-in">
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

      {/* Bottom Stats Bar - Glassmorphism */}
      {!loading && (
        <div className="absolute bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-2rem)] lg:w-auto max-w-full">
          <div className="bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-100 px-3 lg:px-6 py-2 lg:py-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 lg:gap-4 min-w-max">
          {/* Toggle: Fill Levels */}
          <button
            onClick={() => setShowFillLevels(!showFillLevels)}
            className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-full transition-colors ${
              showFillLevels
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current shrink-0" />
            <span className="text-xs lg:text-sm font-medium whitespace-nowrap">Fill Levels</span>
          </button>

          {/* Toggle: No-Go Zones */}
          <button
            onClick={() => setShowNoGoZones(!showNoGoZones)}
            className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-full transition-colors ${
              showNoGoZones
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current shrink-0" />
            <span className="text-xs lg:text-sm font-medium whitespace-nowrap">No-Go Zones</span>
          </button>

          {/* Toggle: Potential Locations */}
          <button
            onClick={() => setShowPotentialLocations(!showPotentialLocations)}
            className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-full transition-colors ${
              showPotentialLocations
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current shrink-0" />
            <span className="text-xs lg:text-sm font-medium whitespace-nowrap">Potential Locations</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300" />

          {/* Stats */}
          <div className="flex items-center gap-2 lg:gap-4 text-xs lg:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600">Total:</span>
              <span className="font-bold text-gray-900">{bins.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600">Critical:</span>
              <span className="font-bold text-red-600">
                {bins.filter((b) => (b.fill_percentage ?? 0) >= 80).length}
              </span>
            </div>
            {showNoGoZones && zones.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">No-Go:</span>
                <span className="font-bold text-red-600">{zones.length}</span>
              </div>
            )}
            {showPotentialLocations && potentialLocations.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Potential:</span>
                <span className="font-bold text-orange-600">{potentialLocations.length}</span>
              </div>
            )}
            </div>
          </div>
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
                  backgroundColor: getBinMarkerColor(bin.fill_percentage),
                }}
                title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
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
