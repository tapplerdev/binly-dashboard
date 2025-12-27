'use client';

import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { getNoGoZones } from '@/lib/api/zones';
import {
  Bin,
  isMappableBin,
  getBinMarkerColor,
  getFillLevelCategory,
} from '@/lib/types/bin';
import { NoGoZone, getZoneColor, getZoneColorRgba, getZoneOpacity } from '@/lib/types/zone';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ZoneDetailsDrawer } from './zone-details-drawer';
import { BinDetailsDrawer } from './bin-details-drawer';

// Default map center (San Jose, CA area - center of bin operations)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

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
  const [bins, setBins] = useState<Bin[]>([]);
  const [zones, setZones] = useState<NoGoZone[]>([]);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [selectedZone, setSelectedZone] = useState<NoGoZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFillLevels, setShowFillLevels] = useState(true);
  const [showNoGoZones, setShowNoGoZones] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  // Fetch bins and zones on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [binsData, zonesData] = await Promise.all([
          getBins(),
          getNoGoZones('active'),
        ]);
        setBins(binsData);
        setZones(zonesData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filter bins with valid coordinates
  const mappableBins = bins.filter(isMappableBin);

  return (
    <div className="relative h-screen w-full">
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

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showFillLevels}
              onChange={(e) => setShowFillLevels(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
          <span className="text-sm font-medium text-gray-700">
            Fill Levels
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showNoGoZones}
              onChange={(e) => setShowNoGoZones(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
          <span className="text-sm font-medium text-gray-700">
            No-Go Zones
          </span>
        </div>

        {/* Fill Levels Legend */}
        {showFillLevels && (
          <div className="pt-3 border-t border-gray-200">
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

        {/* Stats */}
        <div className="pt-3 border-t border-gray-200">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Total Bins:</span>
              <span className="font-semibold text-gray-900">{bins.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">On Map:</span>
              <span className="font-semibold text-gray-900">
                {mappableBins.length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Active:</span>
              <span className="font-semibold text-gray-900">
                {bins.filter((b) => b.status === 'active').length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Critical:</span>
              <span className="font-semibold text-red-600">
                {bins.filter((b) => (b.fill_percentage ?? 0) >= 80).length}
              </span>
            </div>
            {showNoGoZones && (
              <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-600">No-Go Zones:</span>
                <span className="font-semibold text-red-600">{zones.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bin Details Drawer - Right Side */}
      {selectedBin && (
        <BinDetailsDrawer
          bin={selectedBin}
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

      {/* Google Map */}
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          mapId="binly-live-map"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          minZoom={3}
          maxZoom={20}
          gestureHandling="greedy"
          disableDefaultUI={false}
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
