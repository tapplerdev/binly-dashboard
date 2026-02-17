'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin, MoveRequest } from '@/lib/types/bin';
import { useNoGoZones } from '@/lib/hooks/use-zones';
import { getZoneColor } from '@/lib/types/zone';
import { X, Search, Filter, MapPin, MapIcon, List, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

type UrgencyFilter = 'all' | 'overdue' | 'urgent' | 'soon' | 'scheduled';

// Map controller for programmatic zoom/pan
function MapController({
  targetLocation,
  onComplete,
}: {
  targetLocation: { lat: number; lng: number; timestamp: number } | null;
  onComplete: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    console.log('🗺️ [MOVE REQUEST MAP CONTROLLER] useEffect triggered', {
      hasMap: !!map,
      targetLocation: targetLocation,
      timestamp: targetLocation?.timestamp,
    });

    if (!map) {
      console.log('❌ [MOVE REQUEST MAP CONTROLLER] No map available');
      return;
    }

    if (!targetLocation) {
      console.log('❌ [MOVE REQUEST MAP CONTROLLER] No target location');
      return;
    }

    console.log('✅ [MOVE REQUEST MAP CONTROLLER] Calling panTo:', {
      lat: targetLocation.lat,
      lng: targetLocation.lng,
      timestamp: targetLocation.timestamp,
    });

    // Pan and zoom to the target location
    map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    map.setZoom(16);

    console.log('✅ [MOVE REQUEST MAP CONTROLLER] panTo and setZoom called');

    // Clear target after animation
    const timeout = setTimeout(() => {
      console.log('✅ [MOVE REQUEST MAP CONTROLLER] Animation complete, calling onComplete');
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, targetLocation, onComplete]);

  return null;
}

interface MoveRequestSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedRequestIds: string[]) => void;
  moveRequests: MoveRequest[];
  initialSelectedRequests?: string[]; // Move request IDs already in the task list — shown as pre-checked with distinct style
  focusBinId?: string; // When set, pre-selects the move request for this bin and scrolls to it
}

/**
 * Extended MoveRequest with bin coordinates for mapping
 */
interface MappableMoveRequest extends MoveRequest {
  latitude?: number;
  longitude?: number;
}

/**
 * Get marker color based on urgency (matching move requests table)
 */
function getUrgencyMarkerColor(urgency: MoveRequest['urgency']): string {
  switch (urgency) {
    case 'overdue':
    case 'urgent':
      return '#EF4444'; // red-500
    case 'soon':
      return '#F97316'; // orange-500
    case 'scheduled':
      return '#3B82F6'; // blue-500
    case 'resolved':
      return '#16A34A'; // green-600
    default:
      return '#9CA3AF'; // gray-400
  }
}

/**
 * Get urgency badge (matching move requests table exactly)
 */
function getUrgencyBadge(move: MoveRequest) {
  const urgency = move.urgency;

  const config = {
    overdue: {
      label: '⚠️ Overdue',
      colors: 'bg-red-500 text-white',
    },
    urgent: {
      label: '🔴 Urgent',
      colors: 'bg-red-500 text-white',
    },
    soon: {
      label: 'Move Soon',
      colors: 'bg-orange-500 text-white',
    },
    scheduled: {
      label: 'Scheduled',
      colors: 'bg-blue-500 text-white',
    },
    resolved: {
      label: '✓ Resolved',
      colors: 'bg-green-600 text-white',
    },
  };

  const { label, colors } = config[urgency] || config.scheduled;

  return (
    <Badge className={cn('font-semibold whitespace-nowrap', colors)}>
      {label}
    </Badge>
  );
}

