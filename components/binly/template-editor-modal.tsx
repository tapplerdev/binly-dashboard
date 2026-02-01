'use client';

import { useState, useMemo, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { X, Search, Lasso, AlertCircle, Save } from 'lucide-react';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

// Default map center (San Jose, CA)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

interface TemplateEditorModalProps {
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    geographic_area: string;
    bin_ids: string[];
  }) => Promise<void>;
  initialData?: {
    name: string;
    description: string;
    geographic_area: string;
    bin_ids: string[];
  };
  allBins: Bin[];
  isEditing?: boolean;
}

// Drawing Manager Component
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

    google.maps.event.addListener(manager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
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

      onBinsSelected(selectedBins);
      polygon.setMap(null);
      manager.setDrawingMode(null);
    });

    return () => {
      manager.setMap(null);
    };
  }, [map, bins, onBinsSelected]);

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

export function TemplateEditorModal({
  onClose,
  onSave,
  initialData,
  allBins,
  isEditing = false
}: TemplateEditorModalProps) {
  const { data: warehouse } = useWarehouseLocation();
  const WAREHOUSE_LOCATION = { lat: warehouse?.latitude || 0, lng: warehouse?.longitude || 0 };

  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(
    new Set(initialData?.bin_ids || [])
  );
  const [templateName, setTemplateName] = useState(initialData?.name || '');
  const [templateDescription, setTemplateDescription] = useState(initialData?.description || '');
  const [templateArea, setTemplateArea] = useState(initialData?.geographic_area || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [lassoMode, setLassoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLassoMode(false);
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
  const filteredBins = allBins.filter(bin => {
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

  // Selected bins details
  const selectedBins = useMemo(() => {
    return allBins.filter(bin => selectedBinIds.has(bin.id));
  }, [allBins, selectedBinIds]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const criticalCount = selectedBins.filter(b => (b.fill_percentage ?? 0) >= 80).length;
    const avgFill = selectedBins.length > 0
      ? selectedBins.reduce((sum, b) => sum + (b.fill_percentage ?? 0), 0) / selectedBins.length
      : 0;

    return {
      totalBins: selectedBinIds.size,
      criticalBins: criticalCount,
      avgFill: Math.round(avgFill),
    };
  }, [selectedBins, selectedBinIds]);

  // Handle save
  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    if (selectedBinIds.size === 0) {
      setError('Please select at least one bin');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        name: templateName.trim(),
        description: templateDescription.trim(),
        geographic_area: templateArea.trim() || 'General',
        bin_ids: Array.from(selectedBinIds),
      });

      onClose();
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
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
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Template' : 'Create New Template'}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Select bins for your route template
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
              libraries={['drawing', 'geometry']}
            >
              <Map
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                mapId="template-editor-map"
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

                {/* Warehouse Marker */}
                <AdvancedMarker
                  position={WAREHOUSE_LOCATION}
                  zIndex={20}
                  title="Warehouse"
                >
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  </div>
                </AdvancedMarker>

                {/* Bin Markers */}
                {mappableBins.map((bin) => {
                  const isSelected = selectedBinIds.has(bin.id);
                  const markerColor = isSelected ? '#4880FF' : getBinMarkerColor(bin.fill_percentage);

                  return (
                    <AdvancedMarker
                      key={bin.id}
                      position={{ lat: bin.latitude, lng: bin.longitude }}
                      onClick={() => toggleBinSelection(bin.id)}
                      zIndex={isSelected ? 15 : 10}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-all hover:scale-110 ${
                          isSelected ? 'ring-4 ring-primary/30 scale-125' : ''
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

            {/* Lasso Tool Button */}
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
                <div className="bg-white rounded-lg shadow-lg p-3 text-xs text-gray-700 max-w-xs animate-fade-in">
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

            {/* Selection Counter & Metrics */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-3 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {selectedBinIds.size} bin{selectedBinIds.size !== 1 ? 's' : ''} selected
              </p>
              {selectedBinIds.size > 0 && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between gap-4">
                    <span>Critical (≥80%):</span>
                    <span className="font-medium text-red-600">{metrics.criticalBins}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Avg Fill:</span>
                    <span className="font-medium text-gray-900">{metrics.avgFill}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bin List - Right 40% */}
          <div className="w-[40%] border-l border-gray-200 flex flex-col bg-gray-50">
            {/* Template Details Form */}
            <div className="p-4 border-b border-gray-200 bg-white space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Route A - North San Jose"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Geographic Area
                </label>
                <input
                  type="text"
                  value={templateArea}
                  onChange={(e) => setTemplateArea(e.target.value)}
                  placeholder="e.g., North San Jose, Downtown"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe this route template..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}
            </div>

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
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
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
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-fast disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedBinIds.size === 0 || !templateName.trim()}
            className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-fast flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
