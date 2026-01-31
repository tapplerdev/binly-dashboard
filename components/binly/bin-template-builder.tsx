'use client';

import { useState, useMemo, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { Route } from '@/lib/types/route';
import { getRoutes, createRoute, updateRoute, deleteRoute } from '@/lib/api/routes';
import { Loader2, Plus, X, Trash2, Edit2, MapPin, Package, Search, Filter } from 'lucide-react';
import { TemplateEditorModal } from './template-editor-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';

// Default map center (San Jose, CA)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Warehouse location
const WAREHOUSE_LOCATION = { lat: 37.34692, lng: -121.92984 };

export function BinTemplateBuilder() {
  const { data: bins = [], isLoading: loadingBins } = useBins();
  const [templates, setTemplates] = useState<Route[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Route | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Route | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterArea, setFilterArea] = useState('all');
  const [filterBinCount, setFilterBinCount] = useState('all');
  const [isClosing, setIsClosing] = useState(false);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Route | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      const data = await getRoutes();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  // Get unique areas from templates
  const areas = useMemo(() => {
    const uniqueAreas = new Set(templates.map(t => t.geographic_area).filter(Boolean));
    return Array.from(uniqueAreas).sort();
  }, [templates]);

  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesArea = template.geographic_area?.toLowerCase().includes(query);
        if (!matchesName && !matchesArea) return false;
      }

      // Area filter
      if (filterArea !== 'all' && template.geographic_area !== filterArea) {
        return false;
      }

      // Bin count filter
      if (filterBinCount !== 'all') {
        const count = template.bin_count;
        if (filterBinCount === 'small' && count > 5) return false;
        if (filterBinCount === 'medium' && (count <= 5 || count > 15)) return false;
        if (filterBinCount === 'large' && count <= 15) return false;
      }

      return true;
    });
  }, [templates, searchQuery, filterArea, filterBinCount]);

  // Get bins for selected template
  const selectedTemplateBins = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.bin_ids) return [];
    return bins.filter(bin => selectedTemplate.bin_ids!.includes(bin.id));
  }, [selectedTemplate, bins]);

  // Calculate metrics for selected template
  const selectedTemplateMetrics = useMemo(() => {
    const criticalCount = selectedTemplateBins.filter(b => (b.fill_percentage ?? 0) >= 80).length;
    const avgFill = selectedTemplateBins.length > 0
      ? selectedTemplateBins.reduce((sum, b) => sum + (b.fill_percentage ?? 0), 0) / selectedTemplateBins.length
      : 0;

    return {
      totalBins: selectedTemplateBins.length,
      criticalBins: criticalCount,
      avgFill: Math.round(avgFill),
    };
  }, [selectedTemplateBins]);

  // Open modal for creating new template
  function openCreateModal() {
    setEditingTemplate(null);
    setShowEditorModal(true);
  }

  // Open modal for editing existing template
  function openEditModal(template: Route) {
    setEditingTemplate(template);
    setShowEditorModal(true);
  }

  // Handle save from modal
  async function handleSaveTemplate(data: {
    name: string;
    description: string;
    geographic_area: string;
    bin_ids: string[];
  }) {
    if (editingTemplate) {
      // Update existing
      await updateRoute(editingTemplate.id, data);
    } else {
      // Create new
      await createRoute(data);
    }

    // Reload templates
    await loadTemplates();
  }

  // Open delete confirmation modal
  function openDeleteModal(template: Route) {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  }

  // Confirm and delete template
  async function confirmDeleteTemplate() {
    if (!templateToDelete) return;

    try {
      setIsDeleting(true);
      await deleteRoute(templateToDelete.id);
      await loadTemplates();

      if (selectedTemplate?.id === templateToDelete.id) {
        setSelectedTemplate(null);
      }

      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setIsDeleting(false);
    }
  }

  // Cancel delete
  function cancelDelete() {
    setShowDeleteModal(false);
    setTemplateToDelete(null);
  }

  // Trigger drawer animation when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setIsDrawerMounted(false);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsDrawerMounted(true);
      });
    }
  }, [selectedTemplate]);

  // View template details
  function viewTemplateDetails(template: Route) {
    setIsClosing(false);
    setSelectedTemplate(template);
  }

  // Close template details drawer
  function closeTemplateDetails() {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedTemplate(null);
      setIsClosing(false);
      setIsDrawerMounted(false);
    }, 300);
  }

  return (
    <div className="relative flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left Sidebar - Template List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Bin Templates</h2>
          <button
            onClick={openCreateModal}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Filter Icon Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border transition-fast ${
                showFilters
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              title={showFilters ? 'Hide Filters' : 'Show Filters'}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-3 pt-3">
              {/* Area Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Area</label>
                <select
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Areas</option>
                  {areas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              {/* Bin Count Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Size</label>
                <select
                  value={filterBinCount}
                  onChange={(e) => setFilterBinCount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Sizes</option>
                  <option value="small">Small (≤5 bins)</option>
                  <option value="medium">Medium (6-15 bins)</option>
                  <option value="large">Large (16+ bins)</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(filterArea !== 'all' || filterBinCount !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterArea('all');
                    setFilterBinCount('all');
                    setSearchQuery('');
                  }}
                  className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-fast"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Count */}
        {(searchQuery || filterArea !== 'all' || filterBinCount !== 'all') && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs text-gray-600">
              Showing {filteredTemplates.length} of {templates.length} templates
            </p>
          </div>
        )}

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first one!</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No templates found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div
                key={template.id}
                onClick={() => viewTemplateDetails(template)}
                className={`p-3 rounded-lg border transition-fast cursor-pointer ${
                  selectedTemplate?.id === template.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(template);
                      }}
                      className="p-1 hover:bg-blue-100 rounded transition-fast"
                      title="Edit Template"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(template);
                      }}
                      className="p-1 hover:bg-red-100 rounded transition-fast"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {template.bin_count} bins
                  </span>
                  {template.geographic_area && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {template.geographic_area}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Map View */}
      <div className="flex-1 relative">
        {loadingBins ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-gray-600">Loading bins...</p>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              mapId="bin-template-builder-map"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              disableDefaultUI={false}
              gestureHandling="greedy"
              style={{ width: '100%', height: '100%' }}
            >
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

              {/* Bin Markers - Highlight selected template's bins */}
              {bins.filter(isMappableBin).map((bin) => {
                const isInSelectedTemplate = selectedTemplate?.bin_ids?.includes(bin.id) || false;
                const markerColor = isInSelectedTemplate ? '#4880FF' : getBinMarkerColor(bin.fill_percentage);

                return (
                  <AdvancedMarker
                    key={bin.id}
                    position={{ lat: bin.latitude, lng: bin.longitude }}
                    zIndex={isInSelectedTemplate ? 15 : 10}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 shadow-lg transition-all duration-300 flex items-center justify-center ${
                        isInSelectedTemplate
                          ? 'scale-125 border-white ring-4 ring-primary/40 animate-pulse'
                          : 'border-white'
                      }`}
                      style={{ backgroundColor: markerColor }}
                      title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
                    >
                      <span className="text-xs font-bold text-white">{bin.bin_number}</span>
                    </div>
                  </AdvancedMarker>
                );
              })}
            </Map>
          </APIProvider>
        )}

        {/* Empty State Overlay (when no template selected) */}
        {!selectedTemplate && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700">Select a template to view details</p>
              <p className="text-sm text-gray-500 mt-1">
                Or create a new one to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Template Details (Read-Only) - Overlay */}
      {selectedTemplate && (
        <div className={`absolute top-0 right-0 bottom-0 w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20 transition-transform duration-300 ease-in-out ${
          isClosing ? 'translate-x-full' : (isDrawerMounted ? 'translate-x-0' : 'translate-x-full')
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Template Details</h2>
              <button
                onClick={closeTemplateDetails}
                className="p-2 hover:bg-gray-100 rounded-lg transition-fast"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Template Info */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <p className="text-sm font-medium text-gray-900">{selectedTemplate.name}</p>
            </div>

            {selectedTemplate.geographic_area && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
                <p className="text-sm text-gray-900">{selectedTemplate.geographic_area}</p>
              </div>
            )}

            {selectedTemplate.description && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <p className="text-sm text-gray-900">{selectedTemplate.description}</p>
              </div>
            )}

            {/* Metrics */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Metrics</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Bins:</span>
                <span className="font-semibold text-gray-900">{selectedTemplateMetrics.totalBins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Critical (≥80%):</span>
                <span className="font-semibold text-red-600">{selectedTemplateMetrics.criticalBins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Fill:</span>
                <span className="font-semibold text-gray-900">{selectedTemplateMetrics.avgFill}%</span>
              </div>
            </div>

            {/* Bin List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bins in Template</h3>
              <div className="space-y-2">
                {selectedTemplateBins.map((bin) => (
                  <div
                    key={bin.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm text-gray-900">Bin #{bin.bin_number}</p>
                      <span className="text-xs text-gray-500">{bin.fill_percentage ?? 0}%</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {bin.location_name || `${bin.current_street}, ${bin.city}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => openEditModal(selectedTemplate)}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => openDeleteModal(selectedTemplate)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showEditorModal && (
        <TemplateEditorModal
          onClose={() => setShowEditorModal(false)}
          onSave={handleSaveTemplate}
          initialData={editingTemplate ? {
            name: editingTemplate.name,
            description: editingTemplate.description || '',
            geographic_area: editingTemplate.geographic_area || '',
            bin_ids: editingTemplate.bin_ids || [],
          } : undefined}
          allBins={bins}
          isEditing={!!editingTemplate}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDeleteTemplate}
        title="Delete Template"
        message={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Template"
        cancelText="Cancel"
        isDeleting={isDeleting}
      />
    </div>
  );
}
