'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { X, Search, Lasso } from 'lucide-react';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

interface BinSelectionMapProps {
  onClose: () => void;
  onConfirm: (selectedBinIds: string[]) => void;
  initialSelectedBins?: string[];
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

export function BinSelectionMap({ onClose, onConfirm, initialSelectedBins = [] }: BinSelectionMapProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set(initialSelectedBins));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [lassoMode, setLassoMode] = useState(false);

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

  // Filter bins based on search
  const filteredBins = bins.filter(bin => {
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

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(Array.from(selectedBinIds));
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
            <h2 className="text-xl font-semibold text-gray-900">Select Bins for Shift</h2>
            <p className="text-sm text-gray-600 mt-0.5">
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

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View - Left 60% */}
          <div className="flex-1 relative">
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
                    const markerColor = isSelected ? '#16a34a' : getBinMarkerColor(bin.fill_percentage);

                    return (
                      <AdvancedMarker
                        key={bin.id}
                        position={{ lat: bin.latitude, lng: bin.longitude }}
                        onClick={() => toggleBinSelection(bin.id)}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-all hover:scale-110 ${
                            isSelected ? 'ring-4 ring-green-300 animate-pulse-glow' : ''
                          }`}
                          style={{ backgroundColor: markerColor }}
                          title={`Bin #${bin.bin_number} - ${bin.location_name || bin.current_street}`}
                        >
                          {bin.bin_number % 100}
                        </div>
                      </AdvancedMarker>
                    );
                  })}
                </Map>
              </APIProvider>
            )}

            {/* Lasso Tool Button & Instructions */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={() => setLassoMode(!lassoMode)}
                className={`px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-all ${
                  lassoMode
                    ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Draw a polygon to select multiple bins"
              >
                <div className="flex items-center gap-2">
                  <Lasso className="w-4 h-4" />
                  <span>{lassoMode ? 'Click to Draw' : 'Lasso Select'}</span>
                </div>
              </button>

              {/* Drawing Instructions */}
              {lassoMode && (
                <div className="bg-white rounded-lg shadow-lg p-3 text-xs text-gray-700 max-w-xs animate-slide-in-down">
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
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900">
                {selectedBinIds.size} bin{selectedBinIds.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          {/* Bin List - Right 40% */}
          <div className="w-[40%] border-l border-gray-200 flex flex-col bg-gray-50">
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by bin number or address..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
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
                  const fillPercentage = bin.fill_percentage ?? 0;

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
                          className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />

                        {/* Bin Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm text-gray-900">
                              Bin #{bin.bin_number}
                            </p>
                            <span className="text-xs text-gray-500">
                              {fillPercentage}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {bin.location_name || `${bin.current_street}, ${bin.city}`}
                          </p>

                          {/* Fill Level Bar */}
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${fillPercentage}%`,
                                backgroundColor: getBinMarkerColor(fillPercentage),
                              }}
                            />
                          </div>
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedBinIds.size === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast"
          >
            Confirm Selection ({selectedBinIds.size})
          </button>
        </div>
      </div>
    </>
  );
}
