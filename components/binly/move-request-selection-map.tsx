'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin, MoveRequest } from '@/lib/types/bin';
import { X, Search, MapPin } from 'lucide-react';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

interface MoveRequestSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedRequestIds: string[]) => void;
  moveRequests: MoveRequest[];
}

/**
 * Extended MoveRequest with bin coordinates for mapping
 */
interface MappableMoveRequest extends MoveRequest {
  latitude?: number;
  longitude?: number;
}

/**
 * Get marker color based on urgency
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
      return '#10B981'; // green-500
    default:
      return '#9CA3AF'; // gray-400
  }
}

/**
 * Get badge color classes based on urgency
 */
function getUrgencyBadgeColor(urgency: MoveRequest['urgency']): string {
  switch (urgency) {
    case 'overdue':
    case 'urgent':
      return 'bg-red-100 text-red-700';
    case 'soon':
      return 'bg-orange-100 text-orange-700';
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'resolved':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function MoveRequestSelectionMap({ onClose, onConfirm, moveRequests }: MoveRequestSelectionMapProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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

  // Toggle request selection
  const toggleRequestSelection = (requestId: string) => {
    const newSelection = new Set(selectedRequestIds);
    if (newSelection.has(requestId)) {
      newSelection.delete(requestId);
    } else {
      newSelection.add(requestId);
    }
    setSelectedRequestIds(newSelection);
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

  // Filter requests based on search
  const filteredRequests = moveRequests.filter(request => {
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

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(Array.from(selectedRequestIds));
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
            <h2 className="text-xl font-semibold text-gray-900">Select Move Requests for Shift</h2>
            <p className="text-sm text-gray-600 mt-0.5">
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

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Left 60% */}
          <div className="flex-1 relative">
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
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="w-full h-full"
                >
                  {/* Move Request Markers */}
                  {mappableFilteredRequests.map((request) => {
                    const isSelected = selectedRequestIds.has(request.id);
                    const markerColor = isSelected ? '#16a34a' : getUrgencyMarkerColor(request.urgency);

                    return (
                      <AdvancedMarker
                        key={request.id}
                        position={{ lat: request.latitude!, lng: request.longitude! }}
                        onClick={() => toggleRequestSelection(request.id)}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-all hover:scale-110 shadow-lg ${
                            isSelected ? 'ring-4 ring-green-300 animate-pulse-glow' : ''
                          }`}
                          style={{ backgroundColor: markerColor }}
                          title={`Bin #${request.bin_number} - ${request.current_street}`}
                        >
                          <MapPin className="w-5 h-5" fill="white" />
                        </div>
                      </AdvancedMarker>
                    );
                  })}
                </Map>
              </APIProvider>
            )}

            {/* Selection Counter */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900">
                {selectedRequestIds.size} request{selectedRequestIds.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          {/* Request List - Right 40% */}
          <div className="w-[40%] border-l border-gray-200 flex flex-col bg-gray-50">
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
                    const urgencyColor = getUrgencyBadgeColor(request.urgency);

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
                        onClick={() => toggleRequestSelection(request.id)}
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

                          {/* Request Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-900">
                                  Bin #{request.bin_number}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5 truncate">
                                  {request.current_street}, {request.city} {request.zip}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${urgencyColor}`}>
                                {request.urgency}
                              </span>
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
            disabled={selectedRequestIds.size === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast"
          >
            Add to Shift ({selectedRequestIds.size})
          </button>
        </div>
      </div>
    </>
  );
}
