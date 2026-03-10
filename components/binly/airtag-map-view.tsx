'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Loader2, Radio, X, MapPin, Clock } from 'lucide-react';
import { MapSearchBar } from './map-search-bar';

// Default map center (San Jose, CA area - center of bin operations)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// AirTag marker color (primary blue)
const AIRTAG_MARKER_COLOR = '#4880FF';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AirTagLocation {
  id: string;
  name: string;
  bin_number: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  last_seen: string; // ISO timestamp
}

// ── Mock Data (replace with API call to binly-findmy-bridge) ────────────────

const MOCK_AIRTAG_LOCATIONS: AirTagLocation[] = [
  { id: '1', name: 'Bin 46', bin_number: 46, latitude: 37.3352, longitude: -121.8811, address: 'S 1st St', city: 'San Jose, CA', last_seen: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: '2', name: 'Bin 47', bin_number: 47, latitude: 37.3501, longitude: -121.9050, address: 'The Alameda', city: 'San Jose, CA', last_seen: new Date(Date.now() - 25 * 60000).toISOString() },
  { id: '3', name: 'Bin 48', bin_number: 48, latitude: 37.3230, longitude: -121.9190, address: 'Bascom Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 8 * 60000).toISOString() },
  { id: '4', name: 'Bin 49', bin_number: 49, latitude: 37.3680, longitude: -121.9280, address: 'Stevens Creek Blvd', city: 'Santa Clara, CA', last_seen: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '5', name: 'Bin 50', bin_number: 50, latitude: 37.3860, longitude: -121.9630, address: 'El Camino Real', city: 'Sunnyvale, CA', last_seen: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '6', name: 'Bin 51', bin_number: 51, latitude: 37.3920, longitude: -122.0790, address: 'W Bayshore Rd', city: 'Palo Alto, CA', last_seen: new Date(Date.now() - 9 * 60000).toISOString() },
  { id: '7', name: 'Bin 52', bin_number: 52, latitude: 37.3100, longitude: -121.8700, address: 'Tully Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: '8', name: 'Bin 53', bin_number: 53, latitude: 37.3560, longitude: -121.8460, address: 'Alum Rock Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 5 * 60 * 60000).toISOString() },
  { id: '9', name: 'Bin 54', bin_number: 54, latitude: 37.4050, longitude: -122.0250, address: 'El Camino Real', city: 'Redwood City, CA', last_seen: new Date(Date.now() - 8 * 60000).toISOString() },
  { id: '10', name: 'Bin 55', bin_number: 55, latitude: 37.3750, longitude: -121.8550, address: 'Piedmont Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 32 * 60000).toISOString() },
  { id: '11', name: 'Bin 56', bin_number: 56, latitude: 37.3290, longitude: -121.9500, address: 'Saratoga Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 14 * 60000).toISOString() },
  { id: '12', name: 'Bin 57', bin_number: 57, latitude: 37.3020, longitude: -121.8500, address: 'Capitol Expy', city: 'San Jose, CA', last_seen: new Date(Date.now() - 22 * 60000).toISOString() },
  { id: '13', name: 'Bin 58', bin_number: 58, latitude: 37.3430, longitude: -121.8320, address: 'White Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 6 * 60000).toISOString() },
  { id: '14', name: 'Bin 59', bin_number: 59, latitude: 37.3610, longitude: -121.8680, address: 'N Capitol Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 11 * 60000).toISOString() },
  { id: '15', name: 'Bin 60', bin_number: 60, latitude: 37.3180, longitude: -121.9680, address: 'Prospect Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 7 * 60000).toISOString() },
  { id: '16', name: 'Bin 61', bin_number: 61, latitude: 37.3980, longitude: -122.0560, address: 'Middlefield Rd', city: 'Redwood City, CA', last_seen: new Date(Date.now() - 16 * 60000).toISOString() },
  { id: '17', name: 'Bin 62', bin_number: 62, latitude: 37.3850, longitude: -122.0830, address: 'El Camino Real', city: 'Palo Alto, CA', last_seen: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString() },
  { id: '18', name: 'Bin 63', bin_number: 63, latitude: 37.2950, longitude: -121.8960, address: 'Blossom Hill Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '19', name: 'Bin 64', bin_number: 64, latitude: 37.3710, longitude: -121.9120, address: 'Park Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 19 * 60000).toISOString() },
  { id: '20', name: 'Bin 65', bin_number: 65, latitude: 37.3560, longitude: -121.9380, address: 'Winchester Blvd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 10 * 60000).toISOString() },
  { id: '21', name: 'Bin 66', bin_number: 66, latitude: 37.3380, longitude: -121.8060, address: 'Story Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 27 * 60000).toISOString() },
  { id: '22', name: 'Bin 67', bin_number: 67, latitude: 37.3480, longitude: -121.9750, address: 'Saratoga Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 4 * 60000).toISOString() },
  { id: '23', name: 'Bin 68', bin_number: 68, latitude: 37.3120, longitude: -121.9280, address: 'Hamilton Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '24', name: 'Bin 69', bin_number: 69, latitude: 37.3340, longitude: -121.8240, address: '295 S White Rd', city: 'San Jose, CA', last_seen: new Date(Date.now() - 7 * 60000).toISOString() },
  { id: '25', name: 'Bin 70', bin_number: 70, latitude: 37.4860, longitude: -122.2310, address: 'Broadway', city: 'Redwood City, CA', last_seen: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '26', name: 'Bin 71', bin_number: 71, latitude: 37.4540, longitude: -122.1780, address: 'Middlefield Rd', city: 'Redwood City, CA', last_seen: new Date(Date.now() - 16 * 60000).toISOString() },
  { id: '27', name: 'Bin 72', bin_number: 72, latitude: 37.2810, longitude: -121.9450, address: 'Camden Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 35 * 60000).toISOString() },
  { id: '28', name: 'Bin 73', bin_number: 73, latitude: 37.3630, longitude: -121.9950, address: 'Stevens Creek Blvd', city: 'Cupertino, CA', last_seen: new Date(Date.now() - 21 * 60000).toISOString() },
  { id: '29', name: 'Bin 74', bin_number: 74, latitude: 37.3770, longitude: -121.9430, address: 'Forest Ave', city: 'San Jose, CA', last_seen: new Date(Date.now() - 9 * 60000).toISOString() },
  { id: '30', name: 'Bin 75', bin_number: 75, latitude: 37.3950, longitude: -121.9780, address: 'Monroe St', city: 'Santa Clara, CA', last_seen: new Date(Date.now() - 42 * 60000).toISOString() },
  { id: '31', name: 'Bin 76', bin_number: 76, latitude: 37.4110, longitude: -121.9420, address: 'Great America Pkwy', city: 'Santa Clara, CA', last_seen: new Date(Date.now() - 13 * 60000).toISOString() },
  { id: '32', name: 'Bin 77', bin_number: 77, latitude: 37.4230, longitude: -122.0980, address: 'University Ave', city: 'Palo Alto, CA', last_seen: new Date(Date.now() - 20 * 60000).toISOString() },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatLastSeen(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getLastSeenColor(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 30) return '#10B981'; // green — recent
  if (minutes < 120) return '#F59E0B'; // amber — aging
  return '#EF4444'; // red — stale
}

// ── Map Controller ─────────────────────────────────────────────────────────────

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
    if (targetLocation.zoom) map.setZoom(targetLocation.zoom);
    const timeout = setTimeout(onComplete, 500);
    return () => clearTimeout(timeout);
  }, [map, targetLocation, onComplete]);

  return null;
}

// ── AirTag Marker Layer ────────────────────────────────────────────────────────

function AirTagMarkerLayer({
  locations,
  onMarkerClick,
}: {
  locations: AirTagLocation[];
  onMarkerClick: (location: AirTagLocation) => void;
}) {
  const map = useMap();
  const markersRef = useMemo<{
    current: globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>;
  }>(() => ({ current: new globalThis.Map() }), []);

  const handleClick = useCallback(
    (loc: AirTagLocation) => onMarkerClick(loc),
    [onMarkerClick]
  );

  useEffect(() => {
    if (!map) return;

    const prevMarkers = markersRef.current;
    const newIds = new Set(locations.map((l) => l.id));

    // Remove stale markers
    prevMarkers.forEach((marker, id) => {
      if (!newIds.has(id)) {
        marker.map = null;
        prevMarkers.delete(id);
      }
    });

    // Add new markers
    locations.forEach((loc) => {
      if (prevMarkers.has(loc.id)) return;

      const lastSeenColor = getLastSeenColor(loc.last_seen);

      const el = document.createElement('div');
      el.style.cssText = `
        width:32px;height:32px;border-radius:50%;
        background:${AIRTAG_MARKER_COLOR};border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:11px;font-weight:700;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        cursor:pointer;transition:transform .15s;
        position:relative;
      `;
      el.textContent = String(loc.bin_number);
      el.title = `${loc.name} — ${loc.address}, ${loc.city}`;

      // Last-seen indicator dot (bottom-right)
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:absolute;bottom:-1px;right:-1px;
        width:10px;height:10px;border-radius:50%;
        background:${lastSeenColor};border:2px solid #fff;
      `;
      el.appendChild(dot);

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: loc.latitude, lng: loc.longitude },
        content: el,
        zIndex: 10,
      });
      marker.addListener('click', () => handleClick(loc));
      prevMarkers.set(loc.id, marker);
    });
  }, [map, locations, handleClick, markersRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => {
        m.map = null;
      });
      markersRef.current.clear();
    };
  }, [markersRef]);

  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AirTagMapView() {
  const [locations] = useState<AirTagLocation[]>(MOCK_AIRTAG_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<AirTagLocation | null>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  const isLoading = false; // Will be replaced with actual loading state from API

  const handleMarkerClick = useCallback((loc: AirTagLocation) => {
    setSelectedLocation(loc);
    setTargetLocation({ lat: loc.latitude, lng: loc.longitude, zoom: 16 });
  }, []);

  const handleSearchSelect = useCallback(
    (result: { lat: number; lng: number; binId?: string }) => {
      setTargetLocation({ lat: result.lat, lng: result.lng, zoom: 16 });

      // Try to find a matching AirTag location near the search result
      if (result.binId) {
        const match = locations.find((l) => l.id === result.binId);
        if (match) setSelectedLocation(match);
      }
    },
    [locations]
  );

  // Stats
  const totalTags = locations.length;
  const recentCount = locations.filter((l) => {
    const diff = Date.now() - new Date(l.last_seen).getTime();
    return diff < 30 * 60000; // last 30 min
  }).length;
  const staleCount = locations.filter((l) => {
    const diff = Date.now() - new Date(l.last_seen).getTime();
    return diff > 2 * 60 * 60000; // over 2 hours
  }).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-gray-500">Loading AirTag locations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gray-100">
      {/* Header Badge */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-3">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AirTag Tracker</h2>
            <p className="text-xs text-gray-500">FindMy Network</p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="hidden md:flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-gray-700">{totalTags} Tags</span>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-gray-700">{recentCount} Recent</span>
          </div>
          {staleCount > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3 py-1.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-gray-700">{staleCount} Stale</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
        <MapSearchBar
          onSelect={handleSearchSelect}
        />
      </div>

      {/* Info Card (shown on marker click) */}
      {selectedLocation && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 animate-scale-in">
          <div className="bg-white rounded-2xl shadow-xl p-4 min-w-[300px] max-w-[380px] border border-gray-100">
            {/* Close button */}
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ backgroundColor: AIRTAG_MARKER_COLOR }}
              >
                {selectedLocation.bin_number}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedLocation.name}</h3>
                <div
                  className="flex items-center gap-1"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getLastSeenColor(selectedLocation.last_seen) }}
                  />
                  <span className="text-xs text-gray-500">
                    {formatLastSeen(selectedLocation.last_seen)}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">{selectedLocation.address}</p>
                  <p className="text-xs text-gray-400">{selectedLocation.city}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  Last seen {formatLastSeen(selectedLocation.last_seen)}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-4 z-30">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-md px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 mb-1">Last Seen</p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">&lt; 30 min</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-500">30 min – 2 hr</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-gray-500">&gt; 2 hr</span>
          </div>
        </div>
      </div>

      {/* Google Map */}
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          mapId="binly-airtag-map"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          minZoom={3}
          maxZoom={20}
          mapTypeId="hybrid"
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
          <MapController
            targetLocation={targetLocation}
            onComplete={() => setTargetLocation(null)}
          />

          <AirTagMarkerLayer
            locations={locations}
            onMarkerClick={handleMarkerClick}
          />
        </Map>
      </APIProvider>
    </div>
  );
}
