'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { X, Search, Lasso, MapIcon, List, Filter, ChevronDown } from 'lucide-react';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

interface BinSelectionMapProps {
  onClose: () => void;
  onConfirm: (newBinIds: string[], removedBinIds: string[]) => void;
  initialSelectedBins?: string[];
  alreadyAddedBinIds?: string[]; // Bins already in the task list — shown as pre-checked with distinct style
}

// Drawing Manager Component - Must be child of Map to use useMap
interface DrawingManagerComponentProps {
  lassoMode: boolean;
  bins: Bin[];
  onBinsSelected: (binIds: string[]) => void;
}

function DrawingManagerComponent({ lassoMode, bins, onBinsSelected }: DrawingManagerComponentProps) {
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
      const selectedBins: string[] = [];

      bins.forEach((bin) => {
        if (isMappableBin(bin)) {
          const point = new google.maps.LatLng(bin.latitude, bin.longitude);
          const isInside = google.maps.geometry.poly.containsLocation(point, polygon);

          if (isInside) {
            selectedBins.push(bin.id);
          }
        }
      });

      // Notify parent component
      onBinsSelected(selectedBins);

      // Remove the polygon after selection
      polygon.setMap(null);

      // Exit drawing mode
      manager.setDrawingMode(null);
    });

    return () => {
      manager.setMap(null);
    };
  }, [map, bins, onBinsSelected]);

  // Toggle drawing mode based on lassoMode prop
  useEffect(() => {
    if (!drawingManager) return;

    if (lassoMode) {
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else {
      drawingManager.setDrawingMode(null);
    }
  }, [lassoMode, drawingManager]);

  return null;
}

