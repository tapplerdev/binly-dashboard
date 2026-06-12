'use client';

import { useState, useMemo, useEffect } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { Route } from '@/lib/types/route';
import { getRoutes, createRoute, updateRoute, deleteRoute } from '@/lib/api/routes';
import { Loader2, Plus, X, Trash2, Edit2, MapPin, Package, Search, Filter, Sparkles, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SmartRoutesModal } from './smart-routes-modal';
import { TemplateEditorModal } from './template-editor-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';

// Default map center (San Jose, CA)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

export function BinTemplateBuilder() {
  const { data: bins = [], isLoading: loadingBins } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const WAREHOUSE_LOCATION = { lat: warehouse?.latitude || 0, lng: warehouse?.longitude || 0 };
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
  const [showSmartRoutes, setShowSmartRoutes] = useState(false);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Route | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [healthFilter, setHealthFilter] = useState<'all' | 'critical' | 'attention' | 'healthy'>('all');

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

  // Compute health for all templates (must be before filteredTemplates)
  const templateHealth = useMemo(() => {
    const map = new Map<string, { avgFill: number; criticalBins: number; status: 'critical' | 'attention' | 'healthy' }>();
    if (bins.length === 0) return map;

    templates.forEach(template => {
      const tBins = (template.bin_ids || [])
        .map(id => bins.find(b => b.id === id))
        .filter((b): b is Bin => b !== undefined);

      if (tBins.length === 0) {
        map.set(template.id, { avgFill: 0, criticalBins: 0, status: 'healthy' });
        return;
      }

      const avgFill = Math.round(tBins.reduce((s, b) => s + (b.fill_percentage ?? 0), 0) / tBins.length);
      const criticalBins = tBins.filter(b => (b.fill_percentage ?? 0) >= 80).length;

      let status: 'critical' | 'attention' | 'healthy' = 'healthy';
      if (criticalBins >= 2 || avgFill >= 70) status = 'critical';
      else if (criticalBins >= 1 || avgFill >= 45) status = 'attention';

      map.set(template.id, { avgFill, criticalBins, status });
    });

    return map;
  }, [templates, bins]);

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

      // Health filter
      if (healthFilter !== 'all') {
        const health = templateHealth.get(template.id);
        if (health && health.status !== healthFilter) return false;
      }

      return true;
    });
  }, [templates, searchQuery, filterArea, filterBinCount, healthFilter, templateHealth]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
            <button
              onClick={() => setShowSmartRoutes(true)}
              className="px-3 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition-fast flex items-center justify-center gap-1.5"
              title="Auto-generate routes from bin data"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
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

        {/* Health Filter Chips */}
        {!loadingTemplates && templateHealth.size > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-1.5 flex-wrap">
            {([
              { key: 'all' as const, label: 'All', count: templates.length },
              { key: 'critical' as const, label: 'Critical', icon: <AlertTriangle className="w-3 h-3" />, count: templates.filter(t => templateHealth.get(t.id)?.status === 'critical').length },
              { key: 'attention' as const, label: 'Attention', icon: <AlertCircle className="w-3 h-3" />, count: templates.filter(t => templateHealth.get(t.id)?.status === 'attention').length },
              { key: 'healthy' as const, label: 'Healthy', icon: <CheckCircle2 className="w-3 h-3" />, count: templates.filter(t => templateHealth.get(t.id)?.status === 'healthy').length },
            ]).map(chip => (
              <button
                key={chip.key}
                onClick={() => setHealthFilter(chip.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
                  healthFilter === chip.key
                    ? chip.key === 'critical' ? 'bg-red-100 text-red-700 border border-red-200'
                      : chip.key === 'attention' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : chip.key === 'healthy' ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                }`}
              >
                {'icon' in chip && chip.icon}
                {chip.label}
                <span className="text-[10px] font-bold">{chip.count}</span>
              </button>
            ))}
          </div>
        )}

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
            filteredTemplates.map(template => {
              const health = templateHealth.get(template.id);
              const fillPct = health?.avgFill ?? 0;
              const borderColor = !health ? 'border-l-gray-300'
                : health.status === 'critical' ? 'border-l-red-500'
                : health.status === 'attention' ? 'border-l-amber-500'
                : 'border-l-green-500';
              const ringColor = !health ? '#d1d5db'
                : health.status === 'critical' ? '#ef4444'
                : health.status === 'attention' ? '#f59e0b'
                : '#22c55e';
              // SVG donut: circumference = 2 * PI * 18 ≈ 113
              const circ = 113.1;
              const dashOffset = circ - (circ * Math.min(fillPct, 100) / 100);

              return (
                <div
                  key={template.id}
                  onClick={() => viewTemplateDetails(template)}
                  className={`rounded-lg border-l-[4px] border border-gray-200 transition-fast cursor-pointer ${borderColor} ${
                    selectedTemplate?.id === template.id
                      ? 'bg-primary/5 ring-2 ring-primary/30'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Donut ring */}
                    <div className="relative w-11 h-11 shrink-0">
                      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                        <circle cx="20" cy="20" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle cx="20" cy="20" r="18" fill="none" stroke={ringColor} strokeWidth="3"
                          strokeDasharray={circ} strokeDashoffset={dashOffset} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800">
                        {fillPct}%
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{template.name}</h3>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(template); }}
                            className="p-1 hover:bg-blue-50 rounded transition-fast" title="Edit">
                            <Edit2 className="w-3 h-3 text-blue-600" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openDeleteModal(template); }}
                            className="p-1 hover:bg-red-50 rounded transition-fast" title="Delete">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <Package className="w-3 h-3" /> {template.bin_count}
                        </span>
                        {template.geographic_area && (
                          <span className="truncate">{template.geographic_area}</span>
                        )}
                      </div>
                      {health && health.criticalBins > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-[10px] font-semibold text-red-600">
                            {health.criticalBins} bin{health.criticalBins !== 1 ? 's' : ''} over 80%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }))
          }
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
            <GoogleMap
              mapId="bin-template-builder-map"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              mapTypeId="hybrid"
              disableDefaultUI={false}
              streetViewControl={false}
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
            </GoogleMap>
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
          <div className="flex-1 overflow-y-auto">
            {/* Route Health Hero */}
            {(() => {
              const h = templateHealth.get(selectedTemplate.id);
              const fill = h?.avgFill ?? selectedTemplateMetrics.avgFill;
              const critical = h?.criticalBins ?? selectedTemplateMetrics.criticalBins;
              const heroColor = fill >= 70 ? 'from-red-500 to-red-600'
                : fill >= 45 ? 'from-amber-500 to-amber-600'
                : 'from-green-500 to-green-600';
              const heroBg = fill >= 70 ? 'bg-red-50'
                : fill >= 45 ? 'bg-amber-50'
                : 'bg-green-50';
              const circ = 150.8; // 2 * PI * 24
              const dashOff = circ - (circ * Math.min(fill, 100) / 100);

              return (
                <div className={`p-5 ${heroBg} border-b border-gray-200`}>
                  <div className="flex items-center gap-4">
                    {/* Large donut */}
                    <div className="relative w-16 h-16 shrink-0">
                      <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
                        <circle cx="26" cy="26" r="24" fill="none" stroke="white" strokeWidth="4" />
                        <circle cx="26" cy="26" r="24" fill="none" strokeWidth="4"
                          stroke="url(#grad)" strokeDasharray={circ} strokeDashoffset={dashOff} strokeLinecap="round" />
                        <defs>
                          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={fill >= 70 ? '#ef4444' : fill >= 45 ? '#f59e0b' : '#22c55e'} />
                            <stop offset="100%" stopColor={fill >= 70 ? '#dc2626' : fill >= 45 ? '#d97706' : '#16a34a'} />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-gray-900">
                        {fill}%
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{selectedTemplate.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedTemplate.geographic_area}</p>
                      {selectedTemplate.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{selectedTemplate.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm">
                      <p className="text-lg font-bold text-gray-900">{selectedTemplateMetrics.totalBins}</p>
                      <p className="text-[10px] text-gray-500">Total Bins</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm">
                      <p className={`text-lg font-bold ${critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>{critical}</p>
                      <p className="text-[10px] text-gray-500">Over 80%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm">
                      <p className="text-lg font-bold text-gray-900">{selectedTemplateMetrics.totalBins - critical}</p>
                      <p className="text-[10px] text-gray-500">Healthy</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Bin List */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Bins ({selectedTemplateBins.length})
              </h3>
              <div className="space-y-1.5">
                {selectedTemplateBins.map((bin) => {
                  const pct = bin.fill_percentage ?? 0;
                  const fillColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500';
                  return (
                    <div key={bin.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-fast">
                      {/* Mini fill bar */}
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center relative overflow-hidden">
                        <div className={`absolute bottom-0 left-0 right-0 ${fillColor} transition-all`}
                          style={{ height: `${pct}%` }} />
                        <span className="relative text-[10px] font-bold text-gray-800">{bin.bin_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {bin.location_name || `${bin.current_street}, ${bin.city}`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ${
                        pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-amber-600' : 'text-green-600'
                      }`}>{pct}%</span>
                    </div>
                  );
                })}
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
      {showSmartRoutes && (
        <SmartRoutesModal onClose={() => { setShowSmartRoutes(false); loadTemplates(); }} />
      )}
    </div>
  );
}
