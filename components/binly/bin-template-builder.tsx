'use client';

import { useState, useMemo, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { Route } from '@/lib/types/route';
import { getRoutes, createRoute, updateRoute, deleteRoute } from '@/lib/api/routes';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, Save, X, Trash2, Edit2, MapPin, Package, AlertCircle } from 'lucide-react';

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
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateArea, setTemplateArea] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Failed to load route templates');
    } finally {
      setLoadingTemplates(false);
    }
  }

  // Filter mappable bins
  const mappableBins = useMemo(() => bins.filter(isMappableBin), [bins]);

  // Selected bins details
  const selectedBins = useMemo(() => {
    return bins.filter(bin => selectedBinIds.has(bin.id));
  }, [bins, selectedBinIds]);

  // Calculate template metrics
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

  // Handle bin click on map
  function handleBinClick(binId: string) {
    setSelectedBinIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(binId)) {
        newSet.delete(binId);
      } else {
        newSet.add(binId);
      }
      return newSet;
    });
  }

  // Start creating new template
  function startNewTemplate() {
    setIsCreatingNew(true);
    setSelectedTemplate(null);
    setSelectedBinIds(new Set());
    setTemplateName('');
    setTemplateDescription('');
    setTemplateArea('');
    setError(null);
  }

  // Load existing template for editing
  function loadTemplate(template: Route) {
    setSelectedTemplate(template);
    setIsCreatingNew(false);
    setSelectedBinIds(new Set(template.bin_ids || []));
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setTemplateArea(template.geographic_area || '');
    setError(null);
  }

  // Save template (create or update)
  async function saveTemplate() {
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

      const data = {
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        geographic_area: templateArea.trim() || 'General',
        bin_ids: Array.from(selectedBinIds),
      };

      if (selectedTemplate) {
        // Update existing
        await updateRoute(selectedTemplate.id, data);
      } else {
        // Create new
        await createRoute(data);
      }

      // Reload templates
      await loadTemplates();

      // Reset form
      setIsCreatingNew(false);
      setSelectedTemplate(null);
      setSelectedBinIds(new Set());
      setTemplateName('');
      setTemplateDescription('');
      setTemplateArea('');
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  // Delete template
  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await deleteRoute(templateId);
      await loadTemplates();

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setSelectedBinIds(new Set());
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template');
    }
  }

  // Cancel editing
  function cancelEdit() {
    setIsCreatingNew(false);
    setSelectedTemplate(null);
    setSelectedBinIds(new Set());
    setTemplateName('');
    setTemplateDescription('');
    setTemplateArea('');
    setError(null);
  }

  const isEditing = isCreatingNew || selectedTemplate !== null;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left Sidebar - Template List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Bin Templates</h2>
          <button
            onClick={startNewTemplate}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

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
          ) : (
            templates.map(template => (
              <div
                key={template.id}
                onClick={() => loadTemplate(template)}
                className={`p-3 rounded-lg border transition-fast cursor-pointer ${
                  selectedTemplate?.id === template.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-fast"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
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

      {/* Main Map Area */}
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

              {/* Bin Markers */}
              {mappableBins.map((bin) => {
                const isSelected = selectedBinIds.has(bin.id);
                const markerColor = isSelected ? '#4880FF' : getBinMarkerColor(bin.fill_percentage);

                return (
                  <AdvancedMarker
                    key={bin.id}
                    position={{ lat: bin.latitude, lng: bin.longitude }}
                    zIndex={isSelected ? 15 : 10}
                    onClick={() => handleBinClick(bin.id)}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 shadow-lg cursor-pointer transition-all duration-300 flex items-center justify-center ${
                        isSelected ? 'scale-125 border-white' : 'border-white hover:scale-110'
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

        {/* Bottom Stats Bar */}
        {isEditing && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-white/95 backdrop-blur-md rounded-full shadow-xl border border-gray-100 px-6 py-3">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-bold text-primary">{metrics.totalBins} bins</span>
                </div>
                {metrics.totalBins > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Critical:</span>
                      <span className="font-bold text-red-600">{metrics.criticalBins}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Avg Fill:</span>
                      <span className="font-bold text-gray-900">{metrics.avgFill}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Template Form */}
      {isEditing && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                onClick={cancelEdit}
                className="p-2 hover:bg-gray-100 rounded-lg transition-fast"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Template Name *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Route A - North San Jose"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Geographic Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Geographic Area
              </label>
              <input
                type="text"
                value={templateArea}
                onChange={(e) => setTemplateArea(e.target.value)}
                placeholder="e.g., North San Jose, Downtown"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description (optional)
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe this route template..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Metrics */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Template Metrics</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Bins:</span>
                <span className="font-semibold text-gray-900">{metrics.totalBins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Critical (≥80%):</span>
                <span className="font-semibold text-red-600">{metrics.criticalBins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Fill:</span>
                <span className="font-semibold text-gray-900">{metrics.avgFill}%</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={saveTemplate}
              disabled={saving || metrics.totalBins === 0}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {selectedTemplate ? 'Update Template' : 'Create Template'}
                </>
              )}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