export function BinSelectionMap({ onClose, onConfirm, initialSelectedBins = [], alreadyAddedBinIds = [] }: BinSelectionMapProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const alreadyAdded = new Set(alreadyAddedBinIds);
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set([...initialSelectedBins, ...alreadyAddedBinIds]));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [lassoMode, setLassoMode] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map'); // Mobile view toggle
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Filter options
  const [showMissingBins, setShowMissingBins] = useState(true);
  const [showCriticalBins, setShowCriticalBins] = useState(true);
  const [showHighFillBins, setShowHighFillBins] = useState(true);
  const [showMediumFillBins, setShowMediumFillBins] = useState(true);
  const [showLowFillBins, setShowLowFillBins] = useState(true);

  // Load bins from API
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

  // Check if a bin has a pending move request (informational only)
  const hasMoveRequest = (bin: Bin): boolean => bin.move_requested === true;

  // Toggle bin selection
  const toggleBinSelection = (binId: string) => {
    const newSelection = new Set(selectedBinIds);
    if (newSelection.has(binId)) {
      newSelection.delete(binId);
    } else {
      newSelection.add(binId);
    }
    setSelectedBinIds(newSelection);
  };

  // Handle lasso selection
  const handleLassoSelection = (binIds: string[]) => {
    const newSelection = new Set(selectedBinIds);
    binIds.forEach(id => newSelection.add(id));
    setSelectedBinIds(newSelection);
    setLassoMode(false); // Exit lasso mode after selection
  };

  // Select all bins
  const selectAll = () => {
    const allBinIds = new Set(filteredBins.map(b => b.id));
    setSelectedBinIds(allBinIds);
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedBinIds(new Set());
  };

  // Filter bins based on search and filter options
  const filteredBins = bins.filter(bin => {
    // Apply fill level and status filters first
    if (bin.status === 'missing') {
      if (!showMissingBins) return false;
    } else {
      const fillPercentage = bin.fill_percentage ?? 0;
      if (fillPercentage >= 80) {
        if (!showCriticalBins) return false;
      } else if (fillPercentage >= 50) {
        if (!showHighFillBins) return false;
      } else if (fillPercentage >= 25) {
        if (!showMediumFillBins) return false;
      } else {
        if (!showLowFillBins) return false;
      }
    }

    // Then apply search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bin.bin_number.toString().includes(query) ||
      bin.current_street?.toLowerCase().includes(query) ||
      bin.city?.toLowerCase().includes(query) ||
      bin.location_name?.toLowerCase().includes(query)
    );
  });

  // Get mappable bins for map display
  const mappableBins = filteredBins.filter(isMappableBin);

  // Handle confirm — pass newly added bins AND bins that were removed (unchecked from alreadyAdded)
  const handleConfirm = () => {
    const newBinIds = Array.from(selectedBinIds).filter(id => !alreadyAdded.has(id));
    const removedBinIds = Array.from(alreadyAdded).filter(id => !selectedBinIds.has(id));
    onConfirm(newBinIds, removedBinIds);
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
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Bins for Shift</h2>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5 hidden md:block">
                Click bins individually or use Lasso Select to choose multiple at once
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
                <span>List ({filteredBins.length})</span>
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
                  <p className="text-sm text-gray-600">Loading bins...</p>
                </div>
              </div>
            ) : (
              <APIProvider
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                libraries={['drawing', 'geometry']}
              >
                <Map
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={DEFAULT_ZOOM}
                  mapId="binly-bin-selection"
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="w-full h-full"
                >
                  {/* Drawing Manager for Lasso Selection */}
                  <DrawingManagerComponent
                    lassoMode={lassoMode}
                    bins={mappableBins}
                    onBinsSelected={handleLassoSelection}
                  />

                  {/* Bin Markers */}
                  {mappableBins.map((bin) => {
                    const isSelected = selectedBinIds.has(bin.id);
                    const isAlreadyAdded = alreadyAdded.has(bin.id);
                    const markerColor = isSelected
                      ? '#16a34a'
                      : getBinMarkerColor(bin.fill_percentage, bin.status);

                    return (
                      <AdvancedMarker
                        key={bin.id}
                        position={{ lat: bin.latitude, lng: bin.longitude }}
                        onClick={() => toggleBinSelection(bin.id)}
                        zIndex={isSelected ? 15 : 10}
                      >
                        <div className="relative cursor-pointer" title={`Bin #${bin.bin_number} - ${bin.location_name || bin.current_street}${isAlreadyAdded ? ' · Already in shift' : ''}${hasMoveRequest(bin) ? ' · Move req. pending' : ''}`}>
                          {/* Pulsing ring for all selected bins */}
                          {isSelected && (
                            <div className="absolute inset-0 -m-2">
                              <div className="w-12 h-12 rounded-full bg-green-500 opacity-30 animate-ping" />
                            </div>
                          )}
                          <div
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all hover:scale-110 ${
                              isSelected ? 'ring-2 ring-white shadow-lg' : ''
                            }`}
                            style={{ backgroundColor: markerColor }}
                          >
                            {bin.bin_number % 100}
                          </div>
                        </div>
                      </AdvancedMarker>
                    );
                  })}
                </Map>
              </APIProvider>
            )}

            {/* Lasso Tool Button & Instructions - Only show in map mode */}
            {viewMode === 'map' && (
              <>
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => setLassoMode(!lassoMode)}
                    className={`px-3 md:px-4 py-2 rounded-lg shadow-lg font-medium text-xs md:text-sm transition-all ${
                      lassoMode
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Draw a polygon to select multiple bins"
                  >
                    <div className="flex items-center gap-2">
                      <Lasso className="w-4 h-4" />
                      <span className="hidden sm:inline">{lassoMode ? 'Click to Draw' : 'Lasso Select'}</span>
                      <span className="sm:hidden">{lassoMode ? 'Drawing' : 'Lasso'}</span>
                    </div>
                  </button>

                  {/* Drawing Instructions - Desktop only */}
                  {lassoMode && (
                    <div className="hidden md:block bg-white rounded-lg shadow-lg p-3 text-xs text-gray-700 max-w-xs animate-slide-in-down">
                      <p className="font-semibold mb-1">How to use:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Click on map to add points</li>
                        <li>Draw around bins you want</li>
                        <li>Click first point to close polygon</li>
                      </ol>
                      <p className="mt-2 text-gray-500">Bins inside will be selected automatically</p>
                    </div>
                  )}
                </div>

                {/* Selection Counter */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 md:px-4 py-2 border border-gray-200">
                  <p className="text-xs md:text-sm font-semibold text-gray-900">
                    {selectedBinIds.size} bin{selectedBinIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Bin List - Desktop: Right 40% | Mobile: Full screen when viewMode === 'list' */}
          <div className={`w-full md:w-[40%] border-l border-gray-200 flex flex-col bg-gray-50 ${viewMode === 'map' ? 'hidden md:flex' : 'flex'}`}>
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              {/* Search Bar and Filter Button */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by bin number or address..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-fast flex items-center gap-2 whitespace-nowrap"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filter</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Filter Dropdown */}
                  {showFilterDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-slide-in-down">
                      <div className="p-3 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Bin Types</p>
                      </div>
                      <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                        {/* Missing Bins */}
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-500" />
                            <span className="text-sm text-gray-700">Missing</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={showMissingBins}
                            onChange={(e) => setShowMissingBins(e.target.checked)}
                            className="w-4 h-4 text-gray-600 rounded focus:ring-2 focus:ring-gray-400/20"
                          />
                        </label>

                        {/* Critical Fill (80%+) */}
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-sm text-gray-700">Critical (80%+)</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={showCriticalBins}
                            onChange={(e) => setShowCriticalBins(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-400/20"
                          />
                        </label>

                        {/* High Fill (50-79%) */}
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            <span className="text-sm text-gray-700">High Fill (50-79%)</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={showHighFillBins}
                            onChange={(e) => setShowHighFillBins(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-400/20"
                          />
                        </label>

                        {/* Medium Fill (25-49%) */}
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-sm text-gray-700">Medium Fill (25-49%)</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={showMediumFillBins}
                            onChange={(e) => setShowMediumFillBins(e.target.checked)}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-400/20"
                          />
                        </label>

                        {/* Low Fill (0-24%) */}
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm text-gray-700">Low Fill (0-24%)</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={showLowFillBins}
                            onChange={(e) => setShowLowFillBins(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-400/20"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={selectAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-fast"
                >
                  Select All ({filteredBins.length})
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-fast"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Bin List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredBins.map((bin) => {
                  const isSelected = selectedBinIds.has(bin.id);
                  const isAlreadyAdded = alreadyAdded.has(bin.id);
                  const fillPercentage = bin.fill_percentage ?? 0;
                  const moveReqPending = hasMoveRequest(bin);

                  return (
                    <div
                      key={bin.id}
                      onClick={() => toggleBinSelection(bin.id)}
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
                          className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500"
                        />

                        {/* Bin Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-sm text-gray-900">
                              Bin #{bin.bin_number}
                            </p>
                            <span className="text-xs text-gray-500">{fillPercentage}%</span>
                            {isAlreadyAdded && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded border border-gray-200">
                                Already in shift
                              </span>
                            )}
                            {moveReqPending && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded border border-blue-200">
                                Move req. pending
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {bin.location_name || `${bin.current_street}, ${bin.city}`}
                          </p>

                          {/* Always show the fill bar */}
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${fillPercentage}%`,
                                backgroundColor: getBinMarkerColor(fillPercentage, bin.status),
                              }}
                            />
                          </div>

                          {/* Sub-labels below the bar */}
                          {moveReqPending && (
                            <p className="mt-1 text-xs text-gray-400">
                              This bin also has an open move request.{' '}
                              <a
                                href="/operations/move-requests"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="underline hover:text-gray-600"
                              >
                                View
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            const added = [...selectedBinIds].filter(id => !alreadyAdded.has(id)).length;
            const removed = [...alreadyAdded].filter(id => !selectedBinIds.has(id)).length;
            const hasChanges = added > 0 || removed > 0;
            return (
              <button
                onClick={handleConfirm}
                disabled={!hasChanges}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast order-1 sm:order-2"
              >
                Save
              </button>
            );
          })()}
        </div>
      </div>
    </>
  );
}
