'use client';

import { useState } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { PotentialLocation } from '@/lib/api/potential-locations';
import { X, Search, MapPin, Filter } from 'lucide-react';
import { PotentialLocationPin } from '@/components/ui/potential-location-pin';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

type DateFilter = 'all' | 'newest' | 'oldest';

interface PlacementLocationSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedLocationIds: string[]) => void;
  potentialLocations: PotentialLocation[];
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

export function PlacementLocationSelectionMap({ onClose, onConfirm, potentialLocations }: PlacementLocationSelectionMapProps) {
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Toggle location selection
  const toggleLocationSelection = (locationId: string) => {
    const newSelection = new Set(selectedLocationIds);
    if (newSelection.has(locationId)) {
      newSelection.delete(locationId);
    } else {
      newSelection.add(locationId);
    }
    setSelectedLocationIds(newSelection);
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Placement Locations for Shift</h2>
            <p className="text-sm text-gray-600 mt-0.5">
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

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Left 60% */}
          <div className="flex-1 relative">
            <APIProvider
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            >
              <Map
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                mapId="binly-placement-location-selection"
                gestureHandling="greedy"
                disableDefaultUI={false}
                className="w-full h-full"
              >
                {/* Placement Location Markers - Using PotentialLocationPin */}
                {mappableLocations.map((location) => {
                  const isSelected = selectedLocationIds.has(location.id);

                  return (
                    <AdvancedMarker
                      key={location.id}
                      position={{ lat: location.latitude, lng: location.longitude }}
                      onClick={() => toggleLocationSelection(location.id)}
                    >
                      <div
                        className={`cursor-pointer transition-all hover:scale-110 ${
                          isSelected ? 'ring-4 ring-green-300 rounded-full animate-pulse-glow' : ''
                        }`}
                        title={`${location.address || location.street} - Requested by ${location.requested_by_name}`}
                      >
                        <PotentialLocationPin
                          size={40}
                          color={isSelected ? '#16a34a' : '#FF9500'}
                        />
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </Map>
            </APIProvider>

            {/* Selection Counter */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900">
                {selectedLocationIds.size} location{selectedLocationIds.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          {/* Location List - Right 40% */}
          <div className="w-[40%] border-l border-gray-200 flex flex-col bg-gray-50">
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
                        onClick={() => toggleLocationSelection(location.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
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
                            className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />

                          {/* Location Info */}
                          <div className="flex-1 min-w-0">
                            <div className="mb-2">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {location.address || `${location.street}, ${location.city}`}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedLocationIds.size === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast"
          >
            Add to Shift ({selectedLocationIds.size})
          </button>
        </div>
      </div>
    </>
  );
}
