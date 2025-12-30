'use client';

import { useState, useRef, useEffect } from 'react';
import { Route } from '@/lib/types/route';
import { Plus, Filter, ChevronDown, Package, MapPin, Clock, Route as RouteIcon } from 'lucide-react';
import { RouteDetailsDrawer } from './route-details-drawer';
import { CreateRouteModal } from './create-route-modal';
import { RoutesMapView } from './routes-map-view';
import { RoutesSidebar } from './routes-sidebar';
import { useRoutes, useCreateRoute, useDeleteRoute, useDuplicateRoute } from '@/lib/hooks/use-routes';
import { FilterDrawer, type RouteFilters } from './filter-drawer';

export function RoutesView() {
  // React Query hooks
  const { data: routes = [], isLoading: loading } = useRoutes();
  const createRouteMutation = useCreateRoute();
  const deleteRouteMutation = useDeleteRoute();
  const duplicateRouteMutation = useDuplicateRoute();

  // Local state
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [detailsRoute, setDetailsRoute] = useState<Route | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Route | null>(null);
  const [visibleRouteIds, setVisibleRouteIds] = useState<Set<string>>(new Set());

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isFilterDrawerClosing, setIsFilterDrawerClosing] = useState(false);
  // Current filter state (updates in real-time as user adjusts filters)
  const [filters, setFilters] = useState<RouteFilters>({
    schedules: [],
    binCountMin: null,
    binCountMax: null,
    durationMin: null,
    durationMax: null,
    containsBinNumber: '',
    geographicAreas: [],
  });
  // Confirmed filters (only updates when user clicks "Show Routes")
  const [confirmedFilters, setConfirmedFilters] = useState<RouteFilters>(filters);

  // Get unique schedules and areas for filter drawer
  const uniqueSchedules = Array.from(new Set(routes.map(r => r.schedule_pattern).filter(Boolean))) as string[];
  const uniqueAreas = Array.from(new Set(routes.map(r => r.geographic_area).filter(Boolean))) as string[];

  // Filter routes for display in sidebar (uses confirmedFilters)
  const displayedRoutes = routes.filter(route => {
    // Schedule filter
    if (confirmedFilters.schedules.length > 0 && route.schedule_pattern) {
      if (!confirmedFilters.schedules.includes(route.schedule_pattern)) return false;
    }

    // Geographic area filter
    if (confirmedFilters.geographicAreas.length > 0 && route.geographic_area) {
      if (!confirmedFilters.geographicAreas.includes(route.geographic_area)) return false;
    }

    // Bin count filter
    if (confirmedFilters.binCountMin !== null && route.bin_count < confirmedFilters.binCountMin) return false;
    if (confirmedFilters.binCountMax !== null && route.bin_count > confirmedFilters.binCountMax) return false;

    // Duration filter
    if (confirmedFilters.durationMin !== null && route.estimated_duration_hours < confirmedFilters.durationMin) return false;
    if (confirmedFilters.durationMax !== null && route.estimated_duration_hours > confirmedFilters.durationMax) return false;

    // Contains bin filter (would need bin data to implement properly)
    if (confirmedFilters.containsBinNumber) {
      // This would need to check if the route contains a bin with this number
      // Placeholder: always pass for now
    }

    return true;
  });

  // Filter routes for count calculation (uses current filters for real-time feedback)
  const filteredRoutes = routes.filter(route => {
    // Schedule filter
    if (filters.schedules.length > 0 && route.schedule_pattern) {
      if (!filters.schedules.includes(route.schedule_pattern)) return false;
    }

    // Geographic area filter
    if (filters.geographicAreas.length > 0 && route.geographic_area) {
      if (!filters.geographicAreas.includes(route.geographic_area)) return false;
    }

    // Bin count filter
    if (filters.binCountMin !== null && route.bin_count < filters.binCountMin) return false;
    if (filters.binCountMax !== null && route.bin_count > filters.binCountMax) return false;

    // Duration filter
    if (filters.durationMin !== null && route.estimated_duration_hours < filters.durationMin) return false;
    if (filters.durationMax !== null && route.estimated_duration_hours > filters.durationMax) return false;

    // Contains bin filter (would need bin data to implement properly)
    // For now, we'll skip this as it requires bin numbers array in route
    if (filters.containsBinNumber) {
      // This would need to check if the route contains a bin with this number
      // Placeholder: always pass for now
    }

    return true;
  });

  // Count active filters
  const activeFilterCount =
    filters.schedules.length +
    filters.geographicAreas.length +
    (filters.binCountMin !== null ? 1 : 0) +
    (filters.binCountMax !== null ? 1 : 0) +
    (filters.durationMin !== null ? 1 : 0) +
    (filters.durationMax !== null ? 1 : 0) +
    (filters.containsBinNumber ? 1 : 0);

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      schedules: [],
      binCountMin: null,
      binCountMax: null,
      durationMin: null,
      durationMax: null,
      containsBinNumber: '',
      geographicAreas: [],
    });
  };

  // Handle Create Route button click
  const handleCreateRoute = () => {
    setIsCreating(true);
  };

  // Handle route selection - toggle visibility
  const handleRouteSelect = (route: Route) => {
    setVisibleRouteIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(route.id)) {
        // Route already visible - remove it (toggle off)
        newSet.delete(route.id);
        // If we're removing the selected route, deselect it
        if (selectedRoute?.id === route.id) {
          setSelectedRoute(null);
        }
      } else {
        // Route not visible - add it (toggle on)
        newSet.add(route.id);
        setSelectedRoute(route);
      }
      return newSet;
    });
  };

  // Show all routes at once
  const handleShowAllRoutes = () => {
    const allRouteIds = new Set(displayedRoutes.map(r => r.id));
    setVisibleRouteIds(allRouteIds);
  };

  // Clear all visible routes
  const handleClearAllRoutes = () => {
    setVisibleRouteIds(new Set());
    setSelectedRoute(null);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Routes</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* KPI Stats - Cards with Icons */}
            {!loading && (
              <div className="flex items-center gap-3 mr-6">
                {/* Total Routes */}
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <RouteIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Total Routes</p>
                      <p className="text-lg font-bold text-gray-900">{routes.length}</p>
                    </div>
                  </div>
                </div>

                {/* Total Bins Covered */}
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Package className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Bins Covered</p>
                      <p className="text-lg font-bold text-gray-900">
                        {routes.reduce((sum, r) => sum + r.bin_count, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Avg. Route Duration */}
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Avg. Duration</p>
                      <p className="text-lg font-bold text-gray-900">
                        {routes.length > 0
                          ? (routes.reduce((sum, r) => sum + r.estimated_duration_hours, 0) / routes.length).toFixed(1)
                          : '0.0'}h
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Button */}
            <button
              onClick={() => {
                if (isFilterDrawerOpen) {
                  // Trigger closing animation
                  setIsFilterDrawerClosing(true);
                  setTimeout(() => {
                    setConfirmedFilters(filters);
                    setIsFilterDrawerOpen(false);
                    setIsFilterDrawerClosing(false);
                  }, 300);
                } else {
                  setIsFilterDrawerOpen(true);
                }
              }}
              className="relative px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Filter</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Create Button */}
            <button
              onClick={handleCreateRoute}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Route
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Sidebar + Map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Routes List */}
        {loading ? (
          <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">Loading routes...</p>
            </div>
          </div>
        ) : (
          <RoutesSidebar
            routes={displayedRoutes}
            selectedRouteId={selectedRoute?.id}
            visibleRouteIds={visibleRouteIds}
            onRouteSelect={handleRouteSelect}
            onViewDetails={setDetailsRoute}
            onRouteHover={setHoveredRouteId}
            onShowAll={handleShowAllRoutes}
            onClearAll={handleClearAllRoutes}
          />
        )}

        {/* Map View - Full Height */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-600">Loading routes map...</p>
              </div>
            </div>
          ) : (
            <RoutesMapView
              routes={displayedRoutes}
              visibleRouteIds={visibleRouteIds}
              onRouteSelect={handleRouteSelect}
              onViewDetails={setDetailsRoute}
              selectedRouteId={selectedRoute?.id}
            />
          )}

          {/* Filter Drawer - Rendered inside map container */}
          <FilterDrawer
            isOpen={isFilterDrawerOpen}
            onClose={() => {
              // Confirm filters when closing (clicking "Show Routes" button)
              setConfirmedFilters(filters);
              setIsFilterDrawerOpen(false);
            }}
            filters={filters}
            onFiltersChange={setFilters}
            onClearAll={handleClearFilters}
            matchingRoutesCount={filteredRoutes.length}
            availableSchedules={uniqueSchedules}
            availableAreas={uniqueAreas}
            isExternalClosing={isFilterDrawerClosing}
          />
        </div>
      </div>

      {/* Create/Edit Route Modal */}
      {isCreating && (
        <CreateRouteModal
          existingRoutes={routes}
          onClose={() => {
            setIsCreating(false);
            setDuplicateSource(null);
          }}
          onSubmit={async (routeData) => {
            try {
              await createRouteMutation.mutateAsync({
                name: routeData.name!,
                description: routeData.description,
                geographic_area: routeData.geographic_area!,
                schedule_pattern: routeData.schedule_pattern,
                bin_ids: routeData.bin_ids!,
                estimated_duration_hours: routeData.estimated_duration_hours,
              });

              setIsCreating(false);
              setDuplicateSource(null);
            } catch (error) {
              console.error('Failed to create route:', error);
              alert('Failed to create route. Please try again.');
            }
          }}
          editRoute={duplicateSource}
        />
      )}

      {/* Route Details Drawer */}
      {detailsRoute && (
        <RouteDetailsDrawer
          route={detailsRoute}
          onClose={() => setDetailsRoute(null)}
          onEdit={() => {
            setIsCreating(true);
            setDetailsRoute(null);
          }}
          onDuplicate={async () => {
            try {
              const copiedName = `${detailsRoute.name} (Copy)`;
              await duplicateRouteMutation.mutateAsync({
                routeId: detailsRoute.id,
                name: copiedName,
              });

              setDetailsRoute(null);
            } catch (error) {
              console.error('Failed to duplicate route:', error);
              alert('Failed to duplicate route. Please try again.');
            }
          }}
          onDelete={async () => {
            if (!confirm(`Are you sure you want to delete "${detailsRoute.name}"?`)) {
              return;
            }

            try {
              await deleteRouteMutation.mutateAsync(detailsRoute.id);
              setDetailsRoute(null);
            } catch (error) {
              console.error('Failed to delete route:', error);
              alert('Failed to delete route. Please try again.');
            }
          }}
        />
      )}

    </div>
  );
}
