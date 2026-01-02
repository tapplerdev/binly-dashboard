'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Lasso, Navigation, Copy, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
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

// Warehouse location - all routes end here
const WAREHOUSE_LOCATION = {
  lat: 37.3009357,
  lng: -121.9493848,
  address: '1185 Campbell Ave, San Jose, CA 95126, United States'
};

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Format duration: show minutes if < 1 hour, otherwise show hours
const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)}h`;
};


// Lasso Selection Component using Google Maps DrawingManager
interface LassoSelectionProps {
  allBins: Bin[];
  onBinsSelected: (bins: Bin[]) => void;
  isActive: boolean;
}

function LassoSelection({ allBins, onBinsSelected, isActive }: LassoSelectionProps) {
  const map = useMap();
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);

  useEffect(() => {
    if (!map || !window.google?.maps?.drawing) return;

    // Initialize DrawingManager
    const manager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: '#4880FF',
        fillOpacity: 0.2,
        strokeWeight: 2,
        strokeColor: '#4880FF',
        clickable: false,
        editable: false,
        zIndex: 1,
      },
    });

    manager.setMap(map);
    setDrawingManager(manager);

    // Listen for polygon completion
    google.maps.event.addListener(manager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      // Get bins inside the polygon
      const selectedBins = allBins.filter((bin) => {
        if (!isMappableBin(bin)) return false;
        const point = new google.maps.LatLng(bin.latitude, bin.longitude);
        return google.maps.geometry.poly.containsLocation(point, polygon);
      });

      // Notify parent component
      if (selectedBins.length > 0) {
        onBinsSelected(selectedBins);
      }

      // Remove the polygon after selection
      polygon.setMap(null);

      // Exit drawing mode
      manager.setDrawingMode(null);
    });

    return () => {
      manager.setMap(null);
    };
  }, [map, allBins, onBinsSelected]);

  // Toggle drawing mode based on isActive prop
  useEffect(() => {
    if (!drawingManager) return;

    if (isActive) {
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else {
      drawingManager.setDrawingMode(null);
    }
  }, [isActive, drawingManager]);

  return null;
}

// Route polyline component
interface RoutePreviewProps {
  bins: Bin[];
  onMapReady?: () => void;
  lassoMode?: boolean;
  allBins?: Bin[];
  onLassoSelect?: (bins: Bin[]) => void;
  onBinClick?: (bin: Bin) => void;
  onBinRemove?: (bin: Bin) => void;
  routeStats: { distance: number; duration: number };
  onStatsChange: (stats: { distance: number; duration: number }) => void;
}

function RoutePreview({ bins, onMapReady, lassoMode = false, allBins = [], onLassoSelect, onBinClick, onBinRemove, routeStats, onStatsChange }: RoutePreviewProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const glowPolylineRef = useRef<google.maps.Polyline | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Animation state (persist across renders for smooth continuous animation)
  const animationStateRef = useRef({
    opacity: 1,
    opacityDirection: -0.003,  // Slower pulsing (was -0.008)
    strokeWeight: 6,
    weightDirection: -0.02,    // Slower pulsing (was -0.05)
    glowOpacity: 0.3,
    glowOpacityDirection: -0.002,  // Slower pulsing (was -0.006)
  });
  const [hoveredBin, setHoveredBin] = useState<{ bin: Bin; index: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!map || bins.length < 1) return; // Changed from < 2 to < 1 to show route even with single bin

    async function fetchRoute() {
      try {
        // Build route: warehouse -> bins -> warehouse (round trip)
        const binCoordinates = bins.map(bin => `${bin.longitude},${bin.latitude}`);
        const warehouseCoordinate = `${WAREHOUSE_LOCATION.lng},${WAREHOUSE_LOCATION.lat}`;
        const coordinates = [warehouseCoordinate, ...binCoordinates, warehouseCoordinate].join(';');
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=pk.eyJ1IjoiYmlubHl5YWkiLCJhIjoiY21pNzN4bzlhMDVheTJpcHdqd2FtYjhpeSJ9.sQM8WHE2C9zWH0xG107xhw`;

        const response = await fetch(mapboxUrl);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];

          // Update stats via parent callback
          const newStats = {
            distance: route.distance / 1609.34, // meters to miles
            duration: route.duration / 3600, // seconds to hours
          };
          console.log('📍 RoutePreview: Mapbox route calculated:', {
            distance: newStats.distance.toFixed(2) + ' mi',
            duration: newStats.duration.toFixed(2) + ' h',
            onStatsChange: typeof onStatsChange
          });
          if (onStatsChange) {
            onStatsChange(newStats);
          }

          // Draw polyline
          const path = route.geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
          }));

          // Cancel any existing animation before updating
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          // Check if this is the first time creating polylines
          const isFirstRender = !polylineRef.current;

          // Update existing polylines or create new ones (no flicker)
          if (polylineRef.current && glowPolylineRef.current) {
            // Just update the path - smooth, no flicker!
            polylineRef.current.setPath(path);
            glowPolylineRef.current.setPath(path);
          } else {
            // Create polylines for the first time
            const glowLine = new google.maps.Polyline({
              path: path,
              geodesic: false,
              strokeColor: '#4880FF',
              strokeOpacity: 0.3,
              strokeWeight: 12,
              map: map,
              clickable: false,
              zIndex: 999,
            });

            const polyline = new google.maps.Polyline({
              path: path,
              geodesic: false,
              strokeColor: '#4880FF',
              strokeOpacity: 1,
              strokeWeight: 6,
              map: map,
              zIndex: 1000,
            });

            polylineRef.current = polyline;
            glowPolylineRef.current = glowLine;
          }

          // Animate polylines (pulsing effect matching routes map view)
          const animate = () => {
            const state = animationStateRef.current;

            // Pulsing values
            state.opacity += state.opacityDirection;
            if (state.opacity <= 0.85 || state.opacity >= 1) state.opacityDirection *= -1;

            state.strokeWeight += state.weightDirection;
            if (state.strokeWeight <= 5 || state.strokeWeight >= 7) state.weightDirection *= -1;

            state.glowOpacity += state.glowOpacityDirection;
            if (state.glowOpacity <= 0.15 || state.glowOpacity >= 0.4) state.glowOpacityDirection *= -1;

            // Update main polyline
            if (polylineRef.current) {
              polylineRef.current.setOptions({
                strokeOpacity: state.opacity,
                strokeWeight: state.strokeWeight,
              });
            }

            // Update glow polyline
            if (glowPolylineRef.current) {
              glowPolylineRef.current.setOptions({
                strokeOpacity: state.glowOpacity,
                strokeWeight: 14 + (state.strokeWeight - 5) * 2,
              });
            }

            animationFrameRef.current = requestAnimationFrame(animate);
          };

          // Start animation (will continue smoothly even when route updates)
          animate();

          // Fit bounds ONLY on first render (not when route updates during optimization)
          // This prevents choppy zooming when bins are reordered
          if (map && isFirstRender) {
            const bounds = new google.maps.LatLngBounds();
            bins.forEach(bin => {
              if (bin.latitude != null && bin.longitude != null) {
                bounds.extend({ lat: bin.latitude, lng: bin.longitude });
              }
            });
            // Include warehouse in bounds
            bounds.extend(WAREHOUSE_LOCATION);
            map.fitBounds(bounds);
          }
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    }

    fetchRoute();
  }, [map, bins]);

  // Cleanup only on component unmount (not on every bins change)
  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      if (glowPolylineRef.current) {
        glowPolylineRef.current.setMap(null);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Empty deps = only runs on mount/unmount

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

      {/* Warehouse marker - always visible */}
      <AdvancedMarker
        key="warehouse"
        position={WAREHOUSE_LOCATION}
        zIndex={15}
      >
        <div className="relative">
          <div className="w-12 h-12 bg-orange-600 rounded-full shadow-xl border-2 border-white flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        </div>
      </AdvancedMarker>

      {/* Render all available bins (exact same as Live Map) */}
      {allBins.filter(bin => !bins.find(b => b.id === bin.id) && isMappableBin(bin)).map(bin => {
        return (
          <AdvancedMarker
            key={`available-${bin.id}`}
            position={{ lat: bin.latitude, lng: bin.longitude }}
            zIndex={10}
          >
            <div
              onClick={() => onBinClick?.(bin)}
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-300 animate-scale-in hover:scale-110 hover:shadow-xl"
              style={{
                backgroundColor: getBinMarkerColor(bin.fill_percentage),
              }}
              title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}% - Click to add to route`}
            >
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {bin.bin_number}
              </div>
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Render selected bins with sequence numbers + bin numbers */}
      {bins.map((bin, index) => {
        const isFirst = index === 0;

        if (bin.latitude == null || bin.longitude == null) return null;

        return (
          <AdvancedMarker
            key={bin.id}
            position={{ lat: bin.latitude, lng: bin.longitude }}
            zIndex={20}
          >
            <div
              className="relative group"
              onMouseEnter={() => {
                // Set timeout to show tooltip after 500ms
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredBin({ bin, index });
                }, 500);
              }}
              onMouseLeave={() => {
                // Clear timeout and hide tooltip
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                }
                setHoveredBin(null);
              }}
            >
              {/* Glow effect for START bin */}
              {isFirst && (
                <div className="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-pulse scale-150" />
              )}
              <div
                onClick={() => onBinRemove?.(bin)}
                className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2 border-white cursor-pointer transition-all duration-300 hover:scale-110 hover:border-red-500 group-hover:ring-2 group-hover:ring-red-400 ${
                  isFirst ? 'bg-green-600 ring-4 ring-green-200' : ''
                }`}
                style={isFirst ? undefined : { backgroundColor: getBinMarkerColor(bin.fill_percentage || 0) }}
              >
                {/* Bin number (larger) */}
                <div className="text-sm font-bold leading-none">{bin.bin_number}</div>
                {/* Sequence number (smaller, below with parentheses) */}
                <div className="text-[10px] font-medium leading-none opacity-90">({index + 1})</div>
              </div>
              {/* X icon overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-red-600 opacity-0 group-hover:opacity-80 transition-all duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              {/* START label for first bin */}
              {isFirst && (
                <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shadow-md">
                  START
                </div>
              )}

              {/* Custom Tooltip Bubble */}
              {hoveredBin && hoveredBin.bin.id === bin.id && (
                <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 animate-fade-in pointer-events-none z-50">
                  <div className="bg-gray-900 text-white rounded-lg shadow-2xl px-3 py-2 min-w-[200px]">
                    <div className="text-xs font-semibold mb-1">Bin #{hoveredBin.bin.bin_number}</div>
                    <div className="text-xs text-gray-300 mb-1">Position {hoveredBin.index + 1}</div>
                    <div className="text-xs text-red-300 font-medium">Click to remove from route</div>
                  </div>
                  {/* Arrow pointing down */}
                  <div className="w-0 h-0 mx-auto mt-[-1px]" style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #111827'
                  }} />
                </div>
              )}
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Stats Overlay */}
      {bins.length >= 2 && routeStats?.distance > 0 && (
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
              <p className="font-semibold text-gray-900">{formatDuration(routeStats.duration)}</p>
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
  const [optimizeMode, setOptimizeMode] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentRouteStats, setCurrentRouteStats] = useState<{ distance: number; duration: number }>({ distance: 0, duration: 0 });
  const [beforeStats, setBeforeStats] = useState<{ distance: number; duration: number } | null>(null);
  const [afterStats, setAfterStats] = useState<{ distance: number; duration: number } | null>(null);
  const [manualBinOrder, setManualBinOrder] = useState<string[]>([]);
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

  // Log when currentRouteStats changes
  useEffect(() => {
    console.log('📊 Parent: currentRouteStats updated:', {
      distance: currentRouteStats.distance.toFixed(2) + ' mi',
      duration: currentRouteStats.duration.toFixed(2) + ' h'
    });
  }, [currentRouteStats]);

  // Capture AFTER stats when route recalculates after optimization
  useEffect(() => {
    // Only capture if we're in optimize mode, have BEFORE stats, don't have AFTER yet, and stats are different
    if (optimizeMode && beforeStats && !afterStats && currentRouteStats.distance > 0) {
      // Check if the distance changed (meaning route was recalculated)
      if (Math.abs(currentRouteStats.distance - beforeStats.distance) > 0.01) {
        console.log('📊 AFTER stats captured:', {
          distance: currentRouteStats.distance.toFixed(2) + ' mi',
          duration: currentRouteStats.duration.toFixed(2) + ' h',
          savings: (beforeStats.distance - currentRouteStats.distance).toFixed(2) + ' mi'
        });
        setAfterStats({ ...currentRouteStats });
      }
    }
  }, [optimizeMode, beforeStats, afterStats, currentRouteStats]);

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

  const handleOptimizeToggle = async () => {
    if (!optimizeMode) {
      // Turning optimization ON - call the endpoint
      if (selectedBins.length < 2) {
        alert('Please select at least 2 bins to optimize the route.');
        return;
      }

      console.log('🎯 OPTIMIZE ROUTE - START');
      console.log('📦 Current bin order (BEFORE optimization):', selectedBins.map((b, i) => `${i+1}. Bin #${b.bin_number} (ID: ${b.id})`));
      console.log('📍 Current formData.bin_ids:', formData.bin_ids);

      setIsOptimizing(true);
      try {
        const requestBody = { bin_ids: formData.bin_ids };
        console.log('🚀 API Request to optimize-preview:', requestBody);

        const response = await fetch('https://ropacal-backend-production.up.railway.app/api/routes/optimize-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 API Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          throw new Error('Failed to optimize route');
        }

        const data = await response.json();
        console.log('✅ API Response data:', data);

        // Check if we have the expected data structure
        if (data.optimized_bin_ids && Array.isArray(data.optimized_bin_ids)) {
          const optimizedBinIds = data.optimized_bin_ids;
          console.log('🔄 Optimized bin IDs (NEW order):', optimizedBinIds);

          // STEP 1: Capture BEFORE stats from current route
          setBeforeStats({ ...currentRouteStats });
          setManualBinOrder([...formData.bin_ids]);

          console.log('📊 BEFORE stats captured:', {
            distance: currentRouteStats.distance.toFixed(2) + ' mi',
            duration: currentRouteStats.duration.toFixed(2) + ' h'
          });

          // STEP 2: Reorder bins - this will trigger RoutePreview to recalculate with new stats
          const reorderedBins = optimizedBinIds
            .map((id: string) => selectedBins.find(b => b.id === id))
            .filter((b: Bin | undefined): b is Bin => b !== undefined);

          console.log('🔄 Reordered bins (AFTER optimization):', reorderedBins.map((b, i) => `${i+1}. Bin #${b.bin_number}`));

          setSelectedBins(reorderedBins);
          setFormData({
            ...formData,
            bin_ids: optimizedBinIds,
          });

          // Enable optimize mode
          setOptimizeMode(true);

          console.log('✅ OPTIMIZE ROUTE - Bins reordered, waiting for Mapbox recalculation...');
        } else {
          console.error('❌ API returned unexpected data structure:', data);
        }
      } catch (error) {
        console.error('❌ Error optimizing route:', error);
        alert('Failed to optimize route. Please try again.');
      } finally {
        setIsOptimizing(false);
      }
    } else {
      // Reverting to manual order
      console.log('🔄 REVERTING to manual order');

      if (manualBinOrder.length > 0) {
        // Restore manual bin order
        const restoredBins = manualBinOrder
          .map((id: string) => allBins.find(b => b.id === id))
          .filter((b: Bin | undefined): b is Bin => b !== undefined);

        setSelectedBins(restoredBins);
        setFormData({
          ...formData,
          bin_ids: manualBinOrder,
        });

        console.log('✅ Reverted to manual order:', restoredBins.map((b, i) => `${i+1}. Bin #${b.bin_number}`));
      }

      // Clear optimization state
      setOptimizeMode(false);
      setBeforeStats(null);
      setAfterStats(null);
      setManualBinOrder([]);
    }
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
      estimated_duration_hours: afterStats?.duration || beforeStats?.duration || currentRouteStats?.duration || 6,
    });
    handleClose();
  };

  const mappableBins = selectedBins.filter(isMappableBin);

  // Simple stats update - update current stats state and optionally set AFTER stats
  const handleStatsUpdate = useCallback((stats: { distance: number; duration: number }) => {
    // Always update the current stats state (for bottom overlay display)
    setCurrentRouteStats(stats);

    // If we're in optimize mode and waiting for AFTER stats, capture them once
    if (optimizeMode && beforeStats && !afterStats) {
      console.log('📊 AFTER stats captured:', {
        distance: stats.distance.toFixed(2) + ' mi',
        duration: stats.duration.toFixed(2) + ' h'
      });
      setAfterStats({ ...stats });
    }
  }, [optimizeMode, beforeStats, afterStats]);

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
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white hover:bg-gray-50 transition-all flex items-center justify-between"
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
                  <div className="flex items-center gap-2">
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
                      {lassoMode ? 'Drawing' : 'Draw Area'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOptimizeToggle}
                      disabled={isOptimizing || selectedBins.length < 2}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group ${
                        optimizeMode
                          ? 'bg-green-600 text-white shadow-md ring-2 ring-green-200 hover:bg-orange-600 hover:ring-orange-200'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                      }`}
                    >
                      {isOptimizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : optimizeMode ? (
                        <svg className="w-4 h-4 group-hover:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isOptimizing ? (
                        'Optimizing...'
                      ) : optimizeMode ? (
                        <>
                          <span className="group-hover:hidden">Optimized</span>
                          <span className="hidden group-hover:inline">Revert to Original</span>
                        </>
                      ) : (
                        'Optimize Route'
                      )}
                    </button>
                  </div>
                </div>

                {lassoMode && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3 animate-slide-in-down">
                    <p className="text-xs font-semibold text-gray-700 mb-1">How to use:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs text-gray-700">
                      <li>Click on map to add points</li>
                      <li>Draw around bins you want</li>
                      <li>Click first point to close polygon</li>
                    </ol>
                    <p className="mt-2 text-xs text-gray-600">Bins inside will be selected automatically</p>
                  </div>
                )}

                {optimizeMode && beforeStats && afterStats && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-300 rounded-lg p-3 mb-3 shadow-sm animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-green-900 mb-2">Route Optimized!</p>

                        {/* Before/After Comparison */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-white/60 rounded-md p-2">
                            <p className="text-[10px] text-gray-500 font-medium mb-0.5">BEFORE</p>
                            <p className="text-xs text-gray-700">
                              {beforeStats.distance.toFixed(1)} mi
                            </p>
                            <p className="text-xs text-gray-700">
                              {formatDuration(beforeStats.duration)}
                            </p>
                          </div>
                          <div className="bg-white/80 rounded-md p-2 ring-2 ring-green-400">
                            <p className="text-[10px] text-green-600 font-medium mb-0.5">AFTER</p>
                            <p className="text-xs text-green-700 font-semibold">
                              {afterStats.distance.toFixed(1)} mi
                            </p>
                            <p className="text-xs text-green-700 font-semibold">
                              {formatDuration(afterStats.duration)}
                            </p>
                          </div>
                        </div>

                        {/* Savings */}
                        <div className="bg-green-100 rounded-md p-2 border border-green-300">
                          <p className="text-xs text-green-900 font-semibold mb-0.5">You&apos;ll save:</p>
                          <p className="text-xs text-green-700">
                            <strong>{(beforeStats.distance - afterStats.distance).toFixed(1)} mi</strong> •
                            <strong> {((beforeStats.duration - afterStats.duration) * 60).toFixed(0)} min</strong>
                          </p>
                        </div>
                      </div>
                    </div>
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
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} libraries={['drawing', 'geometry']}>
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
                  onBinClick={(bin) => {
                    // Add clicked bin to route (append to end)
                    setSelectedBins([...selectedBins, bin]);
                    setFormData({
                      ...formData,
                      bin_ids: [...formData.bin_ids, bin.id]
                    });
                  }}
                  onBinRemove={(bin) => {
                    // Remove bin from route
                    const newBins = selectedBins.filter(b => b.id !== bin.id);
                    setSelectedBins(newBins);
                    setFormData({
                      ...formData,
                      bin_ids: newBins.map(b => b.id)
                    });
                  }}
                  routeStats={currentRouteStats}
                  onStatsChange={setCurrentRouteStats}
                />
              </Map>
            </APIProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
