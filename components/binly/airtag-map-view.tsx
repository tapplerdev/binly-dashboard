'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Loader2, Radio, X, MapPin, Clock, AlertCircle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Search } from 'lucide-react';
import { useAirTags } from '@/lib/hooks/use-airtags';
import type { AirTagLocation } from '@/lib/api/airtags';

// Default map center (San Jose, CA area - center of bin operations)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// AirTag marker color (primary blue)
const AIRTAG_MARKER_COLOR = '#4880FF';

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

function getBatteryLabel(status: number): string {
  switch (status) {
    case 0: return 'Full';
    case 1: return 'Medium';
    case 2: return 'Low';
    case 3: return 'Critical';
    default: return 'Unknown';
  }
}

function getBatteryColor(status: number): string {
  switch (status) {
    case 0: return '#10B981'; // green
    case 1: return '#3B82F6'; // blue
    case 2: return '#F59E0B'; // amber
    case 3: return '#EF4444'; // red
    default: return '#9CA3AF'; // gray
  }
}

// ── AirTag Search Bar ─────────────────────────────────────────────────────────

function AirTagSearchBar({
  locations,
  onSelect,
}: {
  locations: AirTagLocation[];
  onSelect: (loc: AirTagLocation) => void;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return locations
      .filter((l) =>
        String(l.bin_number).includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, locations]);

  useEffect(() => {
    setSelectedIndex(0);
    setIsOpen(results.length > 0);
  }, [results]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (loc: AirTagLocation) => {
    onSelect(loc);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search bin #, name, or address..."
          className="w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30 border border-white/50"
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {results.map((loc, i) => (
            <button
              key={loc.id}
              onClick={() => handleSelect(loc)}
              className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                i === selectedIndex ? 'bg-primary/5' : 'hover:bg-gray-50'
              }`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: AIRTAG_MARKER_COLOR }}
              >
                {loc.bin_number}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{loc.name}</p>
                <p className="text-xs text-gray-400 truncate">{loc.address}, {loc.city}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    if (!map || !google.maps.marker?.AdvancedMarkerElement) return;

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

      // Battery indicator dot (top-right, only for Low/Critical)
      if (loc.battery_status >= 2) {
        const battDot = document.createElement('div');
        battDot.style.cssText = `
          position:absolute;top:-1px;right:-1px;
          width:10px;height:10px;border-radius:50%;
          background:${getBatteryColor(loc.battery_status)};border:2px solid #fff;
        `;
        el.appendChild(battDot);
      }

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
  const { data: locations = [], isLoading, isError, error } = useAirTags();
  const [selectedLocation, setSelectedLocation] = useState<AirTagLocation | null>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [batteryFilter, setBatteryFilter] = useState<number | null>(null);

  const filteredLocations = useMemo(() => {
    if (batteryFilter === null) return locations;
    return locations.filter((l) => l.battery_status === batteryFilter);
  }, [locations, batteryFilter]);

  const handleMarkerClick = useCallback((loc: AirTagLocation) => {
    setSelectedLocation(loc);
    setTargetLocation({ lat: loc.latitude, lng: loc.longitude, zoom: 16 });
  }, []);

  const handleSearchSelect = useCallback((loc: AirTagLocation) => {
    setSelectedLocation(loc);
    setTargetLocation({ lat: loc.latitude, lng: loc.longitude, zoom: 16 });
  }, []);

  // Stats (based on filtered view)
  const totalTags = filteredLocations.length;
  const recentCount = filteredLocations.filter((l) => {
    const diff = Date.now() - new Date(l.last_seen).getTime();
    return diff < 30 * 60000; // last 30 min
  }).length;
  const staleCount = filteredLocations.filter((l) => {
    const diff = Date.now() - new Date(l.last_seen).getTime();
    return diff > 2 * 60 * 60000; // over 2 hours
  }).length;
  const lowBatteryCount = locations.filter((l) => l.battery_status >= 2).length;

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

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="text-sm text-gray-700 font-medium">Failed to load AirTag locations</span>
          <span className="text-xs text-gray-500 max-w-xs">
            {error instanceof Error ? error.message : 'Could not connect to FindMy bridge service'}
          </span>
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
          {lowBatteryCount > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3 py-1.5 flex items-center gap-1.5">
              <BatteryWarning className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-gray-700">{lowBatteryCount} Low Battery</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
        <AirTagSearchBar locations={filteredLocations} onSelect={handleSearchSelect} />
      </div>

      {/* Battery Filter Chips */}
      <div className="absolute top-[60px] left-4 z-30 flex items-center gap-1.5">
        {([
          { value: null, label: 'All', color: '#6B7280' },
          { value: 0, label: 'Full', color: getBatteryColor(0) },
          { value: 1, label: 'Medium', color: getBatteryColor(1) },
          { value: 2, label: 'Low', color: getBatteryColor(2) },
          { value: 3, label: 'Critical', color: getBatteryColor(3) },
        ] as const).map((chip) => {
          const isActive = batteryFilter === chip.value;
          const count = chip.value === null
            ? locations.length
            : locations.filter((l) => l.battery_status === chip.value).length;
          return (
            <button
              key={chip.label}
              onClick={() => setBatteryFilter(chip.value)}
              className={`backdrop-blur-sm rounded-full shadow-md px-2.5 py-1 flex items-center gap-1.5 transition-all text-xs font-medium border ${
                isActive
                  ? 'bg-white border-gray-300 text-gray-900'
                  : 'bg-white/80 border-transparent text-gray-500 hover:bg-white/95'
              }`}
            >
              {chip.value !== null && (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chip.color }} />
              )}
              <span>{chip.label}</span>
              <span className="text-gray-400">{count}</span>
            </button>
          );
        })}
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
              <div className="flex items-center gap-2.5">
                {selectedLocation.battery_status === 0 && <BatteryFull className="w-4 h-4 flex-shrink-0" style={{ color: getBatteryColor(0) }} />}
                {selectedLocation.battery_status === 1 && <BatteryMedium className="w-4 h-4 flex-shrink-0" style={{ color: getBatteryColor(1) }} />}
                {selectedLocation.battery_status === 2 && <BatteryLow className="w-4 h-4 flex-shrink-0" style={{ color: getBatteryColor(2) }} />}
                {selectedLocation.battery_status === 3 && <BatteryWarning className="w-4 h-4 flex-shrink-0" style={{ color: getBatteryColor(3) }} />}
                <p className="text-xs text-gray-500" style={{ color: getBatteryColor(selectedLocation.battery_status) }}>
                  Battery: {getBatteryLabel(selectedLocation.battery_status)}
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
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} libraries={['marker']}>
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
            locations={filteredLocations}
            onMarkerClick={handleMarkerClick}
          />
        </Map>
      </APIProvider>
    </div>
  );
}
