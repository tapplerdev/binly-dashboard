'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Lasso, Navigation, Copy, ChevronDown } from 'lucide-react';
import { Route } from '@/lib/types/route';
import { useBins } from '@/lib/hooks/use-bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

interface CreateRouteModalProps {
  onClose: () => void;
  onSubmit: (routeData: Partial<Route>) => void;
  editRoute?: Route | null;
  existingRoutes?: Route[];
}

// Geographic zones removed - not needed for route creation

// Days of week for schedule picker
const DAYS_OF_WEEK = [
  { short: 'M', full: 'Mon' },
  { short: 'T', full: 'Tue' },
  { short: 'W', full: 'Wed' },
  { short: 'T', full: 'Thu' },
  { short: 'F', full: 'Fri' },
  { short: 'S', full: 'Sat' },
  { short: 'S', full: 'Sun' },
];

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Lasso Selection Component
interface LassoSelectionProps {
  allBins: Bin[];
  onBinsSelected: (bins: Bin[]) => void;
  isActive: boolean;
}

function LassoSelection({ allBins, onBinsSelected, isActive }: LassoSelectionProps) {
  const map = useMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const [lassoPath, setLassoPath] = useState<google.maps.LatLng[]>([]);
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map || !isActive) {
      // Clean up polygon if exists
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      return;
    }

    const handleMouseDown = (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      setIsDrawing(true);
      setLassoPath([e.latLng]);
    };

    const handleMouseMove = (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      setLassoPath(prev => [...prev, e.latLng!]);
    };

    const handleMouseUp = () => {
      if (!isDrawing) return;
      setIsDrawing(false);

      // Check which bins are inside the polygon
      if (lassoPath.length > 2) {
        const selectedBins = allBins.filter(bin => {
          if (!isMappableBin(bin)) return false;
          const point = new google.maps.LatLng(bin.latitude, bin.longitude);
          return google.maps.geometry.poly.containsLocation(point, new google.maps.Polygon({ paths: lassoPath }));
        });

        if (selectedBins.length > 0) {
          onBinsSelected(selectedBins);
        }
      }

      // Clear the lasso path
      setLassoPath([]);
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    };

    const mouseDownListener = map.addListener('mousedown', handleMouseDown);
    const mouseMoveListener = map.addListener('mousemove', handleMouseMove);
    const mouseUpListener = map.addListener('mouseup', handleMouseUp);

    return () => {
      google.maps.event.removeListener(mouseDownListener);
      google.maps.event.removeListener(mouseMoveListener);
      google.maps.event.removeListener(mouseUpListener);
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
    };
  }, [map, isActive, isDrawing, lassoPath, allBins, onBinsSelected]);

  // Draw the lasso polygon
  useEffect(() => {
    if (!map || lassoPath.length < 2) return;

    // Remove old polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Create new polygon
    const polygon = new google.maps.Polygon({
      paths: lassoPath,
      strokeColor: '#4880FF',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#4880FF',
      fillOpacity: 0.1,
      map: map,
    });

    polygonRef.current = polygon;
  }, [map, lassoPath]);

  return null;
}

// Route polyline component
interface RoutePreviewProps {
  bins: Bin[];
  onMapReady?: () => void;
  lassoMode?: boolean;
  allBins?: Bin[];
  onLassoSelect?: (bins: Bin[]) => void;
}

