'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { PotentialLocation } from '@/lib/api/potential-locations';
import { X, Search, MapPin, Filter, MapIcon, List } from 'lucide-react';
import { PotentialLocationPin } from '@/components/ui/potential-location-pin';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

type DateFilter = 'all' | 'newest' | 'oldest';

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
    console.log('🗺️ [PLACEMENT MAP CONTROLLER] useEffect triggered', {
      hasMap: !!map,
      targetLocation: targetLocation,
      timestamp: targetLocation?.timestamp,
    });

    if (!map) {
      console.log('❌ [PLACEMENT MAP CONTROLLER] No map available');
      return;
    }

    if (!targetLocation) {
      console.log('❌ [PLACEMENT MAP CONTROLLER] No target location');
      return;
    }

    console.log('✅ [PLACEMENT MAP CONTROLLER] Calling panTo:', {
      lat: targetLocation.lat,
      lng: targetLocation.lng,
      timestamp: targetLocation.timestamp,
    });

    // Pan and zoom to the target location
    map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    map.setZoom(16);

    console.log('✅ [PLACEMENT MAP CONTROLLER] panTo and setZoom called');

    // Clear target after animation
    const timeout = setTimeout(() => {
      console.log('✅ [PLACEMENT MAP CONTROLLER] Animation complete, calling onComplete');
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, targetLocation, onComplete]);

  return null;
}

interface PlacementLocationSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedLocationIds: string[]) => void;
  potentialLocations: PotentialLocation[];
  initialSelectedLocations?: string[]; // Location IDs already in the task list — shown as pre-checked with distinct style
}

/**
 * Check if a potential location has mappable coordinates
 */
function isMappableLocation(location: PotentialLocation): location is PotentialLocation & { latitude: number; longitude: number } {
  return (
    location.latitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined
  );
}

