'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Loader2, Radio, AlertCircle, BatteryWarning, BatteryFull, Search, RefreshCw, ChevronDown, HelpCircle } from 'lucide-react';
import { useAirTags, useSyncAirTags } from '@/lib/hooks/use-airtags';
import type { AirTagLocation } from '@/lib/api/airtags';
import { AirTagDetailDrawer } from './airtag-detail-drawer';

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
  const { data, isLoading, isError, error } = useAirTags();
  const locations = data?.locations ?? [];
  const unmatched = data?.unmatched ?? [];
  const lastSyncAt = data?.lastSyncAt ?? null;
  const [showUnmatched, setShowUnmatched] = useState(false);
  const { mutate: triggerSync, isPending: isSyncing } = useSyncAirTags();
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
  const agingCount = filteredLocations.filter((l) => {
    const diff = Date.now() - new Date(l.last_seen).getTime();
    return diff >= 30 * 60000 && diff <= 2 * 60 * 60000; // 30 min – 2 hr
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
      {/* Row 1: Title badge + Search bar + Sync button */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center gap-3">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h2 className="text-sm font-semibold text-gray-900">AirTag Tracker</h2>
            <p className="text-xs text-gray-500">FindMy Network</p>
          </div>
        </div>

        <div className="flex-1 max-w-md">
          <AirTagSearchBar locations={filteredLocations} onSelect={handleSearchSelect} />
        </div>

        <button
          onClick={() => triggerSync()}
          disabled={isSyncing}
          className="bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3 py-2 flex items-center gap-1.5 hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium text-gray-700 hidden sm:inline">
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </span>
        </button>
      </div>

      {/* Row 2: Battery filter + Last Seen stats */}
      <div className="absolute top-[68px] left-4 right-4 z-30 flex items-center justify-between">
        {/* Battery filter */}
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md px-1.5 py-1">
          <div className="flex items-center gap-1 pl-2 pr-1">
            <BatteryFull className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Battery</span>
          </div>
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
                className={`rounded-full px-2.5 py-1 flex items-center gap-1.5 transition-all text-xs font-medium ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50'
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

        {/* Last Seen stats */}
        <div className="hidden md:flex items-center gap-2.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md px-3.5 py-1.5">
          <span className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{totalTags}</span> Tags
          </span>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-500 flex items-center gap-1" title="Seen in the last 30 minutes">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium text-green-600">{recentCount}</span>
            <span className="hidden lg:inline">&lt;30m</span>
          </span>
          {agingCount > 0 && (
            <>
              <span className="text-gray-200">|</span>
              <span className="text-xs text-gray-500 flex items-center gap-1" title="Seen 30 min – 2 hours ago">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-600">{agingCount}</span>
                <span className="hidden lg:inline">30m–2h</span>
              </span>
            </>
          )}
          {staleCount > 0 && (
            <>
              <span className="text-gray-200">|</span>
              <span className="text-xs text-gray-500 flex items-center gap-1" title="Not seen for over 2 hours">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-medium text-red-500">{staleCount}</span>
                <span className="hidden lg:inline">&gt;2h</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Detail Drawer (shown on marker click) */}
      {selectedLocation && (
        <AirTagDetailDrawer
          location={selectedLocation}
          lastSyncAt={lastSyncAt}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {/* Unmatched Tags Panel */}
      <div className="absolute bottom-6 left-4 z-30 max-w-xs">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-md overflow-hidden">
          <button
            onClick={() => unmatched.length > 0 && setShowUnmatched(!showUnmatched)}
            className={`w-full px-3 py-2 flex items-center gap-2 transition-colors ${unmatched.length > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
          >
            {unmatched.length > 0 ? (
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Radio className="w-3.5 h-3.5 text-green-500" />
            )}
            <span className="text-xs font-semibold text-gray-700">
              {unmatched.length === 0
                ? 'All Tags Matched'
                : `${unmatched.length} Unmatched Tag${unmatched.length !== 1 ? 's' : ''}`}
            </span>
            {unmatched.length > 0 && (
              <ChevronDown
                className={`w-3 h-3 text-gray-400 ml-auto transition-transform ${showUnmatched ? 'rotate-180' : ''}`}
              />
            )}
          </button>
          {showUnmatched && unmatched.length > 0 && (
            <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
              {unmatched.map((tag) => (
                <div
                  key={tag.id}
                  className="px-3 py-2 border-b border-gray-50 last:border-b-0"
                >
                  <p className="text-xs font-medium text-gray-800">{tag.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {tag.city || 'No address'} &middot; {formatLastSeen(tag.last_seen)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