function RoutePreview({ bins, onMapReady, lassoMode = false, allBins = [], onLassoSelect }: RoutePreviewProps) {
  const map = useMap();
  const [routeStats, setRouteStats] = useState({ distance: 0, duration: 0 });
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || bins.length < 2) return;

    async function fetchRoute() {
      try {
        const coordinates = bins.map(bin => `${bin.longitude},${bin.latitude}`).join(';');
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=pk.eyJ1IjoiYmlubHl5YWkiLCJhIjoiY21pNzN4bzlhMDVheTJpcHdqd2FtYjhpeSJ9.sQM8WHE2C9zWH0xG107xhw`;

        const response = await fetch(mapboxUrl);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];

          // Update stats
          setRouteStats({
            distance: route.distance / 1609.34, // meters to miles
            duration: route.duration / 3600, // seconds to hours
          });

          // Draw polyline
          const path = route.geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
          }));

          // Clear old polyline if exists
          if (polylineRef.current) {
            polylineRef.current.setMap(null);
          }

          // Create new polyline
          const polyline = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: '#4880FF',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map,
          });

          polylineRef.current = polyline;

          // Animate polyline (pulsing effect)
          let opacity = 1;
          let direction = -0.008;

          const animate = () => {
            opacity += direction;

            // Reverse direction at bounds
            if (opacity <= 0.4) {
              direction = 0.008;
            } else if (opacity >= 1) {
              direction = -0.008;
            }

            if (polylineRef.current) {
              polylineRef.current.setOptions({ strokeOpacity: opacity });
            }

            animationFrameRef.current = requestAnimationFrame(animate);
          };

          animate();

          // Fit bounds
          if (map) {
            const bounds = new google.maps.LatLngBounds();
            bins.forEach(bin => {
              if (bin.latitude != null && bin.longitude != null) {
                bounds.extend({ lat: bin.latitude, lng: bin.longitude });
              }
            });
            map.fitBounds(bounds);
          }
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    }

    fetchRoute();

    // Cleanup function
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, bins]);

  // Expose stats to parent via callback
  useEffect(() => {
    if (onMapReady && routeStats.distance > 0) {
      onMapReady();
    }
  }, [routeStats, onMapReady]);

  // Handle lasso selection
  const handleLassoSelection = (selectedBins: Bin[]) => {
    if (onLassoSelect) {
      onLassoSelect(selectedBins);
    }
  };

  return (
    <>
      {/* Lasso Selection Tool */}
      {lassoMode && (
        <LassoSelection
          allBins={allBins}
          onBinsSelected={handleLassoSelection}
          isActive={lassoMode}
        />
      )}

      {bins.map((bin, index) => {
        const isFirst = index === 0;
        const isLast = index === bins.length - 1;

        if (bin.latitude == null || bin.longitude == null) return null;

        return (
          <AdvancedMarker
            key={bin.id}
            position={{ lat: bin.latitude, lng: bin.longitude }}
          >
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                  isFirst ? 'bg-green-600 ring-2 ring-green-200' :
                  isLast ? 'bg-red-600 ring-2 ring-red-200' :
                  'bg-primary'
                }`}
              >
                {index + 1}
              </div>
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Stats Overlay */}
      {bins.length >= 2 && routeStats.distance > 0 && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-3 border border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Bins</p>
              <p className="font-semibold text-gray-900">{bins.length}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-semibold text-gray-900">{routeStats.distance.toFixed(1)} mi</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-500">Est. Time</p>
              <p className="font-semibold text-gray-900">{routeStats.duration.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CreateRouteModal({ onClose, onSubmit, editRoute, existingRoutes: propExistingRoutes = [] }: CreateRouteModalProps) {
  // React Query hook for bins data
  const { data: allBins = [], isLoading: loading } = useBins();

  // Parse schedule_pattern back into days array
  const initialScheduleDays = editRoute?.schedule_pattern
    ? editRoute.schedule_pattern.split('/')
    : [];

  const [formData, setFormData] = useState({
    name: editRoute?.name || '',
    description: editRoute?.description || '',
    schedule_days: initialScheduleDays as string[],
    bin_ids: editRoute?.bin_ids || [] as string[],
  });

  const [selectedBins, setSelectedBins] = useState<Bin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lassoMode, setLassoMode] = useState(false);
  const [existingRoutes, setExistingRoutes] = useState<Route[]>(propExistingRoutes);
  const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
  const [isCopyClosing, setIsCopyClosing] = useState(false);
  const copyDropdownRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);

  // Handle opening animation
  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setIsOpening(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Load selected bins if editing
  useEffect(() => {
    if (editRoute?.bin_ids && allBins.length > 0) {
      const selected = allBins.filter(bin => editRoute.bin_ids.includes(bin.id));
      setSelectedBins(selected);
    }
  }, [editRoute, allBins]);

  // Close dropdown with animation
  const closeCopyDropdown = () => {
    setIsCopyClosing(true);
    setTimeout(() => {
      setIsCopyDropdownOpen(false);
      setIsCopyClosing(false);
    }, 150);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isCopyDropdownOpen &&
        copyDropdownRef.current &&
        !copyDropdownRef.current.contains(event.target as Node)
      ) {
        closeCopyDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCopyDropdownOpen]);

  // Filter bins by search
  const filteredBins = allBins.filter(bin => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bin.bin_number.toString().includes(query) ||
      bin.current_street?.toLowerCase().includes(query) ||
      bin.city?.toLowerCase().includes(query)
    );
  });

  // Toggle bin selection
  const toggleBin = (bin: Bin) => {
    if (selectedBins.find(b => b.id === bin.id)) {
      setSelectedBins(selectedBins.filter(b => b.id !== bin.id));
      setFormData({ ...formData, bin_ids: formData.bin_ids.filter(id => id !== bin.id) });
    } else {
      setSelectedBins([...selectedBins, bin]);
      setFormData({ ...formData, bin_ids: [...formData.bin_ids, bin.id] });
    }
  };

  // Toggle schedule day
  const toggleDay = (day: string) => {
    if (formData.schedule_days.includes(day)) {
      setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, schedule_days: [...formData.schedule_days, day] });
    }
  };

  // Copy from existing route
  const handleCopyFromRoute = async (routeId: string) => {
    if (!routeId) return;

    const sourceRoute = existingRoutes.find(r => r.id === routeId);
    if (!sourceRoute) return;

    // Parse schedule pattern
    const scheduleDays = sourceRoute.schedule_pattern
      ? sourceRoute.schedule_pattern.split('/')
      : [];

    // Update form data
    setFormData({
      name: `${sourceRoute.name} (Copy)`,
      description: sourceRoute.description || '',
      schedule_days: scheduleDays,
      bin_ids: sourceRoute.bin_ids,
    });

    // Load and select bins
    const selected = allBins.filter(bin => sourceRoute.bin_ids.includes(bin.id));
    setSelectedBins(selected);

    // Close dropdown
    closeCopyDropdown();
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert schedule days to pattern string
    const schedule_pattern = formData.schedule_days.length > 0
      ? formData.schedule_days.join('/')
      : undefined;

    onSubmit({
      name: formData.name,
      description: formData.description,
      geographic_area: 'General', // Default value since backend requires it
      schedule_pattern,
      bin_ids: formData.bin_ids,
      bin_count: formData.bin_ids.length,
      estimated_duration_hours: 6, // Will be calculated from Mapbox
    });
    handleClose();
  };

  const mappableBins = selectedBins.filter(isMappableBin);

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${isClosing ? 'opacity-0' : isOpening ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-white rounded-2xl w-full h-[90vh] max-w-7xl overflow-hidden flex flex-col shadow-2xl transition-all duration-200 ease-in-out ${isClosing ? 'scale-95 opacity-0' : isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            {editRoute ? 'Edit Route' : 'Create New Route'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-fast"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Form (40%) */}
          <div className="w-[40%] border-r border-gray-200 flex flex-col">
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Copy from Existing Route */}
              {!editRoute && existingRoutes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Copy className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-gray-700">Copy from Existing Route</h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">Start with an existing route template and customize it</p>

                  {/* Custom Dropdown */}
                  <div className="relative" ref={copyDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCopyDropdownOpen(!isCopyDropdownOpen)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white hover:bg-blue-50/50 transition-all flex items-center justify-between"
                    >
                      <span className="text-gray-700">Select a route to copy...</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>

                    {isCopyDropdownOpen && (
                      <div className={`absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50 ${isCopyClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
                        {existingRoutes.map(route => (
                          <button
                            key={route.id}
                            type="button"
                            onClick={() => handleCopyFromRoute(route.id)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{route.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {route.bin_count} bins • {route.geographic_area}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Route Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Route 5 - Downtown Commercial"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this route..."
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Schedule Pattern */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Schedule Pattern</h3>
                <p className="text-xs text-gray-500 mb-3">Select days this route typically runs</p>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const isSelected = formData.schedule_days.includes(day.full);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDay(day.full)}
                        className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bin Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Bin Selection</h3>
                  <button
                    type="button"
                    onClick={() => setLassoMode(!lassoMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 ease-in-out shadow-sm ${
                      lassoMode
                        ? 'bg-primary text-white shadow-md ring-2 ring-primary/30'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:shadow-md'
                    }`}
                  >
                    <Lasso className="w-4 h-4" />
                    {lassoMode ? 'Drawing Active' : 'Draw to Select'}
                  </button>
                </div>

                {lassoMode && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-700">
                      <strong>Draw on the map</strong> to select multiple bins at once. Click and drag to create a selection area.
                    </p>
                  </div>
                )}

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search bins by number or address..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                {/* Selected count */}
                <p className="text-sm text-gray-600 mb-3">
                  {selectedBins.length} bins selected
                </p>

                {/* Bin list */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredBins.slice(0, 50).map(bin => {
                        const isSelected = selectedBins.find(b => b.id === bin.id);
                        return (
                          <div
                            key={bin.id}
                            onClick={() => toggleBin(bin)}
                            className={`p-3 cursor-pointer transition-all ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => {}}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  Bin #{bin.bin_number}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {bin.current_street}, {bin.city}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name || selectedBins.length === 0}
                className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
              >
                {editRoute ? 'Save Changes' : 'Create Route'}
              </button>
            </div>
          </div>

          {/* Right Panel - Map (60%) */}
          <div className="flex-1 relative bg-gray-100">
            {mappableBins.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Select bins to preview route</p>
                  <p className="text-sm text-gray-500 mt-1">Route will appear as you add bins</p>
                </div>
              </div>
            ) : (
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                <Map
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={DEFAULT_ZOOM}
                  mapId="binly-route-creator"
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                  className="w-full h-full"
                >
                  <RoutePreview
                    bins={mappableBins}
                    lassoMode={lassoMode}
                    allBins={allBins}
                    onLassoSelect={(bins) => {
                      // Add bins from lasso to selection
                      const newBins = bins.filter(b => !selectedBins.find(sb => sb.id === b.id));
                      setSelectedBins([...selectedBins, ...newBins]);
                      setFormData({
                        ...formData,
                        bin_ids: [...formData.bin_ids, ...newBins.map(b => b.id)]
                      });
                    }}
                  />
                </Map>
              </APIProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