export function MoveRequestSelectionMap({ onClose, onConfirm, moveRequests, initialSelectedRequests = [], focusBinId }: MoveRequestSelectionMapProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const alreadyAdded = new Set(initialSelectedRequests);
  // If focusBinId is provided, find and pre-select the matching move request
  const focusedRequestId = focusBinId
    ? moveRequests.find(r => r.bin_id === focusBinId)?.id
    : undefined;
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(
    new Set([...initialSelectedRequests, ...(focusedRequestId ? [focusedRequestId] : [])])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [loading, setLoading] = useState(true);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map'); // Mobile view toggle

  // Active no-go zones for map overlay
  const { data: activeZones = [] } = useNoGoZones('active');

  // Load bins from API to get coordinates
  useEffect(() => {
    async function loadBins() {
      try {
        setLoading(true);
        const data = await getBins();
        setBins(data);
      } catch (error) {
        console.error('Failed to load bins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBins();
  }, []);

  // Merge move requests with bin coordinates
  const mappableMoveRequests: MappableMoveRequest[] = moveRequests.map(request => {
    const bin = bins.find(b => b.id === request.bin_id);
    return {
      ...request,
      latitude: bin?.latitude,
      longitude: bin?.longitude,
    };
  }).filter(req => req.latitude !== undefined && req.longitude !== undefined);

  // Toggle request selection and pan to location
  const toggleRequestSelection = (requestId: string, request: MappableMoveRequest) => {
    console.log('🎯 [MOVE REQUEST] toggleRequestSelection called', {
      requestId,
      binNumber: request.bin_number,
      lat: request.latitude,
      lng: request.longitude,
    });

    const newSelection = new Set(selectedRequestIds);
    if (newSelection.has(requestId)) {
      console.log('➖ [MOVE REQUEST] Deselecting request');
      newSelection.delete(requestId);
    } else {
      console.log('➕ [MOVE REQUEST] Selecting request');
      newSelection.add(requestId);
    }
    setSelectedRequestIds(newSelection);

    // Always pan to the location when clicked (even if deselecting)
    if (request.latitude && request.longitude) {
      const timestamp = Date.now();
      const newTarget = { lat: request.latitude, lng: request.longitude, timestamp };

      console.log('📍 [MOVE REQUEST] Setting target location:', newTarget);

      // Use timestamp to force re-render even if coordinates are the same
      setTargetLocation(newTarget);
    } else {
      console.log('⚠️ [MOVE REQUEST] Request has no coordinates!');
    }
  };

  // Select all requests
  const selectAll = () => {
    const allRequestIds = new Set(filteredRequests.map(r => r.id));
    setSelectedRequestIds(allRequestIds);
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedRequestIds(new Set());
  };

  // Filter requests based on search and urgency
  const filteredRequests = moveRequests.filter(request => {
    // Urgency filter
    if (urgencyFilter !== 'all' && request.urgency !== urgencyFilter) {
      return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      request.bin_number.toString().includes(query) ||
      request.current_street?.toLowerCase().includes(query) ||
      request.city?.toLowerCase().includes(query) ||
      request.move_type?.toLowerCase().includes(query) ||
      request.urgency?.toLowerCase().includes(query)
    );
  });

  // Get mappable filtered requests
  const mappableFilteredRequests = filteredRequests
    .map(request => {
      const bin = bins.find(b => b.id === request.bin_id);
      return {
        ...request,
        latitude: bin?.latitude,
        longitude: bin?.longitude,
      };
    })
    .filter(req => req.latitude !== undefined && req.longitude !== undefined);

  // Handle confirm — only pass newly selected requests (exclude already-added ones)
  const handleConfirm = () => {
    const newlySelectedIds = Array.from(selectedRequestIds).filter(id => !alreadyAdded.has(id));
    onConfirm(newlySelectedIds);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Full-screen Modal */}
      <div className="fixed inset-4 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col px-4 md:px-6 py-4 border-b border-gray-200 bg-gray-50">
          {/* Top Row: Title and Close */}
          <div className="flex items-center justify-between mb-3 md:mb-0">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Move Requests for Shift</h2>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5 hidden md:block">
                Click on map markers or cards to add move requests to your shift
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-fast"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Mobile View Toggle (only visible on mobile) */}
          <div className="flex md:hidden gap-2 mt-2">
            <button
              onClick={() => setViewMode('map')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                viewMode === 'map'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MapIcon className="w-4 h-4" />
                <span>Map</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <List className="w-4 h-4" />
                <span>List ({filteredRequests.length})</span>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Desktop: Left 60% | Mobile: Full screen when viewMode === 'map' */}
          <div className={`flex-1 relative ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Loading move requests...</p>
                </div>
              </div>
            ) : (
              <APIProvider
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
              >
                <Map
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={DEFAULT_ZOOM}
                  mapId="binly-move-request-selection"
                  mapTypeId="hybrid"
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  streetViewControl={false}
                  className="w-full h-full"
                >
                  {/* Map controller for selected request navigation */}
                  <MapController
                    targetLocation={targetLocation}
                    onComplete={() => setTargetLocation(null)}
                  />

                  {/* Move Request Markers - Using Bin Number Display */}
                  {mappableFilteredRequests.map((request) => {
                    const isSelected = selectedRequestIds.has(request.id);
                    const markerColor = isSelected ? '#16a34a' : getUrgencyMarkerColor(request.urgency);

                    return (
                      <AdvancedMarker
                        key={request.id}
                        position={{ lat: request.latitude!, lng: request.longitude! }}
                        onClick={() => toggleRequestSelection(request.id, request)}
                      >
                        <div className="relative">
                          {/* Pulsing ring for selected state */}
                          {isSelected && (
                            <>
                              <div className="absolute inset-0 w-8 h-8 rounded-full bg-green-400 opacity-40 animate-ping" />
                              <div className="absolute -inset-2 w-12 h-12 rounded-full border-4 border-green-400 opacity-50" />
                            </>
                          )}
                          {/* Bin marker */}
                          <div
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-all hover:scale-110"
                            style={{ backgroundColor: markerColor }}
                            title={`Bin #${request.bin_number} - ${request.current_street}`}
                          >
                            {request.bin_number % 100}
                          </div>
                        </div>
                      </AdvancedMarker>
                    );
                  })}

                  {/* No-Go Zone markers — highlight problem areas */}
                  {activeZones.map((zone) => {
                    const color = getZoneColor(zone.conflict_score);
                    return (
                      <AdvancedMarker
                        key={`zone-${zone.id}`}
                        position={{ lat: zone.center_latitude, lng: zone.center_longitude }}
                        zIndex={0}
                      >
                        <div className="flex flex-col items-center pointer-events-none">
                          <div
                            className="rounded-full flex items-center justify-center animate-pulse"
                            style={{
                              width: 28,
                              height: 28,
                              backgroundColor: color + '99',
                              border: '2px solid white',
                              boxShadow: `0 0 0 2px ${color}, 0 2px 8px rgba(0,0,0,0.6)`,
                            }}
                          >
                            <ShieldAlert className="w-3 h-3 text-white" />
                          </div>
                          <div
                            className="mt-0.5 px-1.5 rounded text-white whitespace-nowrap"
                            style={{
                              backgroundColor: color,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
                              fontSize: '9px',
                              fontWeight: 700,
                            }}
                          >
                            {zone.name}
                          </div>
                        </div>
                      </AdvancedMarker>
                    );
                  })}
                </Map>
              </APIProvider>
            )}

            {/* Selection Counter - Only show in map mode */}
            {viewMode === 'map' && (
              <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 md:px-4 py-2 border border-gray-200">
                <p className="text-xs md:text-sm font-semibold text-gray-900">
                  {selectedRequestIds.size} request{selectedRequestIds.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>

          {/* Request List - Desktop: Right 40% | Mobile: Full screen when viewMode === 'list' */}
          <div className={`w-full md:w-[40%] border-l border-gray-200 flex flex-col bg-gray-50 ${viewMode === 'map' ? 'hidden md:flex' : 'flex'}`}>
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by bin number, address, or type..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Urgency Filter Buttons */}
              <div className="mt-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Filter by Urgency</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setUrgencyFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      urgencyFilter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setUrgencyFilter('overdue')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      urgencyFilter === 'overdue'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    ⚠️ Overdue
                  </button>
                  <button
                    onClick={() => setUrgencyFilter('urgent')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      urgencyFilter === 'urgent'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    🔴 Urgent
                  </button>
                  <button
                    onClick={() => setUrgencyFilter('soon')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      urgencyFilter === 'soon'
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    Move Soon
                  </button>
                  <button
                    onClick={() => setUrgencyFilter('scheduled')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      urgencyFilter === 'scheduled'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Scheduled
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={selectAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-fast"
                >
                  Select All ({filteredRequests.length})
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-fast"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Request List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No move requests found</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => {
                    const isSelected = selectedRequestIds.has(request.id);
                    const isAlreadyAdded = alreadyAdded.has(request.id);
                    const isFocused = focusedRequestId === request.id;

                    // Get bin coordinates for this request
                    const bin = bins.find(b => b.id === request.bin_id);
                    const mappableRequest: MappableMoveRequest = {
                      ...request,
                      latitude: bin?.latitude,
                      longitude: bin?.longitude,
                    };

                    // Format date
                    const scheduledDate = new Date(request.scheduled_date_iso);
                    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={request.id}
                        onClick={() => toggleRequestSelection(request.id, mappableRequest)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          isAlreadyAdded
                            ? 'bg-indigo-50 border-2 border-indigo-400'
                            : isSelected
                            ? 'bg-green-50 border-2 border-green-500'
                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className={`mt-0.5 rounded border-gray-300 focus:ring-2 ${
                              isAlreadyAdded
                                ? 'text-indigo-600 focus:ring-indigo-500'
                                : 'text-green-600 focus:ring-green-500'
                            }`}
                          />

                          {/* Request Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm text-gray-900">
                                    Bin #{request.bin_number}
                                  </p>
                                  {isFocused && !isAlreadyAdded && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded border border-blue-300 font-medium">
                                      Suggested
                                    </span>
                                  )}
                                  {isAlreadyAdded && (
                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded border border-indigo-300 font-medium">
                                      Already in shift
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5 truncate">
                                  {request.current_street}, {request.city} {request.zip}
                                </p>
                              </div>
                              {getUrgencyBadge(request)}
                            </div>

                            {/* Request Details */}
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1 text-gray-600">
                                <span className="font-medium text-gray-700">Type:</span>
                                <span>
                                  {request.move_type === 'store' ? 'Store at Warehouse' : 'Relocate'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                <span className="font-medium text-gray-700">Scheduled:</span>
                                <span>{formattedDate}</span>
                              </div>

                              {/* New location for relocations */}
                              {request.move_type === 'relocation' && request.new_street && (
                                <div className="text-gray-600 mt-1">
                                  <span className="font-medium text-gray-700">New Location:</span>{' '}
                                  <span className="text-xs">
                                    {request.new_street}, {request.new_city} {request.new_zip}
                                  </span>
                                </div>
                              )}

                              {/* Reason if provided */}
                              {request.reason && (
                                <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">
                                  {request.reason}
                                </p>
                              )}

                              {isAlreadyAdded && (
                                <p className="text-xs text-indigo-500 mt-1">
                                  This move request is already in the task list
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-fast order-2 sm:order-1"
          >
            Cancel
          </button>
          {(() => {
            const newlySelected = [...selectedRequestIds].filter(id => !alreadyAdded.has(id)).length;
            return (
              <button
                onClick={handleConfirm}
                disabled={newlySelected === 0}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast order-1 sm:order-2"
              >
                Add to Shift ({newlySelected})
              </button>
            );
          })()}
        </div>
      </div>
    </>
  );
}