export function PlacementLocationSelectionMap({ onClose, onConfirm, potentialLocations, initialSelectedLocations = [] }: PlacementLocationSelectionMapProps) {
  const alreadyAdded = new Set(initialSelectedLocations);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set(initialSelectedLocations));
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map'); // Mobile view toggle
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null); // For popup display

  // Toggle location selection and pan to location
  const toggleLocationSelection = (locationId: string, location: PotentialLocation) => {
    console.log('🎯 [PLACEMENT] toggleLocationSelection called', {
      locationId,
      address: location.address,
      lat: location.latitude,
      lng: location.longitude,
    });

    const newSelection = new Set(selectedLocationIds);
    if (newSelection.has(locationId)) {
      console.log('➖ [PLACEMENT] Deselecting location');
      newSelection.delete(locationId);
    } else {
      console.log('➕ [PLACEMENT] Selecting location');
      newSelection.add(locationId);
    }
    setSelectedLocationIds(newSelection);

    // Show popup for this location
    setHoveredLocationId(locationId);

    // Always pan to the location when clicked (even if deselecting)
    if (location.latitude && location.longitude) {
      const timestamp = Date.now();
      const newTarget = { lat: location.latitude, lng: location.longitude, timestamp };

      console.log('📍 [PLACEMENT] Setting target location:', newTarget);

      // Use timestamp to force re-render even if coordinates are the same
      setTargetLocation(newTarget);
    } else {
      console.log('⚠️ [PLACEMENT] Location has no coordinates!');
    }
  };

  // Select all locations
  const selectAll = () => {
    const allLocationIds = new Set(filteredLocations.map(loc => loc.id));
    setSelectedLocationIds(allLocationIds);
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedLocationIds(new Set());
  };

  // Filter and sort locations based on search and date
  const filteredLocations = potentialLocations
    .filter(location => {
      // Search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        location.address?.toLowerCase().includes(query) ||
        location.street?.toLowerCase().includes(query) ||
        location.city?.toLowerCase().includes(query) ||
        location.requested_by_name?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Date sorting
      if (dateFilter === 'newest') {
        return new Date(b.created_at_iso).getTime() - new Date(a.created_at_iso).getTime();
      } else if (dateFilter === 'oldest') {
        return new Date(a.created_at_iso).getTime() - new Date(b.created_at_iso).getTime();
      }
      return 0; // 'all' - no sorting
    });

  // Get mappable locations
  const mappableLocations = filteredLocations.filter(isMappableLocation);

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(Array.from(selectedLocationIds));
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
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Placement Locations for Shift</h2>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5 hidden md:block">
                Click on map markers or cards to add placement tasks to your shift
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
                <span>List ({filteredLocations.length})</span>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Desktop: Left 60% | Mobile: Full screen when viewMode === 'map' */}
          <div className={`flex-1 relative ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
            <APIProvider
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            >
              <Map
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                mapId="binly-placement-location-selection"
                gestureHandling="greedy"
                disableDefaultUI={false}
                streetViewControl={false}
                className="w-full h-full"
                onClick={() => setHoveredLocationId(null)} // Close popup when clicking map
              >
                {/* Map controller for selected location navigation */}
                <MapController
                  targetLocation={targetLocation}
                  onComplete={() => setTargetLocation(null)}
                />

                {/* Placement Location Markers - Using PotentialLocationPin */}
                {mappableLocations.map((location) => {
                  const isSelected = selectedLocationIds.has(location.id);
                  const showPopup = hoveredLocationId === location.id;

                  return (
                    <AdvancedMarker
                      key={location.id}
                      position={{ lat: location.latitude, lng: location.longitude }}
                      onClick={(e) => {
                        e.stop(); // Prevent map click event
                        toggleLocationSelection(location.id, location);
                      }}
                    >
                      <div
                        className="relative cursor-pointer transition-all hover:scale-110"
                        title={`${location.address || location.street} - Requested by ${location.requested_by_name}`}
                      >
                        {/* Pulsing background circle for selected state */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-green-400 opacity-40 animate-ping" />
                            <div className="absolute w-16 h-16 rounded-full bg-green-300 opacity-30" />
                          </div>
                        )}
                        {/* Pin marker */}
                        <div className="relative z-10">
                          <PotentialLocationPin
                            size={40}
                            color={isSelected ? '#16a34a' : '#FF9500'}
                          />
                        </div>

                        {/* Address Popup - Shows above marker when selected */}
                        {showPopup && (
                          <div
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] max-w-[280px] animate-slide-in-up z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-xs font-semibold text-gray-900 mb-1">
                              {location.address || `${location.street}`}
                            </div>
                            <div className="text-xs text-gray-600">
                              {location.city}, {location.zip}
                            </div>
                            {/* Arrow pointing down to marker */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
                          </div>
                        )}
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </Map>
            </APIProvider>

            {/* Selection Counter - Only show in map mode */}
            {viewMode === 'map' && (
              <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 md:px-4 py-2 border border-gray-200">
                <p className="text-xs md:text-sm font-semibold text-gray-900">
                  {selectedLocationIds.size} location{selectedLocationIds.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>

          {/* Location List - Desktop: Right 40% | Mobile: Full screen when viewMode === 'list' */}
          <div className={`w-full md:w-[40%] border-l border-gray-200 flex flex-col bg-gray-50 ${viewMode === 'map' ? 'hidden md:flex' : 'flex'}`}>
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by address or requester..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Date Filter Buttons */}
              <div className="mt-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Sort by Date</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDateFilter('all')}
                    className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      dateFilter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDateFilter('newest')}
                    className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      dateFilter === 'newest'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Newest First
                  </button>
                  <button
                    onClick={() => setDateFilter('oldest')}
                    className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-fast ${
                      dateFilter === 'oldest'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    Oldest First
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={selectAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-fast"
                >
                  Select All ({filteredLocations.length})
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-fast"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Location List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredLocations.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No potential locations found</p>
                  </div>
                ) : (
                  filteredLocations.map((location) => {
                    const isSelected = selectedLocationIds.has(location.id);
                    const isAlreadyAdded = alreadyAdded.has(location.id);

                    // Format created date
                    const createdDate = new Date(location.created_at_iso);
                    const formattedDate = createdDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={location.id}
                        onClick={() => toggleLocationSelection(location.id, location)}
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

                          {/* Location Info */}
                          <div className="flex-1 min-w-0">
                            <div className="mb-2">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <p className="font-semibold text-sm text-gray-900 truncate">
                                  {location.address || `${location.street}, ${location.city}`}
                                </p>
                                {isAlreadyAdded && (
                                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded border border-indigo-300 font-medium shrink-0">
                                    ✓ Already in shift
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {location.city}, {location.zip}
                              </p>
                            </div>

                            {/* Location Details */}
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1 text-gray-600">
                                <span className="font-medium text-gray-700">Requested by:</span>
                                <span>{location.requested_by_name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                <span className="font-medium text-gray-700">Requested:</span>
                                <span>{formattedDate}</span>
                              </div>

                              {/* Notes if provided */}
                              {location.notes && (
                                <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">
                                  {location.notes}
                                </p>
                              )}

                              {/* Show if location is converted */}
                              {location.converted_to_bin_id && location.bin_number && (
                                <div className="mt-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                  ✓ Converted to Bin #{location.bin_number}
                                </div>
                              )}

                              {isAlreadyAdded && (
                                <p className="text-xs text-indigo-500 mt-1">
                                  This location is already in the task list
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
          <button
            onClick={handleConfirm}
            disabled={selectedLocationIds.size === 0}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast order-1 sm:order-2"
          >
            {(() => {
              const newlySelected = [...selectedLocationIds].filter(id => !alreadyAdded.has(id)).length;
              const alreadyAddedSelected = [...selectedLocationIds].filter(id => alreadyAdded.has(id)).length;
              if (alreadyAddedSelected > 0 && newlySelected > 0) {
                return `Add to Shift (${newlySelected} new + ${alreadyAddedSelected} existing)`;
              } else if (alreadyAddedSelected > 0) {
                return `Add to Shift (${alreadyAddedSelected} already in shift)`;
              }
              return `Add to Shift (${newlySelected})`;
            })()}
          </button>
        </div>
      </div>
    </>
  );
}
