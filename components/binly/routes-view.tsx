'use client';

import { useState, useRef, useEffect } from 'react';
import { Route, getRouteLabel, getRouteSchedule } from '@/lib/types/route';
import { MapPin, Clock, Package, Search, Plus, Filter, ChevronDown } from 'lucide-react';
import { BinSelectionMap } from './bin-selection-map';
import { RouteDetailsDrawer } from './route-details-drawer';
import { CreateRouteModal } from './create-route-modal';
import { useRoutes, useCreateRoute, useDeleteRoute, useDuplicateRoute } from '@/lib/hooks/use-routes';

export function RoutesView() {
  // React Query hooks
  const { data: routes = [], isLoading: loading } = useRoutes();
  const createRouteMutation = useCreateRoute();
  const deleteRouteMutation = useDeleteRoute();
  const duplicateRouteMutation = useDuplicateRoute();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showBinSelection, setShowBinSelection] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Route | null>(null);

  // Filter states
  const [areaFilter, setAreaFilter] = useState('all');
  const [scheduleFilter, setScheduleFilter] = useState('all');

  // Dropdown states
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [isScheduleDropdownOpen, setIsScheduleDropdownOpen] = useState(false);
  const [isAreaClosing, setIsAreaClosing] = useState(false);
  const [isScheduleClosing, setIsScheduleClosing] = useState(false);
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const scheduleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown with animation
  const closeAreaDropdown = () => {
    setIsAreaClosing(true);
    setTimeout(() => {
      setIsAreaDropdownOpen(false);
      setIsAreaClosing(false);
    }, 150);
  };

  const closeScheduleDropdown = () => {
    setIsScheduleClosing(true);
    setTimeout(() => {
      setIsScheduleDropdownOpen(false);
      setIsScheduleClosing(false);
    }, 150);
  };

  // Close other dropdowns when opening one
  const openAreaDropdown = () => {
    if (isScheduleDropdownOpen) closeScheduleDropdown();
    setIsAreaDropdownOpen(true);
  };

  const openScheduleDropdown = () => {
    if (isAreaDropdownOpen) closeAreaDropdown();
    setIsScheduleDropdownOpen(true);
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isAreaDropdownOpen &&
        areaDropdownRef.current &&
        !areaDropdownRef.current.contains(event.target as Node)
      ) {
        closeAreaDropdown();
      }
      if (
        isScheduleDropdownOpen &&
        scheduleDropdownRef.current &&
        !scheduleDropdownRef.current.contains(event.target as Node)
      ) {
        closeScheduleDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAreaDropdownOpen, isScheduleDropdownOpen]);

  // Filter routes
  const filteredRoutes = routes.filter(route => {
    const matchesSearch = searchQuery === '' ||
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.geographic_area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesArea = areaFilter === 'all' || route.geographic_area === areaFilter;
    const matchesSchedule = scheduleFilter === 'all' || route.schedule_pattern === scheduleFilter;

    return matchesSearch && matchesArea && matchesSchedule;
  });

  // Get unique areas and schedules for filters
  const uniqueAreas = Array.from(new Set(routes.map(r => r.geographic_area)));
  const uniqueSchedules = Array.from(new Set(routes.map(r => r.schedule_pattern).filter(Boolean))) as string[];

  // Handle Create Route button click
  const handleCreateRoute = () => {
    setIsCreating(true);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Route Blueprints</h1>
            <p className="text-gray-600 mt-1">
              Create and manage reusable route templates for efficient shift planning
            </p>
          </div>
          <button
            onClick={handleCreateRoute}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Route
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {loading ? (
            // Skeleton loaders for initial page load
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 card-shadow animate-pulse">
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                  <div className="h-8 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-4 card-shadow">
                <p className="text-sm text-gray-600 mb-1">Total Routes</p>
                <p className="text-2xl font-bold text-gray-900">{routes.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 card-shadow">
                <p className="text-sm text-gray-600 mb-1">Total Bins Covered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {routes.reduce((sum, r) => sum + r.bin_count, 0)}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 card-shadow">
                <p className="text-sm text-gray-600 mb-1">Geographic Areas</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueAreas.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 card-shadow">
                <p className="text-sm text-gray-600 mb-1">Avg. Route Duration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {routes.length > 0
                    ? (routes.reduce((sum, r) => sum + r.estimated_duration_hours, 0) / routes.length).toFixed(1)
                    : '0.0'}h
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search routes by name, area, or description..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Area Filter - Custom Dropdown */}
          <div className="relative" ref={areaDropdownRef}>
            <button
              onClick={() => isAreaDropdownOpen ? closeAreaDropdown() : openAreaDropdown()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">{areaFilter === 'all' ? 'All Areas' : areaFilter}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {isAreaDropdownOpen && (
              <div className={`absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px] z-50 ${isAreaClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
                <button
                  onClick={() => { setAreaFilter('all'); closeAreaDropdown(); }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm transition-colors ${areaFilter === 'all' ? 'bg-blue-50 text-primary font-medium' : 'text-gray-700'}`}
                >
                  All Areas
                </button>
                {uniqueAreas.map(area => (
                  <button
                    key={area}
                    onClick={() => { setAreaFilter(area); closeAreaDropdown(); }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm transition-colors ${areaFilter === area ? 'bg-blue-50 text-primary font-medium' : 'text-gray-700'}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Filter - Custom Dropdown */}
          <div className="relative" ref={scheduleDropdownRef}>
            <button
              onClick={() => isScheduleDropdownOpen ? closeScheduleDropdown() : openScheduleDropdown()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <span className="text-gray-700">{scheduleFilter === 'all' ? 'All Schedules' : scheduleFilter}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {isScheduleDropdownOpen && (
              <div className={`absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] z-50 ${isScheduleClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
                <button
                  onClick={() => { setScheduleFilter('all'); closeScheduleDropdown(); }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm transition-colors ${scheduleFilter === 'all' ? 'bg-blue-50 text-primary font-medium' : 'text-gray-700'}`}
                >
                  All Schedules
                </button>
                {uniqueSchedules.map(schedule => (
                  <button
                    key={schedule}
                    onClick={() => { setScheduleFilter(schedule); closeScheduleDropdown(); }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm transition-colors ${scheduleFilter === schedule ? 'bg-blue-50 text-primary font-medium' : 'text-gray-700'}`}
                  >
                    {schedule}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading routes...</p>
          </div>
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No routes found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || areaFilter !== 'all' || scheduleFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first route blueprint to get started'}
          </p>
          {!(searchQuery || areaFilter !== 'all' || scheduleFilter !== 'all') && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-fast"
            >
              Create Route
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onClick={() => setSelectedRoute(route)}
            />
          ))}
        </div>
      )}

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
      {selectedRoute && (
        <RouteDetailsDrawer
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
          onEdit={() => {
            setIsCreating(true);
            setSelectedRoute(null);
          }}
          onDuplicate={async () => {
            try {
              const copiedName = `${selectedRoute.name} (Copy)`;
              await duplicateRouteMutation.mutateAsync({
                routeId: selectedRoute.id,
                name: copiedName,
              });

              setSelectedRoute(null);
            } catch (error) {
              console.error('Failed to duplicate route:', error);
              alert('Failed to duplicate route. Please try again.');
            }
          }}
          onDelete={async () => {
            if (!confirm(`Are you sure you want to delete "${selectedRoute.name}"?`)) {
              return;
            }

            try {
              await deleteRouteMutation.mutateAsync(selectedRoute.id);
              setSelectedRoute(null);
            } catch (error) {
              console.error('Failed to delete route:', error);
              alert('Failed to delete route. Please try again.');
            }
          }}
        />
      )}

      {/* Bin Selection Modal */}
      {showBinSelection && (
        <BinSelectionMap
          onClose={() => setShowBinSelection(false)}
          onConfirm={(binIds) => {
            console.log('Selected bins:', binIds);
            setShowBinSelection(false);
          }}
        />
      )}
    </div>
  );
}

interface RouteCardProps {
  route: Route;
  onClick: () => void;
}

function RouteCard({ route, onClick }: RouteCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-5 card-shadow hover:card-shadow-hover transition-card cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-fast">
            {route.name}
          </h3>
          {route.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{route.description}</p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Bins</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{route.bin_count}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Duration</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{route.estimated_duration_hours}h</p>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{route.geographic_area}</span>
          </div>
          {route.schedule_pattern && (
            <span className="px-2.5 py-1 bg-blue-50 text-primary text-xs font-medium rounded-full">
              {route.schedule_pattern}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
