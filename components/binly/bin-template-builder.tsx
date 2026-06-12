'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { Route } from '@/lib/types/route';
import { getRoutes, createRoute, updateRoute, deleteRoute } from '@/lib/api/routes';
import { getRoutePerformance } from '@/lib/api/route-performance';
import { fetchBinAnalytics } from '@/lib/api/bin-analytics';
import { Loader2, Plus, X, Trash2, Edit2, MapPin, Package, Search, Filter, Sparkles, AlertTriangle, Trophy, Clock, TrendingUp } from 'lucide-react';
import { SmartRoutesModal } from './smart-routes-modal';
import { TemplateEditorModal } from './template-editor-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';

// Default map center (San Jose, CA)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  return days === 1 ? '1 day ago' : `${days}d ago`;
}

export function BinTemplateBuilder() {
  const { data: bins = [], isLoading: loadingBins } = useBins();
  const { data: allBinsWithRetired = [] } = useBins(true); // includes retired for inactive detection
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
  const [perfFilter, setPerfFilter] = useState<'all' | 'top' | 'needs-runs' | 'has-issues'>('all');

  // Route performance from shift history
  const { data: perfData = {} } = useQuery({
    queryKey: ['route-performance'],
    queryFn: getRoutePerformance,
    staleTime: 5 * 60 * 1000,
  });

  // Bin analytics for check counts (grace period)
  const { data: analyticsData } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const binCheckCounts = useMemo(() => {
    const m = new Map<string, number>();
    (analyticsData?.bins || []).forEach(b => m.set(b.id, b.check_count));
    return m;
  }, [analyticsData]);

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

  // Compute performance metrics for all templates
  const templatePerf = useMemo(() => {
    const map = new Map<string, {
      avgFill: number; activeBins: number; inactiveBins: number;
      totalBinIds: number; shiftsRun: number; avgCompletion: number;
      avgDuration: number | null; lastRunAt: number | null;
    }>();

    templates.forEach(template => {
      const binIds = template.bin_ids || [];
      const activeBins = binIds
        .map(id => bins.find(b => b.id === id))
        .filter((b): b is Bin => b !== undefined && b.status !== 'in_storage');
      // Find inactive: retired (filtered by useBins), missing, in_storage, or deleted from DB
      const inactiveCount = binIds.length - activeBins.length;

      const avgFill = activeBins.length > 0
        ? Math.round(activeBins.reduce((s, b) => s + (b.fill_percentage ?? 0), 0) / activeBins.length)
        : 0;

      const perf = perfData[template.id];

      map.set(template.id, {
        avgFill,
        activeBins: activeBins.length,
        inactiveBins: inactiveCount,
        totalBinIds: binIds.length,
        shiftsRun: perf?.shifts_completed || 0,
        avgCompletion: perf?.avg_completion_rate || 0,
        avgDuration: perf?.avg_duration_minutes ?? null,
        lastRunAt: perf?.last_run_at ?? null,
      });
    });

    return map;
  }, [templates, bins, perfData]);

  // Sort by avg fill descending (best performers first) + assign ranks
  const rankedTemplates = useMemo(() => {
    return [...templates]
      .sort((a, b) => {
        const pa = templatePerf.get(a.id);
        const pb = templatePerf.get(b.id);
        return (pb?.avgFill ?? 0) - (pa?.avgFill ?? 0);
      })
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [templates, templatePerf]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return rankedTemplates.filter(template => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!template.name.toLowerCase().includes(q) && !template.geographic_area?.toLowerCase().includes(q)) return false;
      }
      if (filterArea !== 'all' && template.geographic_area !== filterArea) return false;
      if (filterBinCount !== 'all') {
        const count = template.bin_count;
        if (filterBinCount === 'small' && count > 5) return false;
        if (filterBinCount === 'medium' && (count <= 5 || count > 15)) return false;
        if (filterBinCount === 'large' && count <= 15) return false;
      }
      if (perfFilter === 'top') {
        const p = templatePerf.get(template.id);
        if (!p || template.rank > 3) return false;
      } else if (perfFilter === 'needs-runs') {
        const p = templatePerf.get(template.id);
        if (p && p.shiftsRun > 0) return false;
      } else if (perfFilter === 'has-issues') {
        const p = templatePerf.get(template.id);
        if (!p || p.inactiveBins === 0) return false;
      }
      return true;
    });
  }, [rankedTemplates, searchQuery, filterArea, filterBinCount, perfFilter, templatePerf]);

  // Coverage gap detection
  const coverageStats = useMemo(() => {
    const coveredIds = new Set<string>();
    templates.forEach(t => (t.bin_ids || []).forEach(id => coveredIds.add(id)));
    const activeBins = bins.filter(b => b.status === 'active' || b.status === 'needs_check' || b.status === 'pending_move');
    const uncovered = activeBins.filter(b => !coveredIds.has(b.id));
    return { total: activeBins.length, covered: activeBins.length - uncovered.length, uncovered: uncovered.length };
  }, [bins, templates]);

  // Overlap detection
  const overlaps = useMemo(() => {
    const binToRoutes = new Map<string, string[]>();
    templates.forEach(t => {
      (t.bin_ids || []).forEach(id => {
        if (!binToRoutes.has(id)) binToRoutes.set(id, []);
        binToRoutes.get(id)!.push(t.name);
      });
    });
    return new Map(Array.from(binToRoutes.entries()).filter(([, routes]) => routes.length > 1));
  }, [templates]);

  // Get bins for selected template
  const selectedTemplateBins = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.bin_ids) return [];
    return bins.filter(bin => selectedTemplate.bin_ids!.includes(bin.id) && bin.status !== 'in_storage');
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

        {/* Coverage Stats */}
        {!loadingTemplates && coverageStats.total > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
            <span>{coverageStats.covered}/{coverageStats.total} bins covered</span>
            {coverageStats.uncovered > 0 && (
              <span className="text-amber-600 font-medium">{coverageStats.uncovered} not on any route</span>
            )}
            {overlaps.size > 0 && (
              <span className="text-blue-600 font-medium">{overlaps.size} on multiple routes</span>
            )}
          </div>
        )}

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

        {/* Performance Filter Chips */}
        {!loadingTemplates && templates.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-1.5 flex-wrap">
            {([
              { key: 'all' as const, label: 'All', count: templates.length },
              { key: 'top' as const, label: 'Top 3', icon: <Trophy className="w-3 h-3" />, count: Math.min(3, templates.length) },
              { key: 'needs-runs' as const, label: 'No Runs', icon: <Clock className="w-3 h-3" />, count: templates.filter(t => !perfData[t.id]?.shifts_completed).length },
              { key: 'has-issues' as const, label: 'Issues', icon: <AlertTriangle className="w-3 h-3" />, count: templates.filter(t => (templatePerf.get(t.id)?.inactiveBins ?? 0) > 0).length },
            ]).map(chip => (
              <button
                key={chip.key}
                onClick={() => setPerfFilter(chip.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
                  perfFilter === chip.key
                    ? chip.key === 'top' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : chip.key === 'has-issues' ? 'bg-red-100 text-red-700 border border-red-200'
                      : chip.key === 'needs-runs' ? 'bg-gray-200 text-gray-700 border border-gray-300'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                }`}
              >
                {chip.icon}
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
              const p = templatePerf.get(template.id);
              const fillPct = p?.avgFill ?? 0;
              const isTop3 = template.rank <= 3;
              // Green tint for high performers (high fill = good)
              const ringColor = fillPct >= 60 ? '#22c55e' : fillPct >= 35 ? '#f59e0b' : '#9ca3af';
              const circ = 113.1;
              const dashOffset = circ - (circ * Math.min(fillPct, 100) / 100);

              return (
                <div
                  key={template.id}
                  onClick={() => viewTemplateDetails(template)}
                  className={`rounded-lg border border-gray-200 transition-fast cursor-pointer ${
                    selectedTemplate?.id === template.id
                      ? 'bg-primary/5 ring-2 ring-primary/30'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Rank badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isTop3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isTop3 && template.rank === 1 ? <Trophy className="w-3.5 h-3.5" /> : `#${template.rank}`}
                    </div>

                    {/* Donut ring */}
                    <div className="relative w-10 h-10 shrink-0">
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
                        <span>{p?.inactiveBins ? `${p.activeBins}/${p.totalBinIds}` : template.bin_count} bins</span>
                        {p && p.shiftsRun > 0 && <span>· {p.shiftsRun} runs</span>}
                        {p && p.avgCompletion > 0 && <span>· {p.avgCompletion}%</span>}
                      </div>
                      {p && p.inactiveBins > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] font-medium text-amber-600">{p.inactiveBins} retired/missing</span>
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
            {/* Performance Hero */}
            {(() => {
              const p = templatePerf.get(selectedTemplate.id);
              const fill = p?.avgFill ?? selectedTemplateMetrics.avgFill;
              const rank = rankedTemplates.find(t => t.id === selectedTemplate.id)?.rank ?? 0;
              const isTop3 = rank <= 3;
              const heroBg = fill >= 60 ? 'bg-green-50' : fill >= 35 ? 'bg-amber-50' : 'bg-gray-50';
              const ringColor = fill >= 60 ? '#22c55e' : fill >= 35 ? '#f59e0b' : '#9ca3af';
              const circ = 150.8;
              const dashOff = circ - (circ * Math.min(fill, 100) / 100);
              const perf = perfData[selectedTemplate.id];

              return (
                <div className={`p-5 ${heroBg} border-b border-gray-200`}>
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isTop3 ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {rank === 1 ? <Trophy className="w-5 h-5" /> : <span className="text-sm font-bold">#{rank}</span>}
                    </div>
                    {/* Large donut */}
                    <div className="relative w-14 h-14 shrink-0">
                      <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
                        <circle cx="26" cy="26" r="24" fill="none" stroke="white" strokeWidth="4" />
                        <circle cx="26" cy="26" r="24" fill="none" stroke={ringColor} strokeWidth="4"
                          strokeDasharray={circ} strokeDashoffset={dashOff} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{fill}%</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{selectedTemplate.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedTemplate.geographic_area}</p>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <p className="text-[10px] text-gray-500">Active Bins</p>
                      <p className="text-lg font-bold text-gray-900">
                        {p?.inactiveBins ? <>{p.activeBins}<span className="text-xs text-gray-400 font-normal">/{p.totalBinIds}</span></> : selectedTemplateMetrics.totalBins}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <p className="text-[10px] text-gray-500">Avg Fill</p>
                      <p className={`text-lg font-bold ${fill >= 60 ? 'text-green-600' : fill >= 35 ? 'text-amber-600' : 'text-gray-500'}`}>{fill}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <p className="text-[10px] text-gray-500">Shifts Run</p>
                      <p className="text-lg font-bold text-gray-900">{perf?.shifts_completed ?? 0}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <p className="text-[10px] text-gray-500">Avg Completion</p>
                      <p className="text-lg font-bold text-gray-900">{perf?.avg_completion_rate ? `${perf.avg_completion_rate}%` : '—'}</p>
                    </div>
                    {perf?.avg_duration_minutes && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <p className="text-[10px] text-gray-500">Avg Duration</p>
                        <p className="text-lg font-bold text-gray-900">{Math.round(perf.avg_duration_minutes)}m</p>
                      </div>
                    )}
                    {perf?.last_run_at && (
                      <div className="bg-white rounded-lg p-2.5 shadow-sm">
                        <p className="text-[10px] text-gray-500">Last Run</p>
                        <p className="text-sm font-bold text-gray-900">{timeAgo(perf.last_run_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Inactive bins warning */}
            {(() => {
              const p = templatePerf.get(selectedTemplate.id);
              if (!p || p.inactiveBins === 0) return null;
              // Find the inactive bin IDs
              const activeBinIdSet = new Set(bins.map(b => b.id));
              const inactiveBinIds = (selectedTemplate.bin_ids || []).filter(id => !activeBinIdSet.has(id));
              const inactiveBinDetails = inactiveBinIds
                .map(id => allBinsWithRetired.find(b => b.id === id))
                .filter((b): b is Bin => b !== undefined);

              return (
                <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700">{p.inactiveBins} inactive bin{p.inactiveBins !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const activeIds = (selectedTemplate.bin_ids || []).filter(id => activeBinIdSet.has(id));
                        try {
                          await updateRoute(selectedTemplate.id, { bin_ids: activeIds });
                          await loadTemplates();
                        } catch {}
                      }}
                      className="text-[10px] font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                    >
                      Remove inactive
                    </button>
                  </div>
                  {inactiveBinDetails.map(bin => (
                    <div key={bin.id} className="flex items-center gap-2 py-1 text-xs text-gray-500">
                      <span className="font-medium">#{bin.bin_number}</span>
                      <span className="truncate">{bin.current_street}, {bin.city}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        bin.status === 'retired' ? 'bg-gray-200 text-gray-600'
                          : bin.status === 'in_storage' ? 'bg-blue-100 text-blue-600'
                          : 'bg-red-100 text-red-600'
                      }`}>{bin.status}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Active Bin List */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Active Bins ({selectedTemplateBins.length})
              </h3>
              <div className="space-y-1.5">
                {[...selectedTemplateBins].sort((a, b) => (b.fill_percentage ?? 0) - (a.fill_percentage ?? 0)).map((bin) => {
                  const pct = bin.fill_percentage ?? 0;
                  const fillColor = pct >= 60 ? 'bg-green-500' : pct >= 35 ? 'bg-amber-500' : 'bg-gray-400';
                  return (
                    <div key={bin.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-fast">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center relative overflow-hidden">
                        <div className={`absolute bottom-0 left-0 right-0 ${fillColor} transition-all`}
                          style={{ height: `${pct}%` }} />
                        <span className="relative text-[10px] font-bold text-gray-800">{bin.bin_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {bin.location_name || `${bin.current_street}, ${bin.city}`}
                        </p>
                        {overlaps.has(bin.id) && (
                          <p className="text-[9px] text-blue-500 truncate">
                            Also on: {overlaps.get(bin.id)!.filter(n => n !== selectedTemplate?.name).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(binCheckCounts.get(bin.id) ?? 0) < 5 && (
                          <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">New</span>
                        )}
                        <span className={`text-xs font-semibold ${
                          pct >= 60 ? 'text-green-600' : pct >= 35 ? 'text-amber-600' : 'text-gray-500'
                        }`}>{pct}%</span>
                      </div>
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
