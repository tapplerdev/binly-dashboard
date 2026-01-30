'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, List, User, X, Search, ChevronDown, Filter, MapPin, Loader2, Trash2, GripVertical, Package, MapPinned, Warehouse, MoveRight, Plus, Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel, ShiftStatus } from '@/lib/types/shift';
import { ShiftDetailsDrawer } from './shift-details-drawer';
import { BinSelectionMap } from './bin-selection-map';
import { MoveRequestSelectionMap } from './move-request-selection-map';
import { PlacementLocationSelectionMap } from './placement-location-selection-map';
import { RouteSelectionMap } from './route-selection-map';
import { Route, getRouteLabel } from '@/lib/types/route';
import { Bin } from '@/lib/types/bin';
import { getBins } from '@/lib/api/bins';
import { getShifts, getShiftTasks } from '@/lib/api/shifts';
import { PotentialLocation, getPotentialLocations } from '@/lib/api/potential-locations';
import { MoveRequest, getMoveRequests } from '@/lib/api/move-requests';
import { useShifts, useAssignRoute } from '@/lib/hooks/use-shifts';
import { useRoutes } from '@/lib/hooks/use-routes';
import { useActiveDrivers } from '@/lib/hooks/use-active-drivers';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { ActiveDriver } from '@/lib/types/active-driver';
import { LiveOpsMap } from './live-ops-map';
import { useAuthStore } from '@/lib/auth/store';

type ViewMode = 'list' | 'timeline' | 'live';

interface ShiftFilters {
  searchQuery: string;
  dateRange: 'this-week' | 'next-week' | 'last-week' | 'all';
  drivers: string[];
  statuses: ShiftStatus[];
  routes: string[];
}

export function ShiftsView() {
  // React Query hooks
  const { data: shifts = [], isLoading: loadingShifts } = useShifts();
  const assignRouteMutation = useAssignRoute();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [filters, setFilters] = useState<ShiftFilters>({
    searchQuery: '',
    dateRange: 'this-week',
    drivers: [],
    statuses: [],
    routes: [],
  });

  const listButtonRef = useRef<HTMLButtonElement>(null);
  const timelineButtonRef = useRef<HTMLButtonElement>(null);
  const liveButtonRef = useRef<HTMLButtonElement>(null);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  const lastWeekRef = useRef<HTMLButtonElement>(null);
  const thisWeekRef = useRef<HTMLButtonElement>(null);
  const nextWeekRef = useRef<HTMLButtonElement>(null);
  const [dateSliderStyle, setDateSliderStyle] = useState({ left: 0, width: 0 });

  // Update slider position when view mode changes
  useEffect(() => {
    const updateSlider = () => {
      const button =
        viewMode === 'live' ? liveButtonRef.current :
        viewMode === 'list' ? listButtonRef.current :
        timelineButtonRef.current;
      if (button) {
        setSliderStyle({
          left: button.offsetLeft,
          width: button.offsetWidth,
        });
      }
    };
    updateSlider();
  }, [viewMode]);

  // Update date slider position when date range changes
  useEffect(() => {
    const updateDateSlider = () => {
      let button = null;
      if (filters.dateRange === 'last-week') button = lastWeekRef.current;
      else if (filters.dateRange === 'this-week') button = thisWeekRef.current;
      else if (filters.dateRange === 'next-week') button = nextWeekRef.current;

      if (button) {
        setDateSliderStyle({
          left: button.offsetLeft,
          width: button.offsetWidth,
        });
      }
    };
    updateDateSlider();
  }, [filters.dateRange]);

  // Get unique drivers and routes from loaded shifts
  const availableDrivers = Array.from(new Set(shifts.map(s => s.driverName)));
  const availableRoutes = Array.from(new Set(shifts.map(s => s.route)));

  // Helper function to get week range for date filtering
  const getWeekRange = (dateRange: 'this-week' | 'next-week' | 'last-week' | 'all') => {
    const today = new Date(); // Current date
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() + mondayOffset);

    const thisWeekSunday = new Date(thisWeekMonday);
    thisWeekSunday.setDate(thisWeekMonday.getDate() + 6);

    if (dateRange === 'this-week') {
      return { start: thisWeekMonday, end: thisWeekSunday };
    } else if (dateRange === 'next-week') {
      const nextWeekMonday = new Date(thisWeekMonday);
      nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);
      const nextWeekSunday = new Date(nextWeekMonday);
      nextWeekSunday.setDate(nextWeekMonday.getDate() + 6);
      return { start: nextWeekMonday, end: nextWeekSunday };
    } else if (dateRange === 'last-week') {
      const lastWeekMonday = new Date(thisWeekMonday);
      lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
      const lastWeekSunday = new Date(lastWeekMonday);
      lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
      return { start: lastWeekMonday, end: lastWeekSunday };
    }
    return null; // 'all' - no filtering
  };

  // Filter shifts based on active filters
  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      // Date range filter
      if (filters.dateRange !== 'all') {
        const weekRange = getWeekRange(filters.dateRange);
        if (weekRange) {
          const shiftDate = new Date(shift.date);
          if (shiftDate < weekRange.start || shiftDate > weekRange.end) {
            return false;
          }
        }
      }

      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSearch =
          shift.driverName.toLowerCase().includes(query) ||
          shift.route.toLowerCase().includes(query) ||
          shift.binCount.toString().includes(query);
        if (!matchesSearch) return false;
      }

      // Driver filter
      if (filters.drivers.length > 0 && !filters.drivers.includes(shift.driverName)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(shift.status)) {
        return false;
      }

      // Route filter
      if (filters.routes.length > 0 && !filters.routes.includes(shift.route)) {
        return false;
      }

      return true;
    });
  }, [shifts, filters]);

  // Count active filters
  const activeFilterCount =
    (filters.drivers.length > 0 ? 1 : 0) +
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.routes.length > 0 ? 1 : 0) +
    (filters.searchQuery ? 1 : 0);

  const clearAllFilters = () => {
    setFilters({
      searchQuery: '',
      dateRange: 'this-week',
      drivers: [],
      statuses: [],
      routes: [],
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-3 md:p-6">
          {/* Header & Filters - Always centered with max-width */}
          <div className="max-w-6xl mx-auto mb-4 md:mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Shifts</h1>
              {viewMode !== 'live' && (
                <button
                  onClick={() => setIsCreateDrawerOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-fast shadow-sm"
                >
                  <span className="hidden sm:inline">Create Shift</span>
                  <span className="sm:hidden">Create</span>
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-center mb-4">
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg p-1 relative">
                {/* Sliding background */}
                <div
                  className="absolute bg-white rounded-md shadow-sm transition-all duration-200 ease-in-out"
                  style={{
                    left: `${sliderStyle.left}px`,
                    width: `${sliderStyle.width}px`,
                    top: '4px',
                    bottom: '4px',
                  }}
                />
                <button
                  ref={liveButtonRef}
                  onClick={() => setViewMode('live')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-fast relative z-10 ${
                    viewMode === 'live'
                      ? 'text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Live Map
                </button>
                <button
                  ref={listButtonRef}
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-fast relative z-10 ${
                    viewMode === 'list'
                      ? 'text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
                <button
                  ref={timelineButtonRef}
                  onClick={() => setViewMode('timeline')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-fast relative z-10 ${
                    viewMode === 'timeline'
                      ? 'text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>

            {/* Filter Bar - Hidden in Live Ops mode */}
            {viewMode !== 'live' && (
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                availableDrivers={availableDrivers}
                availableRoutes={availableRoutes}
                activeFilterCount={activeFilterCount}
                onClearAll={clearAllFilters}
                lastWeekRef={lastWeekRef}
                thisWeekRef={thisWeekRef}
                nextWeekRef={nextWeekRef}
                dateSliderStyle={dateSliderStyle}
              />
            )}

          </div>

          {/* View Content - Different widths per view */}
          {loadingShifts ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'list' ? (
            <div className="max-w-4xl mx-auto">
              <ShiftsListView shifts={filteredShifts} onShiftClick={setSelectedShift} />
            </div>
          ) : viewMode === 'timeline' ? (
            <ShiftsTimelineView shifts={filteredShifts} onShiftClick={setSelectedShift} />
          ) : (
            <LiveOpsView shifts={shifts} />
          )}
        </div>
      </div>

      {/* Create Shift Drawer */}
      {isCreateDrawerOpen && (
        <CreateShiftDrawer
          onClose={() => setIsCreateDrawerOpen(false)}
        />
      )}

      {/* Shift Details Drawer */}
      {selectedShift && (
        <ShiftDetailsDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

// Filter Bar Component
function FilterBar({
  filters,
  setFilters,
  availableDrivers,
  availableRoutes,
  activeFilterCount,
  onClearAll,
  lastWeekRef,
  thisWeekRef,
  nextWeekRef,
  dateSliderStyle,
}: {
  filters: ShiftFilters;
  setFilters: React.Dispatch<React.SetStateAction<ShiftFilters>>;
  availableDrivers: string[];
  availableRoutes: string[];
  activeFilterCount: number;
  onClearAll: () => void;
  lastWeekRef: React.RefObject<HTMLButtonElement | null>;
  thisWeekRef: React.RefObject<HTMLButtonElement | null>;
  nextWeekRef: React.RefObject<HTMLButtonElement | null>;
  dateSliderStyle: { left: number; width: number };
}) {
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);

  const [isDriverClosing, setIsDriverClosing] = useState(false);
  const [isStatusClosing, setIsStatusClosing] = useState(false);
  const [isRouteClosing, setIsRouteClosing] = useState(false);

  const driverRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLDivElement>(null);

  const allStatuses: ShiftStatus[] = ['scheduled', 'active', 'completed', 'cancelled'];

  // Close dropdown with animation
  const closeDriverDropdown = () => {
    setIsDriverClosing(true);
    setTimeout(() => {
      setIsDriverDropdownOpen(false);
      setIsDriverClosing(false);
    }, 150);
  };

  const closeStatusDropdown = () => {
    setIsStatusClosing(true);
    setTimeout(() => {
      setIsStatusDropdownOpen(false);
      setIsStatusClosing(false);
    }, 150);
  };

  const closeRouteDropdown = () => {
    setIsRouteClosing(true);
    setTimeout(() => {
      setIsRouteDropdownOpen(false);
      setIsRouteClosing(false);
    }, 150);
  };

  // Close other dropdowns when opening one
  const openDriverDropdown = () => {
    if (isStatusDropdownOpen) closeStatusDropdown();
    if (isRouteDropdownOpen) closeRouteDropdown();
    setIsDriverDropdownOpen(true);
  };

  const openStatusDropdown = () => {
    if (isDriverDropdownOpen) closeDriverDropdown();
    if (isRouteDropdownOpen) closeRouteDropdown();
    setIsStatusDropdownOpen(true);
  };

  const openRouteDropdown = () => {
    if (isDriverDropdownOpen) closeDriverDropdown();
    if (isStatusDropdownOpen) closeStatusDropdown();
    setIsRouteDropdownOpen(true);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDriverDropdownOpen &&
        driverRef.current &&
        !driverRef.current.contains(event.target as Node)
      ) {
        closeDriverDropdown();
      }
      if (
        isStatusDropdownOpen &&
        statusRef.current &&
        !statusRef.current.contains(event.target as Node)
      ) {
        closeStatusDropdown();
      }
      if (
        isRouteDropdownOpen &&
        routeRef.current &&
        !routeRef.current.contains(event.target as Node)
      ) {
        closeRouteDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDriverDropdownOpen, isStatusDropdownOpen, isRouteDropdownOpen]);

  const toggleDriver = (driver: string) => {
    setFilters(prev => ({
      ...prev,
      drivers: prev.drivers.includes(driver)
        ? prev.drivers.filter(d => d !== driver)
        : [...prev.drivers, driver]
    }));
  };

  const toggleStatus = (status: ShiftStatus) => {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status]
    }));
  };

  const toggleRoute = (route: string) => {
    setFilters(prev => ({
      ...prev,
      routes: prev.routes.includes(route)
        ? prev.routes.filter(r => r !== route)
        : [...prev.routes, route]
    }));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4 mb-4 md:mb-6">
      <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-2 md:gap-3 mb-3">
        {/* Search Input */}
        <div className="relative w-full md:w-auto md:flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shifts, drivers, routes..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            onFocus={() => {
              if (isDriverDropdownOpen) closeDriverDropdown();
              if (isStatusDropdownOpen) closeStatusDropdown();
              if (isRouteDropdownOpen) closeRouteDropdown();
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-fast"
          />
        </div>

        {/* Filters Row - Horizontal scroll on mobile */}
        <div className="w-full md:w-auto flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide">
          {/* Date Range Toggle */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200 relative shrink-0">
            {/* Sliding background */}
            <div
              className="absolute bg-white rounded-md shadow-sm transition-all duration-200 ease-in-out"
              style={{
                left: `${dateSliderStyle.left}px`,
                width: `${dateSliderStyle.width}px`,
                top: '4px',
                bottom: '4px',
              }}
            />
            <button
              ref={lastWeekRef}
              onClick={() => {
                setFilters(prev => ({ ...prev, dateRange: 'last-week' }));
                if (isDriverDropdownOpen) closeDriverDropdown();
                if (isStatusDropdownOpen) closeStatusDropdown();
                if (isRouteDropdownOpen) closeRouteDropdown();
              }}
              className={`px-2 md:px-3 py-1.5 rounded text-[11px] md:text-xs font-medium transition-fast relative z-10 whitespace-nowrap ${
                filters.dateRange === 'last-week'
                  ? 'text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Last Week
            </button>
            <button
              ref={thisWeekRef}
              onClick={() => {
                setFilters(prev => ({ ...prev, dateRange: 'this-week' }));
                if (isDriverDropdownOpen) closeDriverDropdown();
                if (isStatusDropdownOpen) closeStatusDropdown();
                if (isRouteDropdownOpen) closeRouteDropdown();
              }}
              className={`px-2 md:px-3 py-1.5 rounded text-[11px] md:text-xs font-medium transition-fast relative z-10 whitespace-nowrap ${
                filters.dateRange === 'this-week'
                  ? 'text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Week
            </button>
            <button
              ref={nextWeekRef}
              onClick={() => {
                setFilters(prev => ({ ...prev, dateRange: 'next-week' }));
                if (isDriverDropdownOpen) closeDriverDropdown();
                if (isStatusDropdownOpen) closeStatusDropdown();
                if (isRouteDropdownOpen) closeRouteDropdown();
              }}
              className={`px-2 md:px-3 py-1.5 rounded text-[11px] md:text-xs font-medium transition-fast relative z-10 whitespace-nowrap ${
                filters.dateRange === 'next-week'
                  ? 'text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Next Week
            </button>
          </div>

          {/* Driver Filter */}
          <div className="relative shrink-0" ref={driverRef}>
            <button
              onClick={() => isDriverDropdownOpen ? closeDriverDropdown() : openDriverDropdown()}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 border border-gray-200 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-fast whitespace-nowrap"
            >
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">Driver</span>
            {filters.drivers.length > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filters.drivers.length}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {isDriverDropdownOpen && (
            <div className={`absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] z-50 ${isDriverClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
              {availableDrivers.map(driver => (
                <label key={driver} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.drivers.includes(driver)}
                    onChange={() => toggleDriver(driver)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{driver}</span>
                </label>
              ))}
            </div>
          )}
          </div>

          {/* Status Filter */}
          <div className="relative shrink-0" ref={statusRef}>
            <button
              onClick={() => isStatusDropdownOpen ? closeStatusDropdown() : openStatusDropdown()}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 border border-gray-200 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-fast whitespace-nowrap"
            >
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">Status</span>
            {filters.statuses.length > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filters.statuses.length}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {isStatusDropdownOpen && (
            <div className={`absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px] z-50 ${isStatusClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
              {allStatuses.map(status => (
                <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm capitalize">{getShiftStatusLabel(status)}</span>
                </label>
              ))}
            </div>
          )}
          </div>

          {/* Route Filter */}
          <div className="relative shrink-0" ref={routeRef}>
            <button
              onClick={() => isRouteDropdownOpen ? closeRouteDropdown() : openRouteDropdown()}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 border border-gray-200 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-fast whitespace-nowrap"
            >
            <span className="text-gray-700">Route</span>
            {filters.routes.length > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filters.routes.length}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {isRouteDropdownOpen && (
            <div className={`absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[220px] z-50 ${isRouteClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
              {availableRoutes.map(route => (
                <label key={route} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.routes.includes(route)}
                    onChange={() => toggleRoute(route)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{route}</span>
                </label>
              ))}
            </div>
          )}
          </div>

          {/* Clear All - Inside scroll container on mobile */}
          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs md:text-sm text-gray-500 hover:text-gray-700 font-medium shrink-0 md:ml-auto transition-fast"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          {filters.drivers.map(driver => (
            <div key={driver} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <span>Driver: {driver}</span>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    drivers: prev.drivers.filter(d => d !== driver)
                  }));
                }}
                className="hover:bg-green-200 rounded-full p-0.5 transition-fast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filters.statuses.map(status => (
            <div key={status} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              <span>Status: {getShiftStatusLabel(status)}</span>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    statuses: prev.statuses.filter(s => s !== status)
                  }));
                }}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-fast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filters.routes.map(route => (
            <div key={route} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <span>Route: {route.split(' - ')[0]}</span>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    routes: prev.routes.filter(r => r !== route)
                  }));
                }}
                className="hover:bg-purple-200 rounded-full p-0.5 transition-fast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filters.searchQuery && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              <span>Search: &ldquo;{filters.searchQuery}&rdquo;</span>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    searchQuery: ''
                  }));
                }}
                className="hover:bg-gray-200 rounded-full p-0.5 transition-fast"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// List View Component
function ShiftsListView({ shifts, onShiftClick }: { shifts: Shift[]; onShiftClick: (shift: Shift) => void }) {
  // Group shifts by date
  const groupedShifts = shifts.reduce((acc, shift) => {
    if (!acc[shift.date]) {
      acc[shift.date] = [];
    }
    acc[shift.date].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  const sortedDates = Object.keys(groupedShifts).sort();

  // Get today's date in YYYY-MM-DD format (local timezone)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Helper to format date label
  const getDateLabel = (dateStr: string) => {
    // Direct string comparison for today
    if (dateStr === todayStr) {
      return 'Today';
    }

    // Calculate tomorrow and yesterday
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    }
    if (dateStr === yesterdayStr) {
      return 'Yesterday';
    }

    // Format as "Mon, Jan 1"
    const shiftDate = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
    return shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      {sortedDates.map((date) => {
        const shifts = groupedShifts[date];
        const activeShifts = shifts.filter((s) => s.status === 'active').length;
        const totalBins = shifts.reduce((sum, s) => sum + s.binCount, 0);

        return (
          <div key={date}>
            {/* Date Header */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {getDateLabel(date)} · {activeShifts} Active Shift
                {activeShifts !== 1 ? 's' : ''} · {totalBins} Bins Total
              </h2>
            </div>

            {/* Shift Cards */}
            <div className="space-y-3">
              {shifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} onClick={() => onShiftClick(shift)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Shift Card Component
function ShiftCard({ shift, onClick }: { shift: Shift; onClick: () => void }) {
  const statusColor = getShiftStatusColor(shift.status);
  const statusLabel = getShiftStatusLabel(shift.status);
  const isActive = shift.status === 'active';

  const progressPercentage = isActive && shift.binsCollected
    ? Math.round((shift.binsCollected / shift.binCount) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 transition-all cursor-pointer ${
        isActive
          ? 'border-0 hover:shadow-md relative overflow-hidden'
          : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-sm'
      }`}
      style={isActive ? {
        background: 'linear-gradient(90deg, rgba(22, 163, 74, 0.95) 0%, rgba(34, 197, 94, 0.85) 50%, rgba(202, 138, 4, 0.75) 100%)',
        boxShadow: '0 0 25px rgba(22, 163, 74, 0.5), 0 4px 6px -1px rgb(0 0 0 / 0.1)'
      } : {}}
    >
      <div className="flex items-center gap-4">
        {/* Time */}
        <div className={`flex-shrink-0 text-sm font-medium ${isActive ? 'text-white' : 'text-gray-900'}`}>
          {shift.startTime} - {shift.endTime}
        </div>

        {/* Route */}
        <div className={`flex-shrink-0 text-sm ${isActive ? 'text-white' : 'text-gray-600'}`}>
          {shift.route}
        </div>

        {/* Driver */}
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-gray-200'}`}>
            <User className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
          </div>
          <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-gray-700'}`}>{shift.driverName}</span>
        </div>

        {/* Bin Count / Progress */}
        <div className={`flex-shrink-0 text-sm ${isActive ? 'text-white font-medium' : 'text-gray-600'}`}>
          {isActive && shift.binsCollected !== undefined
            ? `${shift.binsCollected}/${shift.binCount} Bins (${progressPercentage}%)`
            : `${shift.binCount} Bins`}
        </div>

        {/* Status Badge */}
        <div className="ml-auto">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isActive ? 'bg-green-600 text-white' : statusColor
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// Timeline View Component
function ShiftsTimelineView({ shifts, onShiftClick }: { shifts: Shift[]; onShiftClick: (shift: Shift) => void }) {
  const [timeScale, setTimeScale] = useState<'week' | 'today'>('week');

  // Generate week dates for this week (Dec 29 2025 - Jan 4 2026)
  // Jan 1, 2026 is a Thursday, so the week is Mon Dec 29 - Sun Jan 4
  const weekDates = [
    { day: 'Mon', date: 29, fullDate: '2025-12-29' },
    { day: 'Tue', date: 30, fullDate: '2025-12-30' },
    { day: 'Wed', date: 31, fullDate: '2025-12-31' },
    { day: 'Thu', date: 1, fullDate: '2026-01-01' },  // Today
    { day: 'Fri', date: 2, fullDate: '2026-01-02' },
    { day: 'Sat', date: 3, fullDate: '2026-01-03' },
    { day: 'Sun', date: 4, fullDate: '2026-01-04' },
  ];

  // Get unique drivers from filtered shifts
  const drivers = Array.from(new Set(shifts.map((s) => s.driverName))).map(
    (name) => ({
      name,
      id: shifts.find((s) => s.driverName === name)?.driverId || '',
    })
  );

  // Group shifts by driver and date
  const shiftsByDriverAndDate = shifts.reduce((acc, shift) => {
    const dateNum = parseInt(shift.date.split('-')[2]);
    const key = `${shift.driverId}-${dateNum}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  return (
    <div className="space-y-6">
      {/* Week/Today Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTimeScale('week')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-fast ${
              timeScale === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Week View
          </button>
          <button
            onClick={() => setTimeScale('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-fast ${
              timeScale === 'today'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today View
          </button>
        </div>
      </div>

      {/* Render appropriate view */}
      {timeScale === 'week' ? (
        <WeeklyTimeline shifts={shifts} weekDates={weekDates} drivers={drivers} onShiftClick={onShiftClick} />
      ) : (
        <DailyGantt shifts={shifts} drivers={drivers} onShiftClick={onShiftClick} />
      )}
    </div>
  );
}

// Weekly Timeline Component (existing weekly view)
function WeeklyTimeline({
  shifts,
  weekDates,
  drivers,
  onShiftClick
}: {
  shifts: Shift[];
  weekDates: { day: string; date: number; fullDate: string }[];
  drivers: { name: string; id: string }[];
  onShiftClick: (shift: Shift) => void;
}) {
  // Group shifts by driver and full date
  const shiftsByDriverAndDate = shifts.reduce((acc, shift) => {
    const key = `${shift.driverId}-${shift.date}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  return (
    <div className="overflow-x-auto pb-6">
      <table className="w-full" style={{ minWidth: '1600px', borderCollapse: 'collapse' }}>
          {/* Table Header */}
          <thead>
            <tr>
              <th style={{ width: '180px', padding: '16px 20px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                Driver
              </th>
              {weekDates.map((d) => (
                <th
                  key={d.date}
                  style={{ width: '200px', padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#111827', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                >
                  <div>{d.day}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400 }}>{d.date}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                {/* Driver Name Cell */}
                <td style={{ padding: '20px', verticalAlign: 'top', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                      {driver.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {driver.name}
                    </span>
                  </div>
                </td>

                {/* Day Cells */}
                {weekDates.map((d) => {
                  const shifts = shiftsByDriverAndDate[`${driver.id}-${d.fullDate}`] || [];
                  return (
                    <td
                      key={d.fullDate}
                      style={{
                        padding: '12px',
                        verticalAlign: 'top',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        minHeight: '120px'
                      }}
                      className="hover:bg-gray-50 transition-fast"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px' }}>
                        {shifts.length > 0 ? (
                          shifts.map((shift) => (
                            <TimelineShiftBlock key={shift.id} shift={shift} onClick={() => onShiftClick(shift)} />
                          ))
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

// Timeline Shift Block Component
function TimelineShiftBlock({ shift, onClick }: { shift: Shift; onClick: () => void }) {
  const isActive = shift.status === 'active';
  const isCompleted = shift.status === 'completed';
  const isScheduled = shift.status === 'scheduled';

  const bgColor = isActive
    ? '#3b82f6' // blue-500
    : isCompleted
    ? '#9ca3af' // gray-400
    : '#60a5fa'; // blue-400

  const progressPercentage = isActive && shift.binsCollected
    ? Math.round((shift.binsCollected / shift.binCount) * 100)
    : 0;

  // Extract route number from route string (e.g., "Route 2 - Central" -> "2")
  const routeNumber = shift.route.match(/Route (\d+)/)?.[1] || shift.route.split(' ')[1];

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive
          ? 'linear-gradient(90deg, rgba(22, 163, 74, 0.95) 0%, rgba(34, 197, 94, 0.85) 50%, rgba(202, 138, 4, 0.75) 100%)'
          : bgColor,
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#ffffff',
        cursor: 'pointer',
        fontSize: '11.5px',
        transition: 'all 0.2s ease-in-out',
        boxShadow: isActive
          ? '0 0 25px rgba(22, 163, 74, 0.5), 0 4px 6px -1px rgb(0 0 0 / 0.2)'
          : '0 1px 3px rgba(0,0,0,0.1)',
        width: '100%'
      }}
      className="hover:shadow-md hover:scale-[1.02]"
      title={`${shift.route} - ${shift.binCount} bins`}
    >
      <div style={{ fontWeight: 600, marginBottom: isActive ? '4px' : '0' }}>
        {isActive && `8a-4p · Route ${routeNumber} (${shift.binCount} Bins)`}
        {isCompleted && `Done · ${shift.binCount} Bins (${shift.totalWeight || 0}kg)`}
        {isScheduled && `8a-4p · Route ${routeNumber} (${shift.binCount} Bins)`}
      </div>
      {isActive && (
        <div style={{ fontSize: '10px', opacity: 0.9 }}>
          Active · {shift.binsCollected}/{shift.binCount} ({progressPercentage}%)
        </div>
      )}
    </div>
  );
}

// Daily Gantt Component - Hourly view for today's operations
function DailyGantt({
  shifts,
  drivers,
  onShiftClick
}: {
  shifts: Shift[];
  drivers: { name: string; id: string }[];
  onShiftClick: (shift: Shift) => void;
}) {
  // Filter only today's shifts - get actual current date
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayShifts = shifts.filter(shift => shift.date === today);

  // Hour columns: 6 AM to 6 PM (12 hours)
  const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 6, 7, 8, ..., 18

  // Helper: Convert time string "8:36 PM" or "08:00" to hour number (with decimals for minutes)
  const timeToHour = (timeStr: string): number => {
    // Handle 12-hour format (e.g., "8:36 PM")
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const isPM = timeStr.includes('PM');
      const [time] = timeStr.split(' ');
      const [hourStr, minStr] = time.split(':');
      let hour = parseInt(hourStr);
      const minutes = parseInt(minStr) || 0;

      // Convert to 24-hour format
      if (isPM && hour !== 12) {
        hour += 12;
      } else if (!isPM && hour === 12) {
        hour = 0;
      }

      // Return hour with decimal for minutes (e.g., 8:30 = 8.5)
      return hour + minutes / 60;
    }

    // Handle 24-hour format (e.g., "08:00")
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr);
    const minutes = parseInt(minStr) || 0;
    return hour + minutes / 60;
  };

  // Helper: Calculate shift position and width
  const getShiftStyle = (shift: Shift) => {
    const startHour = timeToHour(shift.startTime);
    const endHour = timeToHour(shift.endTime);

    // Position from left (relative to 6 AM)
    const left = ((startHour - 6) / 12) * 100;

    // Width based on duration
    const width = ((endHour - startHour) / 12) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="overflow-x-auto pb-6">
      <table className="w-full" style={{ minWidth: '1400px', borderCollapse: 'collapse' }}>
        {/* Table Header - Hourly Time Axis */}
        <thead>
          <tr>
            <th style={{ width: '160px', padding: '16px 20px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
              Driver
            </th>
            {hours.map((hour) => (
              <th
                key={hour}
                style={{ width: '100px', padding: '12px 8px', textAlign: 'center', fontWeight: 600, fontSize: '12px', color: '#111827', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              >
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {drivers.map((driver) => {
            // Find shifts for this driver today
            const driverShifts = todayShifts.filter(s => s.driverId === driver.id);

            return (
              <tr key={driver.id}>
                {/* Driver Name Cell */}
                <td style={{ padding: '20px', verticalAlign: 'middle', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                      {driver.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {driver.name}
                    </span>
                  </div>
                </td>

                {/* Timeline Cell - Spans all hour columns */}
                <td
                  colSpan={hours.length}
                  style={{
                    padding: '12px',
                    verticalAlign: 'middle',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    position: 'relative',
                    height: '80px'
                  }}
                >
                  {/* Render shift blocks positioned by time */}
                  {driverShifts.length > 0 ? (
                    driverShifts.map((shift) => {
                      const style = getShiftStyle(shift);
                      const isActive = shift.status === 'active';
                      const progressPercentage = isActive && shift.binsCollected
                        ? Math.round((shift.binsCollected / shift.binCount) * 100)
                        : 0;

                      return (
                        <div
                          key={shift.id}
                          onClick={() => onShiftClick(shift)}
                          style={{
                            position: 'absolute',
                            left: style.left,
                            width: style.width,
                            top: '12px',
                            bottom: '12px',
                            background: isActive
                              ? 'linear-gradient(90deg, rgba(22, 163, 74, 0.95) 0%, rgba(34, 197, 94, 0.85) 50%, rgba(202, 138, 4, 0.75) 100%)'
                              : '#3b82f6',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            boxShadow: isActive
                              ? '0 0 25px rgba(22, 163, 74, 0.5), 0 4px 6px -1px rgb(0 0 0 / 0.2)'
                              : '0 2px 4px rgba(0,0,0,0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}
                          className="hover:shadow-lg hover:scale-[1.02] transition-all"
                          title={`${shift.route} - ${shift.binCount} bins`}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
                            {shift.route.split(' - ')[0]}
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.9 }}>
                            {shift.startTime} - {shift.endTime}
                          </div>
                          {isActive && (
                            <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                              {shift.binsCollected}/{shift.binCount} ({progressPercentage}%)
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                      No shifts today
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Empty state if no drivers */}
          {drivers.length === 0 && (
            <tr>
              <td colSpan={hours.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                No drivers found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Task type for shift builder
interface ShiftTask {
  id: string;
  type: 'collection' | 'placement' | 'pickup' | 'dropoff' | 'warehouse_stop';
  // Collection fields
  bin_id?: string;
  bin_number?: string;
  fill_percentage?: number;
  // Placement fields
  potential_location_id?: string;
  new_bin_number?: string;
  // Move request fields
  move_request_id?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_address?: string;
  move_type?: 'pickup' | 'dropoff';
  // Warehouse stop fields
  warehouse_action?: 'load' | 'unload';
  bins_to_load?: number;
  auto_inserted?: boolean; // Marks warehouse stops that were automatically inserted
  // Common fields
  latitude: number;
  longitude: number;
  address: string;
}

// Create Shift Drawer Component
function CreateShiftDrawer({
  onClose,
}: {
  onClose: () => void;
}) {
  const { data: drivers = [], isLoading: loadingDrivers } = useDrivers();
  const { token } = useAuthStore();

  const [driverId, setDriverId] = useState('');
  const [truckCapacity, setTruckCapacity] = useState('');
  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const [isDriverClosing, setIsDriverClosing] = useState(false);
  const [showBinSelection, setShowBinSelection] = useState(false);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [showRouteImport, setShowRouteImport] = useState(false);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<ShiftTask | null>(null);
  const [showPlacementSelection, setShowPlacementSelection] = useState(false);
  const [potentialLocations, setPotentialLocations] = useState<PotentialLocation[]>([]);
  const [showMoveRequestSelection, setShowMoveRequestSelection] = useState(false);
  const [moveRequests, setMoveRequests] = useState<MoveRequest[]>([]);
  const driverDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown with animation
  const closeDriverDropdown = () => {
    setIsDriverClosing(true);
    setTimeout(() => {
      setIsDriverDropdownOpen(false);
      setIsDriverClosing(false);
    }, 150);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDriverDropdownOpen &&
        driverDropdownRef.current &&
        !driverDropdownRef.current.contains(event.target as Node)
      ) {
        closeDriverDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDriverDropdownOpen]);

  const selectedDriver = drivers.find(d => d.id === driverId);

  // Drag and drop handlers - optimized to only recalculate on drop
  const handleDragStart = (index: number) => {
    setDraggedTaskIndex(index);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTaskIndex === null || draggedTaskIndex === index) return;

    // Only track visual position, don't update tasks array yet
    // This prevents recalculating capacity flow on every pixel during drag
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    // Only update tasks array on drop (not during drag)
    // This triggers capacity flow recalculation ONCE instead of ~100 times
    if (draggedTaskIndex !== null && dragOverIndex !== null && draggedTaskIndex !== dragOverIndex) {
      const newTasks = [...tasks];
      const draggedTask = newTasks[draggedTaskIndex];
      newTasks.splice(draggedTaskIndex, 1);
      newTasks.splice(dragOverIndex, 0, draggedTask);
      setTasks(newTasks);
    }

    setDraggedTaskIndex(null);
    setDragOverIndex(null);
  };

  // Task management
  const addWarehouseStop = () => {
    const newTask: ShiftTask = {
      id: `temp-${Date.now()}`,
      type: 'warehouse_stop',
      warehouse_action: 'load',
      bins_to_load: 1,
      latitude: 11.1867045, // Ropacal Warehouse - Santa Marta, Colombia
      longitude: -74.2362302,
      address: 'Cl. 29 #1-65, Gaira, Santa Marta, Magdalena',
    };
    setTasks([...tasks, newTask]);
  };

  const openBinSelection = async () => {
    try {
      // Fetch bins if not already loaded
      if (allBins.length === 0) {
        const bins = await getBins();
        setAllBins(bins);
      }
      setShowBinSelection(true);
    } catch (error) {
      console.error('Failed to fetch bins:', error);
      setError('Failed to load bins. Please try again.');
    }
  };

  const handleBinSelectionConfirm = (selectedBinIds: string[]) => {
    // Convert selected bin IDs to collection tasks
    const selectedBins = allBins.filter(bin => selectedBinIds.includes(bin.id));

    const collectionTasks: ShiftTask[] = selectedBins.map(bin => ({
      id: `temp-${Date.now()}-${bin.id}`,
      type: 'collection',
      bin_id: bin.id,
      bin_number: bin.bin_number.toString(),
      fill_percentage: bin.fill_percentage || 0,
      latitude: bin.latitude || 0,
      longitude: bin.longitude || 0,
      address: bin.current_street || 'Unknown',
    }));

    // Add collection tasks to the task list
    setTasks([...tasks, ...collectionTasks]);
    setShowBinSelection(false);
  };

  // Route import handlers
  const openRouteImport = () => {
    setShowRouteImport(true);
  };

  const handleRouteSelection = (selectedRoute: Route, routeBins: Bin[]) => {
    console.log('📋 [ROUTE IMPORT] Selected route:', selectedRoute.name);
    console.log('📍 [ROUTE IMPORT] Route has', routeBins.length, 'bins');

    // Convert route bins to shift tasks (collection tasks)
    const newTasks: ShiftTask[] = routeBins.map((bin, index) => ({
      id: `route-bin-${bin.id}`,
      type: 'collection',
      bin_id: bin.id,
      bin_number: bin.bin_number,
      latitude: bin.latitude,
      longitude: bin.longitude,
      address: bin.location_name || `${bin.current_street}, ${bin.city}`,
      fill_percentage: bin.fill_percentage || 0,
    }));

    console.log('✅ [ROUTE IMPORT] Created', newTasks.length, 'collection tasks');

    // Add tasks to shift
    setTasks([...tasks, ...newTasks]);

    // Close modal
    setShowRouteImport(false);
  };

  const openEditTask = (index: number) => {
    setEditingTaskIndex(index);
    setEditingTask({ ...tasks[index] });
  };

  const handleEditTaskChange = (field: keyof ShiftTask, value: any) => {
    if (!editingTask) return;
    setEditingTask({ ...editingTask, [field]: value });
  };

  const saveEditedTask = () => {
    if (editingTaskIndex === null || !editingTask) return;

    const updatedTasks = [...tasks];
    updatedTasks[editingTaskIndex] = editingTask;
    setTasks(updatedTasks);

    setEditingTaskIndex(null);
    setEditingTask(null);
  };

  const cancelEditTask = () => {
    setEditingTaskIndex(null);
    setEditingTask(null);
  };

  const openPlacementSelection = async () => {
    try {
      if (potentialLocations.length === 0) {
        const locations = await getPotentialLocations('active');
        setPotentialLocations(locations);
      }
      setShowPlacementSelection(true);
    } catch (error) {
      console.error('Failed to fetch potential locations:', error);
      setError('Failed to load potential locations. Please try again.');
    }
  };

  const handlePlacementSelectionConfirm = (selectedLocationIds: string[]) => {
    const selectedLocations = potentialLocations.filter(loc =>
      selectedLocationIds.includes(loc.id)
    );

    const placementTasks: ShiftTask[] = selectedLocations.map(location => ({
      id: `temp-${Date.now()}-${location.id}`,
      type: 'placement',
      potential_location_id: location.id,
      new_bin_number: '', // Manager can edit this later
      latitude: location.latitude || 0,
      longitude: location.longitude || 0,
      address: location.address || location.street,
    }));

    setTasks([...tasks, ...placementTasks]);
    setShowPlacementSelection(false);
  };

  const openMoveRequestSelection = async () => {
    try {
      if (moveRequests.length === 0) {
        const requests = await getMoveRequests({ status: 'pending', assigned: 'unassigned' });
        setMoveRequests(requests);
      }
      setShowMoveRequestSelection(true);
    } catch (error) {
      console.error('Failed to fetch move requests:', error);
      setError('Failed to load move requests. Please try again.');
    }
  };

  const handleMoveRequestSelectionConfirm = (selectedRequestIds: string[]) => {
    const selectedRequests = moveRequests.filter(req =>
      selectedRequestIds.includes(req.id)
    );

    // For each move request, create BOTH pickup and dropoff tasks
    const moveRequestTasks: ShiftTask[] = [];

    selectedRequests.forEach(request => {
      // 1. Pickup task at current location (type must match backend constraint)
      const pickupTask: ShiftTask = {
        id: `temp-${Date.now()}-${request.id}-pickup`,
        type: 'pickup',
        move_request_id: request.id,
        bin_id: request.bin_id,
        bin_number: request.bin_number.toString(),
        move_type: 'pickup',
        destination_latitude: request.new_latitude || 0,
        destination_longitude: request.new_longitude || 0,
        destination_address: request.move_type === 'store'
          ? 'Warehouse Storage'
          : `${request.new_street || ''}, ${request.new_city || ''} ${request.new_zip || ''}`.trim(),
        latitude: 0, // Will be populated from bin data on backend
        longitude: 0, // Will be populated from bin data on backend
        address: `${request.current_street}, ${request.city} ${request.zip}`,
      };

      console.log('🔍 [PICKUP TASK DEBUG]', {
        type: pickupTask.type,
        task_type: pickupTask.type,
        move_type: pickupTask.move_type,
        bin_id: pickupTask.bin_id,
        latitude: pickupTask.latitude,
        longitude: pickupTask.longitude,
        message: 'Sending to backend with 0,0 - expects backend to populate from bin'
      });

      // 2. Dropoff task at destination
      const dropoffTask: ShiftTask = {
        id: `temp-${Date.now()}-${request.id}-dropoff`,
        type: 'dropoff',
        move_request_id: request.id,
        bin_id: request.bin_id,
        bin_number: request.bin_number.toString(),
        move_type: 'dropoff',
        destination_latitude: request.new_latitude || 0,
        destination_longitude: request.new_longitude || 0,
        destination_address: request.move_type === 'store'
          ? 'Warehouse Storage'
          : `${request.new_street || ''}, ${request.new_city || ''} ${request.new_zip || ''}`.trim(),
        latitude: request.new_latitude || 0,
        longitude: request.new_longitude || 0,
        address: request.move_type === 'store'
          ? 'Warehouse Storage'
          : `${request.new_street || ''}, ${request.new_city || ''} ${request.new_zip || ''}`.trim(),
      };

      // Add pickup first, then dropoff (in sequence)
      moveRequestTasks.push(pickupTask, dropoffTask);
    });

    setTasks([...tasks, ...moveRequestTasks]);
    setShowMoveRequestSelection(false);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  // Accept a smart suggestion
  const acceptSuggestion = (suggestion: typeof smartSuggestions[0]) => {
    const newTasks = [...tasks];

    if (suggestion.action === 'add') {
      // Add new warehouse stop
      const newWarehouseTask: ShiftTask = {
        id: `temp-${Date.now()}`,
        type: 'warehouse_stop',
        warehouse_action: suggestion.targetType === 'warehouse_load' ? 'load' : 'unload',
        bins_to_load: suggestion.targetType === 'warehouse_load' ? suggestion.binsCount : undefined,
        latitude: 11.1867045, // Ropacal Warehouse - Santa Marta, Colombia
        longitude: -74.2362302,
        address: 'Cl. 29 #1-65, Gaira, Santa Marta, Magdalena',
      };
      newTasks.splice((suggestion.insertAfterIndex ?? -1) + 1, 0, newWarehouseTask);
    } else if (suggestion.action === 'update' && suggestion.existingTaskIndex !== undefined) {
      // Update existing warehouse stop
      const existingTask = newTasks[suggestion.existingTaskIndex];
      if (existingTask.type === 'warehouse_stop' && existingTask.warehouse_action === 'load') {
        newTasks[suggestion.existingTaskIndex] = {
          ...existingTask,
          bins_to_load: suggestion.suggestedBinCount,
        };
      }
    } else if (suggestion.action === 'remove' && suggestion.existingTaskIndex !== undefined) {
      // Remove warehouse stop
      newTasks.splice(suggestion.existingTaskIndex, 1);
    }

    setTasks(newTasks);
  };

  // Auto-insert warehouse stops when truck capacity is exceeded
  const autoInsertWarehouseStops = (inputTasks: ShiftTask[], capacity: number): ShiftTask[] => {
    if (!capacity || capacity <= 0) return inputTasks;

    // First, remove all auto-inserted warehouse stops
    const manualTasks = inputTasks.filter(task => !(task.type === 'warehouse_stop' && task.auto_inserted));

    const result: ShiftTask[] = [];
    let currentLoad = 0;

    for (const task of manualTasks) {
      // Check if this task adds bins to the truck
      // Note: Collections don't affect bin capacity (collecting clothes, not bins)
      // Placements actually reduce capacity (delivering bins)
      const addsBins = task.type === 'placement' ||
                      (task.type === 'move_request' && task.move_type === 'pickup');

      // If adding this task would exceed capacity, insert warehouse stop first
      if (addsBins && currentLoad >= capacity) {
        result.push({
          id: `auto-warehouse-${Date.now()}-${result.length}`,
          type: 'warehouse_stop',
          warehouse_action: 'unload',
          auto_inserted: true,
          latitude: 11.1867045, // Ropacal Warehouse - Santa Marta, Colombia
          longitude: -74.2362302,
          address: 'Cl. 29 #1-65, Gaira, Santa Marta, Magdalena',
        });
        currentLoad = 0; // Reset after unloading
      }

      // Add the current task
      result.push(task);

      // Update load count
      if (addsBins) {
        currentLoad++;
      } else if (task.type === 'warehouse_stop') {
        // Manual warehouse stops also reset the load
        currentLoad = 0;
      }
    }

    return result;
  };

  // Auto-insert warehouse stops whenever tasks or capacity changes
  useEffect(() => {
    const capacity = parseInt(truckCapacity);
    if (tasks.length > 0 && capacity > 0) {
      const tasksWithAutoWarehouses = autoInsertWarehouseStops(tasks, capacity);

      // Only update if the result is different (to avoid infinite loop)
      const hasChanged = JSON.stringify(tasks) !== JSON.stringify(tasksWithAutoWarehouses);
      if (hasChanged) {
        setTasks(tasksWithAutoWarehouses);
      }
    }
  }, [truckCapacity]); // Only run when capacity changes, not on every task change

  // Calculate shift analysis
  const shiftAnalysis = useMemo(() => {
    let collections = 0;
    let placements = 0;
    let pickups = 0;
    let dropoffs = 0;
    let warehouseStops = 0;

    tasks.forEach(task => {
      if (task.type === 'collection') collections++;
      else if (task.type === 'placement') placements++;
      else if (task.type === 'move_request') {
        if (task.move_type === 'pickup') pickups++;
        else if (task.move_type === 'dropoff') dropoffs++;
      }
      else if (task.type === 'warehouse_stop') warehouseStops++;
    });

    return { collections, placements, pickups, dropoffs, warehouseStops, total: tasks.length };
  }, [tasks]);

  // Calculate capacity flow for each task (hybrid approach)
  const capacityFlow = useMemo(() => {
    console.log('🔄 [CAPACITY FLOW] Recalculating...');
    console.log('📋 [CAPACITY FLOW] Total tasks:', tasks.length);
    console.log('🚛 [CAPACITY FLOW] Truck capacity:', truckCapacity);

    const flow: Array<{ taskIndex: number; loadBefore: number; loadAfter: number; delta: number }> = [];
    let currentLoad = 0;

    tasks.forEach((task, index) => {
      const loadBefore = currentLoad;
      let delta = 0;

      if (task.type === 'collection') {
        // Collection: collecting CLOTHES from bins (doesn't affect bin capacity)
        delta = 0;
      } else if (task.type === 'placement') {
        // Placement: deliver new bin (-1)
        delta = -1;
      } else if (task.type === 'move_request') {
        // Move request: split into pickup (+1) and dropoff (-1) based on move_type
        if (task.move_type === 'pickup') {
          delta = +1; // Picking up existing bin from field (adds to truck)
        } else if (task.move_type === 'dropoff') {
          delta = -1; // Dropping off bin at new location (removes from truck)
        } else {
          delta = 0; // Fallback for legacy data without move_type
        }
      } else if (task.type === 'warehouse_stop') {
        if (task.warehouse_action === 'load') {
          delta = +(task.bins_to_load || 0);
        } else {
          // Unload all bins
          delta = -currentLoad;
        }
      }

      // Allow negative capacity so smart suggestions can detect when bins run out
      currentLoad = currentLoad + delta;
      const loadAfter = currentLoad;

      flow.push({ taskIndex: index, loadBefore, loadAfter, delta });

      const taskLabel = task.type === 'move_request' && task.move_type
        ? `${task.type}_${task.move_type}`
        : task.type;
      console.log(`  Task #${index + 1} [${taskLabel}]: ${loadBefore} ${delta >= 0 ? '+' : ''}${delta} → ${loadAfter}`);
    });

    console.log('✅ [CAPACITY FLOW] Calculation complete. Total flow entries:', flow.length);
    return flow;
  }, [tasks]);

  // Enhanced smart suggestion type with priority and action types
  type SmartSuggestion = {
    priority: 'critical' | 'optimization' | 'info';
    action: 'add' | 'update' | 'move' | 'remove';
    targetType: 'warehouse_load' | 'warehouse_unload';

    // For add action
    insertAfterIndex?: number;
    binsCount?: number;

    // For update/move/remove actions
    existingTaskIndex?: number;
    currentBinCount?: number;
    suggestedBinCount?: number;
    suggestedPosition?: number;

    reason: string;
    affectedTasks: number[];
  };

  // Detect smart suggestions - comprehensive edge case handling
  const smartSuggestions = useMemo(() => {
    console.log('\n💡 [SMART SUGGESTIONS] Analyzing shift for capacity issues...');
    console.log('📊 [SMART SUGGESTIONS] Capacity:', truckCapacity);
    console.log('📋 [SMART SUGGESTIONS] Total tasks:', tasks.length);
    console.log('📈 [SMART SUGGESTIONS] Capacity flow entries:', capacityFlow.length);

    const suggestions: SmartSuggestion[] = [];
    const capacity = parseInt(truckCapacity) || 0;

    if (capacity <= 0 || tasks.length === 0) {
      console.log('⚠️  [SMART SUGGESTIONS] Skipping: capacity or tasks invalid');
      return suggestions;
    }

    // PHASE 1: Detect existing warehouse stops
    console.log('\n📦 [PHASE 1] Detecting existing warehouse stops...');
    const existingWarehouseStops: Array<{
      taskIndex: number;
      action: 'load' | 'unload';
      binsCount: number;
    }> = [];

    tasks.forEach((task, index) => {
      if (task.type === 'warehouse_stop') {
        const action = task.warehouse_action as 'load' | 'unload';
        const binsCount = action === 'load' ? (task.bins_to_load || 0) : 0;
        existingWarehouseStops.push({ taskIndex: index, action, binsCount });
        console.log(`   ⬆️  Found warehouse ${action} at task #${index + 1} (${binsCount} bins)`);
      }
    });

    console.log(`✅ Found ${existingWarehouseStops.length} existing warehouse stops`);

    // PHASE 2: Scan capacity flow and generate context-aware suggestions
    console.log('\n🔍 [PHASE 2] Scanning capacity flow for problems...');
    const suggestedIndexes = new Set<number>();

    let i = 0;
    while (i < capacityFlow.length) {
      const flow = capacityFlow[i];
      const task = tasks[flow.taskIndex];

      // CRITICAL: Capacity goes NEGATIVE (ran out of bins)
      if (flow.loadAfter < 0 && !suggestedIndexes.has(i)) {
        console.log(`🚨 NEGATIVE CAPACITY ZONE starting at task #${i + 1}!`);

        const zoneStart = i;
        let zoneEnd = i;
        let lowestCapacity = flow.loadAfter;

        // Find extent of negative zone
        let j = i + 1;
        while (j < capacityFlow.length && capacityFlow[j].loadAfter < 0) {
          lowestCapacity = Math.min(lowestCapacity, capacityFlow[j].loadAfter);
          zoneEnd = j;
          console.log(`   📍 Task #${j + 1}: capacity=${capacityFlow[j].loadAfter}`);
          j++;
        }

        console.log(`   📊 Zone: tasks #${zoneStart + 1} to #${zoneEnd + 1}, lowest: ${lowestCapacity}`);

        const binsNeeded = Math.abs(lowestCapacity);
        const binsToLoad = Math.min(binsNeeded, capacity);
        const affectedTasks = Array.from({ length: zoneEnd - zoneStart + 1 }, (_, idx) => zoneStart + idx);

        // Check if there's an existing warehouse stop BEFORE this zone (get the CLOSEST one)
        const candidatesBeforeZone = existingWarehouseStops.filter(ws => ws.taskIndex < zoneStart && ws.action === 'load');
        const warehouseBeforeZone = candidatesBeforeZone[candidatesBeforeZone.length - 1]; // Get the last (closest) one

        // Check if warehouse already completed its service (capacity reached 0) before this negative zone
        let warehouseCompletedService = false;
        if (warehouseBeforeZone) {
          // Scan capacity flow between warehouse and negative zone
          for (let k = warehouseBeforeZone.taskIndex + 1; k < zoneStart; k++) {
            if (capacityFlow[k] && capacityFlow[k].loadAfter === 0) {
              // Capacity reached exactly 0 - but check if there's a gap before the negative zone
              // If negative zone starts immediately after (k+1 === zoneStart), it's continuous
              if (k + 1 < zoneStart) {
                // There's a gap between zero-point and negative zone - warehouse completed
                warehouseCompletedService = true;
                console.log(`   ✅ Warehouse #${warehouseBeforeZone.taskIndex + 1} completed service at task #${k + 1} (capacity=${capacityFlow[k].loadAfter})`);
                break;
              } else {
                console.log(`   📌 Warehouse #${warehouseBeforeZone.taskIndex + 1} reached capacity=0 at task #${k + 1}, but negative zone starts immediately - continuous sequence`);
              }
            }
          }
        }

        if (warehouseBeforeZone && !warehouseCompletedService) {
          // Check for downstream warehouses that could be consolidated (no service boundaries between them)
          const warehousesToConsolidate: typeof warehouseBeforeZone[] = [];
          let lastCheckedWarehouse = warehouseBeforeZone;

          // Look ahead for more warehouses in the continuous flow
          for (let wIdx = existingWarehouseStops.indexOf(warehouseBeforeZone) + 1; wIdx < existingWarehouseStops.length; wIdx++) {
            const nextWarehouse = existingWarehouseStops[wIdx];
            if (nextWarehouse.action !== 'load') continue;

            // Check if there's a service boundary between lastCheckedWarehouse and nextWarehouse
            let hasServiceBoundary = false;
            for (let k = lastCheckedWarehouse.taskIndex + 1; k < nextWarehouse.taskIndex; k++) {
              if (capacityFlow[k] && capacityFlow[k].loadAfter === 0) {
                // Found capacity=0, check if there's a gap before next negative zone
                if (k + 1 < nextWarehouse.taskIndex) {
                  // There's a gap between capacity=0 and next warehouse - boundary exists
                  hasServiceBoundary = true;
                  break;
                }
              }
            }

            if (!hasServiceBoundary) {
              // No boundary - this warehouse is in the same continuous flow, can be consolidated
              warehousesToConsolidate.push(nextWarehouse);
              lastCheckedWarehouse = nextWarehouse;
            } else {
              // Service boundary found - stop looking
              break;
            }
          }

          // Count TOTAL downstream placements, dropoffs, AND pickups from warehouse stop
          // If we found warehouses to consolidate, count ALL consumers across all of them
          let totalBinConsumers = 0; // placements + dropoffs
          let totalBinProviders = 0; // pickups
          const stopAtIndex = warehousesToConsolidate.length > 0
            ? warehousesToConsolidate[warehousesToConsolidate.length - 1].taskIndex
            : warehouseBeforeZone.taskIndex;

          for (let k = warehouseBeforeZone.taskIndex + 1; k < tasks.length; k++) {
            if (tasks[k].type === 'placement' || (tasks[k].type === 'move_request' && tasks[k].move_type === 'dropoff')) {
              totalBinConsumers++;
            }
            if (tasks[k].type === 'move_request' && tasks[k].move_type === 'pickup') {
              totalBinProviders++;
            }
            // Stop at next warehouse LOAD (only if not in consolidation list)
            if (k > stopAtIndex && tasks[k].type === 'warehouse_stop' && (tasks[k] as any).warehouse_action === 'load') break;
          }

          // Net bins needed = consumers minus providers (pickups reduce warehouse load)
          const netBinsNeeded = totalBinConsumers - totalBinProviders;

          // Count pickups that happen BEFORE first consumption (these temporarily increase capacity)
          let pickupsBeforeConsumption = 0;
          for (let k = warehouseBeforeZone.taskIndex + 1; k < tasks.length; k++) {
            // Stop at first consumption (placement or dropoff)
            if (tasks[k].type === 'placement' || (tasks[k].type === 'move_request' && tasks[k].move_type === 'dropoff')) {
              break;
            }
            // Count pickups before first consumption
            if (tasks[k].type === 'move_request' && tasks[k].move_type === 'pickup') {
              pickupsBeforeConsumption++;
            }
          }

          console.log(`   💡 Found existing warehouse at task #${warehouseBeforeZone.taskIndex + 1} (loads ${warehouseBeforeZone.binsCount} bins)`);
          if (warehousesToConsolidate.length > 0) {
            const consolidatedBins = warehousesToConsolidate.reduce((sum, w) => sum + w.binsCount, 0);
            console.log(`   🔄 Found ${warehousesToConsolidate.length} downstream warehouse(s) that can be consolidated (${consolidatedBins} bins total):`);
            warehousesToConsolidate.forEach(w => {
              console.log(`      - Warehouse #${w.taskIndex + 1}: ${w.binsCount} bins`);
            });
          }
          console.log(`   📊 Downstream: ${totalBinConsumers} consumers (placements+dropoffs) - ${totalBinProviders} providers (pickups) = ${netBinsNeeded} net bins needed, warehouse loads: ${warehouseBeforeZone.binsCount}`);
          if (pickupsBeforeConsumption > 0) {
            console.log(`   🔄 Found ${pickupsBeforeConsumption} pickup(s) before first consumption - will reduce warehouse load to prevent over-capacity`);
          }

          // Compare warehouse bin count against NET bins needed (consumers - providers)
          if (warehouseBeforeZone.binsCount < netBinsNeeded) {
            // Calculate optimal bin count, accounting for pickups that happen before consumption
            // Example: Need 6 net bins, but 1 pickup happens first → load only 5 bins
            // Result: 5 (warehouse) + 1 (pickup) = 6, then consume 6
            let optimalBinCount = Math.min(netBinsNeeded, capacity - pickupsBeforeConsumption);

            // Check if warehouse is already at truck capacity
            if (warehouseBeforeZone.binsCount >= capacity && netBinsNeeded > capacity) {
              // Warehouse already loading max truck capacity, need SECOND warehouse stop
              const remainingPlacements = netBinsNeeded - warehouseBeforeZone.binsCount;
              const secondLoadBins = Math.min(remainingPlacements, capacity);

              // Find where to insert second warehouse stop (after first batch of placements)
              let insertAfterTask = warehouseBeforeZone.taskIndex + capacity; // After first 6 placements
              while (insertAfterTask < tasks.length && tasks[insertAfterTask]?.type !== 'placement') {
                insertAfterTask++;
              }

              suggestions.push({
                priority: 'critical',
                action: 'add',
                targetType: 'warehouse_load',
                insertAfterIndex: insertAfterTask,
                binsCount: secondLoadBins,
                reason: `🚛 Truck at max capacity (${capacity} bins). Add another warehouse stop after task #${insertAfterTask + 1} to load ${secondLoadBins} more bins (${netBinsNeeded} net bins needed after accounting for pickups)`,
                affectedTasks
              });
            } else if (warehouseBeforeZone.binsCount < capacity) {
              // Warehouse can load more, suggest updating it
              const additionalNeeded = optimalBinCount - warehouseBeforeZone.binsCount;

              const pickupNote = pickupsBeforeConsumption > 0
                ? `, reduced from ${netBinsNeeded} to leave room for ${pickupsBeforeConsumption} pickup${pickupsBeforeConsumption > 1 ? 's' : ''}`
                : '';

              const consolidationNote = warehousesToConsolidate.length > 0
                ? ` (consolidating ${warehousesToConsolidate.length} downstream warehouse${warehousesToConsolidate.length > 1 ? 's' : ''})`
                : '';

              suggestions.push({
                priority: 'optimization',
                action: 'update',
                targetType: 'warehouse_load',
                existingTaskIndex: warehouseBeforeZone.taskIndex,
                currentBinCount: warehouseBeforeZone.binsCount,
                suggestedBinCount: optimalBinCount,
                reason: netBinsNeeded > capacity
                  ? `⚠️ Update warehouse stop #${warehouseBeforeZone.taskIndex + 1} to load ${optimalBinCount} bins (currently ${warehouseBeforeZone.binsCount}) - need ${netBinsNeeded} net bins (${totalBinConsumers} consumers - ${totalBinProviders} pickups), will require multiple trips${pickupNote}${consolidationNote}`
                  : `⚠️ Update warehouse stop #${warehouseBeforeZone.taskIndex + 1} from ${warehouseBeforeZone.binsCount} to ${optimalBinCount} bins (need ${netBinsNeeded} net bins: ${totalBinConsumers} consumers - ${totalBinProviders} pickup${totalBinProviders > 1 ? 's' : ''}${pickupNote})${consolidationNote}`,
                affectedTasks
              });

              // Suggest removing the consolidated warehouses
              if (warehousesToConsolidate.length > 0) {
                warehousesToConsolidate.forEach(w => {
                  suggestions.push({
                    priority: 'optimization',
                    action: 'remove',
                    targetType: 'warehouse_load',
                    existingTaskIndex: w.taskIndex,
                    currentBinCount: w.binsCount,
                    reason: `💡 Remove warehouse stop #${w.taskIndex + 1} - consolidated into warehouse #${warehouseBeforeZone.taskIndex + 1}`,
                    affectedTasks: []
                  });
                });
              }
            }
          }
        } else {
          // Add new warehouse stop (either no warehouse before, or warehouse completed its service)
          if (warehouseBeforeZone && warehouseCompletedService) {
            console.log(`   🆕 Warehouse #${warehouseBeforeZone.taskIndex + 1} completed its service - need NEW warehouse for this zone`);
          }
          let insertAfter = zoneStart - 1;
          while (insertAfter >= 0 && tasks[insertAfter]?.type === 'placement') {
            insertAfter--;
          }

          suggestions.push({
            priority: 'critical',
            action: 'add',
            targetType: 'warehouse_load',
            insertAfterIndex: Math.max(-1, insertAfter),
            binsCount: binsToLoad,
            reason: binsNeeded > capacity
              ? `🚨 Need ${binsNeeded} bins but capacity is ${capacity}! Add warehouse stop to load ${binsToLoad} bins before task #${zoneStart + 1} (you'll need multiple trips)`
              : `🚨 Add warehouse stop to load ${binsToLoad} bin${binsToLoad > 1 ? 's' : ''} before task #${zoneStart + 1} (covers ${affectedTasks.length} task${affectedTasks.length > 1 ? 's' : ''})`,
            affectedTasks
          });
        }

        for (let k = zoneStart; k <= zoneEnd; k++) {
          suggestedIndexes.add(k);
        }
        i = zoneEnd + 1;
        continue;
      }

      // CRITICAL: Capacity EXCEEDS truck limit
      if (flow.loadAfter > capacity && !suggestedIndexes.has(i)) {
        console.log(`⚠️  OVER CAPACITY at task #${i + 1}!`);
        suggestions.push({
          priority: 'critical',
          action: 'add',
          targetType: 'warehouse_unload',
          insertAfterIndex: i - 1,
          binsCount: flow.loadBefore,
          reason: `🚨 Over capacity! Truck would have ${flow.loadAfter}/${capacity} bins. Add warehouse stop to unload before task #${i + 1}`,
          affectedTasks: [i]
        });
        suggestedIndexes.add(i);
      }

      i++;
    }

    // PHASE 3: Check for optimization opportunities
    console.log('\n✨ [PHASE 3] Checking optimizations...');

    // Check if existing warehouse stops are obsolete, over-provisioned, or misplaced
    existingWarehouseStops.forEach(ws => {
      if (ws.action !== 'load') return;

      const wsFlowIndex = capacityFlow.findIndex(f => f.taskIndex === ws.taskIndex);
      if (wsFlowIndex === -1) return;

      // Count ALL downstream consumers and providers
      let totalConsumers = 0; // placements + dropoffs
      let totalProviders = 0; // pickups
      for (let k = ws.taskIndex + 1; k < tasks.length; k++) {
        if (tasks[k].type === 'placement' || (tasks[k].type === 'move_request' && tasks[k].move_type === 'dropoff')) {
          totalConsumers++;
        }
        if (tasks[k].type === 'move_request' && tasks[k].move_type === 'pickup') {
          totalProviders++;
        }
        // Stop at next warehouse LOAD
        if (k > ws.taskIndex && tasks[k].type === 'warehouse_stop' && (tasks[k] as any).warehouse_action === 'load') break;
      }

      const netConsumers = totalConsumers - totalProviders;

      console.log(`   📦 Warehouse #${ws.taskIndex + 1}: loads ${ws.binsCount}, has ${totalConsumers} consumers - ${totalProviders} pickups = ${netConsumers} net downstream`);

      // Obsolete: warehouse stop loads bins but no consumers use them
      if (netConsumers === 0 && ws.binsCount > 0) {
        suggestions.push({
          priority: 'optimization',
          action: 'remove',
          targetType: 'warehouse_load',
          existingTaskIndex: ws.taskIndex,
          currentBinCount: ws.binsCount,
          reason: `💡 Remove warehouse stop #${ws.taskIndex + 1} - no placements use these ${ws.binsCount} bins`,
          affectedTasks: []
        });
      }
      // Over-provisioned: warehouse loads more bins than needed
      else if (ws.binsCount > netConsumers && netConsumers > 0) {
        suggestions.push({
          priority: 'optimization',
          action: 'update',
          targetType: 'warehouse_load',
          existingTaskIndex: ws.taskIndex,
          currentBinCount: ws.binsCount,
          suggestedBinCount: netConsumers,
          reason: totalProviders > 0
            ? `💡 Update warehouse stop #${ws.taskIndex + 1} from ${ws.binsCount} to ${netConsumers} bins (only need ${netConsumers}: ${totalConsumers} consumers - ${totalProviders} pickup${totalProviders > 1 ? 's' : ''})`
            : `💡 Update warehouse stop #${ws.taskIndex + 1} from ${ws.binsCount} to ${netConsumers} bins (only need ${netConsumers} for ${totalConsumers} placement${totalConsumers > 1 ? 's' : ''})`,
          affectedTasks: []
        });
      }
    });

    // Check for warehouse consolidation opportunities
    // If there are multiple warehouse stops that could be merged into one
    const warehouseLoads = existingWarehouseStops.filter(ws => ws.action === 'load');
    if (warehouseLoads.length >= 2) {
      for (let i = 0; i < warehouseLoads.length - 1; i++) {
        const warehouseA = warehouseLoads[i];
        const warehouseB = warehouseLoads[i + 1];

        // Check if there's a "service completion boundary" between A and B
        // (capacity reaches 0 with a gap before going negative again)
        let hasServiceBoundary = false;
        for (let k = warehouseA.taskIndex + 1; k < warehouseB.taskIndex; k++) {
          if (capacityFlow[k] && capacityFlow[k].loadAfter === 0) {
            // Found capacity=0, check if there's a gap before next negative zone
            const nextNegativeIndex = capacityFlow.findIndex((f, idx) => idx > k && f.loadAfter < 0);
            if (nextNegativeIndex === -1 || nextNegativeIndex > k + 1) {
              // There's a gap - service boundary exists
              hasServiceBoundary = true;
              break;
            }
          }
        }

        // If no service boundary, check if they can be consolidated
        if (!hasServiceBoundary) {
          const combinedBins = warehouseA.binsCount + warehouseB.binsCount;

          // Only suggest consolidation if combined load doesn't exceed truck capacity
          if (combinedBins <= capacity) {
            // Count total consumers between warehouse A and the end of warehouse B's service
            let totalConsumers = 0;
            let totalProviders = 0;
            for (let k = warehouseA.taskIndex + 1; k < tasks.length; k++) {
              if (tasks[k].type === 'placement' || (tasks[k].type === 'move_request' && tasks[k].move_type === 'dropoff')) {
                totalConsumers++;
              }
              if (tasks[k].type === 'move_request' && tasks[k].move_type === 'pickup') {
                totalProviders++;
              }
              // Stop at next warehouse load (after B)
              if (k > warehouseB.taskIndex && tasks[k].type === 'warehouse_stop' && (tasks[k] as any).warehouse_action === 'load') {
                break;
              }
            }

            const netConsumers = totalConsumers - totalProviders;

            // Only suggest if the consolidation makes sense (combined bins = net consumers)
            if (combinedBins === netConsumers) {
              console.log(`   🔄 Consolidation opportunity: Warehouse #${warehouseA.taskIndex + 1} (${warehouseA.binsCount} bins) + Warehouse #${warehouseB.taskIndex + 1} (${warehouseB.binsCount} bins) = ${combinedBins} bins`);

              suggestions.push({
                priority: 'optimization',
                action: 'update',
                targetType: 'warehouse_load',
                existingTaskIndex: warehouseA.taskIndex,
                currentBinCount: warehouseA.binsCount,
                suggestedBinCount: combinedBins,
                reason: `💡 Update warehouse stop #${warehouseA.taskIndex + 1} from ${warehouseA.binsCount} to ${combinedBins} bins (consolidate with warehouse #${warehouseB.taskIndex + 1})`,
                affectedTasks: []
              });

              suggestions.push({
                priority: 'optimization',
                action: 'remove',
                targetType: 'warehouse_load',
                existingTaskIndex: warehouseB.taskIndex,
                currentBinCount: warehouseB.binsCount,
                reason: `💡 Remove warehouse stop #${warehouseB.taskIndex + 1} - consolidated into warehouse #${warehouseA.taskIndex + 1}`,
                affectedTasks: []
              });
            }
          }
        }
      }
    }

    // If no issues, suggest initial load for first placements
    if (suggestions.length === 0) {
      const placements = tasks.filter(t => t.type === 'placement');
      if (placements.length > 0) {
        const firstPlacementIndex = tasks.findIndex(t => t.type === 'placement');
        const flowAtFirst = capacityFlow[firstPlacementIndex];

        if (flowAtFirst && flowAtFirst.loadBefore === 0) {
          const binsToLoad = Math.min(placements.length, capacity);
          suggestions.push({
            priority: 'info',
            action: 'add',
            targetType: 'warehouse_load',
            insertAfterIndex: Math.max(-1, firstPlacementIndex - 1),
            binsCount: binsToLoad,
            reason: placements.length > capacity
              ? `💡 Add warehouse stop to load ${binsToLoad} bins for first ${binsToLoad} of ${placements.length} placements (will need multiple trips)`
              : `💡 Add warehouse stop to load ${binsToLoad} bin${binsToLoad > 1 ? 's' : ''} for ${placements.length} placement${placements.length > 1 ? 's' : ''}`,
            affectedTasks: Array.from({ length: Math.min(binsToLoad, placements.length) }, (_, idx) => firstPlacementIndex + idx)
          });
        }
      }
    }

    // Sort by priority and return
    const priorityOrder = { critical: 0, optimization: 1, info: 2 };
    const sorted = suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    console.log(`\n✅ [SMART SUGGESTIONS] Generated ${sorted.length} suggestion(s):`);
    sorted.forEach((s, idx) => {
      const actionStr = s.action === 'add' ? 'Add' : s.action === 'update' ? 'Update' : s.action === 'remove' ? 'Remove' : 'Move';
      console.log(`   ${idx + 1}. [${s.priority}] ${actionStr}: ${s.reason}`);
    });

    return sorted.slice(0, 5); // Return top 5
  }, [tasks, capacityFlow, truckCapacity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!driverId) {
        throw new Error('Please select a driver');
      }
      if (!truckCapacity || parseInt(truckCapacity) <= 0) {
        throw new Error('Please enter a valid truck capacity');
      }
      if (tasks.length === 0) {
        throw new Error('Please add at least one task to the shift');
      }

      // Convert tasks to API format
      const tasksPayload = tasks.map(task => {
        const baseTask: Record<string, unknown> = {
          task_type: task.type,
          latitude: task.latitude,
          longitude: task.longitude,
          address: task.address,
        };

        if (task.type === 'collection') {
          baseTask.bin_id = task.bin_id;
          baseTask.bin_number = task.bin_number;
          baseTask.fill_percentage = task.fill_percentage;
        } else if (task.type === 'placement') {
          baseTask.potential_location_id = task.potential_location_id;
          baseTask.new_bin_number = task.new_bin_number;
        } else if (task.type === 'pickup' || task.type === 'dropoff') {
          // Pickup/dropoff tasks from move requests
          baseTask.move_request_id = task.move_request_id;
          baseTask.bin_id = task.bin_id; // Needed for pickup coordinate lookup
          baseTask.destination_latitude = task.destination_latitude;
          baseTask.destination_longitude = task.destination_longitude;
          baseTask.destination_address = task.destination_address;
          baseTask.move_type = task.move_type;
        } else if (task.type === 'warehouse_stop') {
          baseTask.warehouse_action = task.warehouse_action;
          baseTask.bins_to_load = task.bins_to_load;
        }

        return baseTask;
      });

      const payload = {
        driver_id: driverId,
        truck_bin_capacity: parseInt(truckCapacity),
        warehouse_latitude: 11.1867045, // Ropacal Warehouse - Santa Marta, Colombia
        warehouse_longitude: -74.2362302,
        warehouse_address: 'Cl. 29 #1-65, Gaira, Santa Marta, Magdalena',
        tasks: tasksPayload,
      };

      // Log the complete shift object before creating
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 [SHIFT CREATION] Final Shift Object:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(payload, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Shift Summary:');
      console.log(`   Driver ID: ${payload.driver_id}`);
      console.log(`   Truck Capacity: ${payload.truck_bin_capacity} bins`);
      console.log(`   Total Tasks: ${payload.tasks.length}`);
      console.log(`   Task Breakdown:`);
      const taskCounts = payload.tasks.reduce((acc, task) => {
        acc[task.task_type] = (acc[task.task_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(taskCounts).forEach(([type, count]) => {
        console.log(`      - ${type}: ${count}`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Call backend directly (not through Next.js API route)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_URL}/api/manager/shifts/create-with-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Failed to create shift (${response.status} ${response.statusText})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response is not JSON, use status text
        }
        throw new Error(errorMessage);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create shift:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shift. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Build Custom Shift</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-fast"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Driver Selection */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-3 block">Driver</label>
              <div className="relative" ref={driverDropdownRef}>
                <button
                  type="button"
                  onClick={() => isDriverDropdownOpen ? closeDriverDropdown() : setIsDriverDropdownOpen(true)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-left flex items-center justify-between hover:bg-gray-50 transition-fast"
                >
                  <span className={selectedDriver ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedDriver ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                          {selectedDriver.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium">{selectedDriver.name}</span>
                      </div>
                    ) : (
                      'Select driver...'
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isDriverDropdownOpen && (
                  <div className={`absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50 ${isDriverClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
                    {loadingDrivers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    ) : drivers.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No drivers available</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {drivers.map((driver) => (
                          <button
                            key={driver.id}
                            type="button"
                            onClick={() => {
                              setDriverId(driver.id);
                              closeDriverDropdown();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-fast ${
                              driverId === driver.id ? 'bg-primary/5 border border-primary/20' : ''
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {driver.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{driver.name}</p>
                              <p className="text-xs text-gray-500 truncate">{driver.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Truck Capacity */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-3 block">
                Truck Bin Capacity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={truckCapacity}
                onChange={(e) => setTruckCapacity(e.target.value)}
                placeholder="Enter number of bins truck can hold"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            {/* Quick Add Buttons */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-3 block">Add Tasks</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={addWarehouseStop}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 rounded-lg transition-all text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <Warehouse className="w-4 h-4" />
                  Warehouse Stop
                </button>
                <button
                  type="button"
                  onClick={openBinSelection}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 rounded-lg transition-all text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <Package className="w-4 h-4" />
                  Collection
                </button>
                <button
                  type="button"
                  onClick={openRouteImport}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 rounded-lg transition-all text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <List className="w-4 h-4" />
                  Import from Route
                </button>
                <button
                  type="button"
                  onClick={openPlacementSelection}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 rounded-lg transition-all text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <MapPinned className="w-4 h-4" />
                  Placement
                </button>
                <button
                  type="button"
                  onClick={openMoveRequestSelection}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 rounded-lg transition-all text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <MoveRight className="w-4 h-4" />
                  Move Request
                </button>
              </div>
            </div>

            {/* Smart Suggestions - Priority-Based Grouping */}
            {smartSuggestions.length > 0 && (
              <div className="space-y-3">
                {/* Critical Issues */}
                {smartSuggestions.filter(s => s.priority === 'critical').length > 0 && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚨</span>
                      <h3 className="text-sm font-semibold text-red-900">
                        Critical Issues ({smartSuggestions.filter(s => s.priority === 'critical').length})
                      </h3>
                    </div>
                    {smartSuggestions.filter(s => s.priority === 'critical').map((suggestion, index) => (
                      <div key={`crit-${index}`} className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {suggestion.action === 'add' && '➕ Add'}
                              {suggestion.action === 'update' && '✏️ Update'}
                              {suggestion.action === 'remove' && '🗑️ Remove'}
                              {' '}{suggestion.targetType === 'warehouse_load' ? 'Warehouse LOAD' : 'Warehouse UNLOAD'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => acceptSuggestion(suggestion)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
                          >
                            {suggestion.action === 'add' && 'Add'}
                            {suggestion.action === 'update' && 'Update'}
                            {suggestion.action === 'remove' && 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optimizations */}
                {smartSuggestions.filter(s => s.priority === 'optimization').length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <h3 className="text-sm font-semibold text-yellow-900">
                        Optimizations ({smartSuggestions.filter(s => s.priority === 'optimization').length})
                      </h3>
                    </div>
                    {smartSuggestions.filter(s => s.priority === 'optimization').map((suggestion, index) => (
                      <div key={`opt-${index}`} className="bg-white rounded-lg p-3 border border-yellow-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {suggestion.action === 'add' && '➕ Add'}
                              {suggestion.action === 'update' && '✏️ Update'}
                              {suggestion.action === 'remove' && '🗑️ Remove'}
                              {' '}{suggestion.targetType === 'warehouse_load' ? 'Warehouse LOAD' : 'Warehouse UNLOAD'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => acceptSuggestion(suggestion)}
                            className="px-3 py-1.5 bg-yellow-600 text-white rounded-md text-xs font-medium hover:bg-yellow-700 transition-colors whitespace-nowrap"
                          >
                            {suggestion.action === 'add' && 'Add'}
                            {suggestion.action === 'update' && 'Update'}
                            {suggestion.action === 'remove' && 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Info/Suggestions */}
                {smartSuggestions.filter(s => s.priority === 'info').length > 0 && (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💡</span>
                      <h3 className="text-sm font-semibold text-blue-900">
                        Suggestions ({smartSuggestions.filter(s => s.priority === 'info').length})
                      </h3>
                    </div>
                    {smartSuggestions.filter(s => s.priority === 'info').map((suggestion, index) => (
                      <div key={`info-${index}`} className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {suggestion.action === 'add' && '➕ Add'}
                              {suggestion.action === 'update' && '✏️ Update'}
                              {suggestion.action === 'remove' && '🗑️ Remove'}
                              {' '}{suggestion.targetType === 'warehouse_load' ? 'Warehouse LOAD' : 'Warehouse UNLOAD'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => acceptSuggestion(suggestion)}
                            className="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                          >
                            {suggestion.action === 'add' && 'Add'}
                            {suggestion.action === 'update' && 'Update'}
                            {suggestion.action === 'remove' && 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shift Analysis */}
            {tasks.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Shift Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Total Tasks:</span>
                    <span className="font-semibold text-blue-900">{shiftAnalysis.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Collections:</span>
                    <span className="font-semibold text-blue-900">{shiftAnalysis.collections}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Placements:</span>
                    <span className="font-semibold text-blue-900">{shiftAnalysis.placements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Warehouse Stops:</span>
                    <span className="font-semibold text-blue-900">{shiftAnalysis.warehouseStops}</span>
                  </div>
                </div>

                {/* Capacity Preview */}
                {truckCapacity && parseInt(truckCapacity) > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <h4 className="text-xs font-semibold text-blue-900 mb-2">Truck Capacity Preview</h4>
                    <div className="space-y-1.5">
                      {capacityFlow.slice(0, 10).map((flow, index) => {
                        const task = tasks[flow.taskIndex];
                        const capacity = parseInt(truckCapacity);
                        const isOverCapacity = flow.loadAfter > capacity;
                        const barWidth = Math.min(100, (flow.loadAfter / capacity) * 100);

                        // Task type icon and color
                        const getTaskIcon = () => {
                          if (task.type === 'collection') return '🧺';
                          if (task.type === 'placement') return '📍';
                          if (task.type === 'move_request') {
                            // Differentiate pickup vs dropoff
                            if (task.move_type === 'pickup') return '📤'; // Picking up bin from field
                            if (task.move_type === 'dropoff') return '📥'; // Dropping off bin at new location
                            return '🔄'; // Fallback for legacy data
                          }
                          if (task.type === 'warehouse_stop') {
                            return task.warehouse_action === 'load' ? '⬆️' : '⬇️';
                          }
                          return '📦';
                        };

                        // Bar color based on task type and capacity
                        const getBarColor = () => {
                          if (isOverCapacity) return 'bg-red-500';
                          if (task.type === 'collection') return 'bg-blue-400'; // Lighter for collections
                          return 'bg-green-500';
                        };

                        // Delta display
                        const deltaDisplay = flow.delta !== 0 ? (
                          <span className={`text-xs font-medium ${
                            flow.delta > 0 ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {flow.delta > 0 ? `+${flow.delta}` : flow.delta}
                          </span>
                        ) : null;

                        return (
                          <div key={index} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 w-8">#{index + 1}</span>
                              <span className="w-5 text-center" title={task.type}>{getTaskIcon()}</span>
                              <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${getBarColor()}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className={`w-12 text-right font-medium ${
                                isOverCapacity ? 'text-red-600' : 'text-gray-700'
                              }`}>
                                {flow.loadAfter}/{capacity}
                              </span>
                              {deltaDisplay && (
                                <span className="w-8 text-right">
                                  {deltaDisplay}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {capacityFlow.length > 10 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          +{capacityFlow.length - 10} more tasks...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task List */}
            {tasks.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-3 block">Task Sequence</label>
                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-move hover:shadow-md transition-all ${
                        draggedTaskIndex === index ? 'opacity-50' : ''
                      } ${dragOverIndex === index && draggedTaskIndex !== index ? 'border-blue-500 border-2 shadow-lg' : ''} ${
                        task.auto_inserted ? 'bg-blue-50 border-blue-200' : 'bg-white'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                          {task.type === 'warehouse_stop' && <Warehouse className="w-4 h-4 text-blue-600" />}
                          {task.type === 'collection' && <Package className="w-4 h-4 text-green-600" />}
                          {task.type === 'placement' && <MapPinned className="w-4 h-4 text-purple-600" />}
                          {task.type === 'pickup' && <ArrowUp className="w-4 h-4 text-orange-600" />}
                          {task.type === 'dropoff' && <ArrowDown className="w-4 h-4 text-orange-600" />}
                          <span className="text-sm font-medium capitalize">
                            {(task.type === 'pickup' || task.type === 'dropoff') && task.move_request_id
                              ? `${task.type} (Move Request)`
                              : task.type.replace('_', ' ')}
                          </span>
                          {task.auto_inserted && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                              Auto
                            </span>
                          )}
                        </div>

                        {/* Collection metadata */}
                        {task.type === 'collection' && (
                          <p className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">Bin #{task.bin_number}</span> - {task.address}
                          </p>
                        )}

                        {/* Placement metadata */}
                        {task.type === 'placement' && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.address}
                            {task.new_bin_number && <span className="ml-2 font-medium">(New Bin #{task.new_bin_number})</span>}
                          </p>
                        )}

                        {/* Move Request metadata */}
                        {(task.type === 'pickup' || task.type === 'dropoff') && task.move_request_id && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.type === 'pickup' ? (
                              <>
                                <span className="font-medium">Pick up Bin #{task.bin_number}</span> from {task.address}
                              </>
                            ) : (
                              <>
                                <span className="font-medium">Drop off Bin #{task.bin_number}</span> at {task.destination_address}
                              </>
                            )}
                          </p>
                        )}

                        {/* Warehouse metadata */}
                        {task.type === 'warehouse_stop' && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.warehouse_action === 'load' ? 'Load' : 'Unload'} {task.bins_to_load || 'all'} bin(s) - {task.address}
                            {task.auto_inserted && <span className="ml-2 text-blue-600">(Auto-inserted)</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditTask(index)}
                          className="text-blue-500 hover:text-blue-700 transition-fast"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTask(index)}
                          className="text-red-500 hover:text-red-700 transition-fast"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No tasks added yet</p>
                <p className="text-xs text-gray-400 mt-1">Use the buttons above to add tasks to your shift</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !driverId || !truckCapacity || tasks.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Shift'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Bin Selection Map Modal */}
      {showBinSelection && (
        <BinSelectionMap
          onClose={() => setShowBinSelection(false)}
          onConfirm={handleBinSelectionConfirm}
          initialSelectedBins={[]}
        />
      )}

      {/* Route Import Modal */}
      {showRouteImport && (
        <RouteSelectionMap
          onClose={() => setShowRouteImport(false)}
          onConfirm={handleRouteSelection}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && editingTaskIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Task</h3>
              <button
                onClick={cancelEditTask}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Common Fields */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
                <input
                  type="text"
                  value={editingTask.address || ''}
                  onChange={(e) => handleEditTaskChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingTask.latitude || ''}
                    onChange={(e) => handleEditTaskChange('latitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingTask.longitude || ''}
                    onChange={(e) => handleEditTaskChange('longitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Collection Fields */}
              {editingTask.type === 'collection' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bin Number</label>
                    <input
                      type="text"
                      value={editingTask.bin_number || ''}
                      onChange={(e) => handleEditTaskChange('bin_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Fill Percentage</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTask.fill_percentage || ''}
                      onChange={(e) => handleEditTaskChange('fill_percentage', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </>
              )}

              {/* Warehouse Stop Fields */}
              {editingTask.type === 'warehouse_stop' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Action</label>
                    <select
                      value={editingTask.warehouse_action || 'load'}
                      onChange={(e) => handleEditTaskChange('warehouse_action', e.target.value as 'load' | 'unload')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="load">Load</option>
                      <option value="unload">Unload</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bins to {editingTask.warehouse_action === 'load' ? 'Load' : 'Unload'}</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTask.bins_to_load || ''}
                      onChange={(e) => handleEditTaskChange('bins_to_load', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </>
              )}

              {/* Placement Fields */}
              {editingTask.type === 'placement' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">New Bin Number</label>
                  <input
                    type="text"
                    value={editingTask.new_bin_number || ''}
                    onChange={(e) => handleEditTaskChange('new_bin_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              )}

              {/* Move Request Fields */}
              {editingTask.type === 'move_request' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Move Type</label>
                    <select
                      value={editingTask.move_type || 'pickup'}
                      onChange={(e) => handleEditTaskChange('move_type', e.target.value as 'pickup' | 'dropoff')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="pickup">Pickup</option>
                      <option value="dropoff">Dropoff</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Destination Address</label>
                    <input
                      type="text"
                      value={editingTask.destination_address || ''}
                      onChange={(e) => handleEditTaskChange('destination_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelEditTask}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedTask}
                className="flex-1 px-4 py-2 bg-primary rounded-lg text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placement Selection Modal - Map-Based */}
      {showPlacementSelection && (
        <PlacementLocationSelectionMap
          onClose={() => setShowPlacementSelection(false)}
          onConfirm={handlePlacementSelectionConfirm}
          potentialLocations={potentialLocations}
        />
      )}

      {/* Move Request Selection Modal - Map-Based */}
      {showMoveRequestSelection && (
        <MoveRequestSelectionMap
          onClose={() => setShowMoveRequestSelection(false)}
          onConfirm={handleMoveRequestSelectionConfirm}
          moveRequests={moveRequests}
        />
      )}
    </div>
  );
}

// Live Ops View Component - Command Center
function LiveOpsView({ shifts }: { shifts: Shift[] }) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Get auth token from Zustand store
  const { token } = useAuthStore();

  // Use active drivers hook for real-time data
  const { drivers: driversData, isLoading, error, wsStatus } = useActiveDrivers({
    token: token || undefined,
    enabled: true,
  });

  // ALWAYS ensure drivers is an array
  const drivers = Array.isArray(driversData) ? driversData : [];

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 280px)' }}>
      {/* Left Panel - Driver Fleet */}
      <div className="w-80 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm">
        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Drivers</h2>
              <p className="text-sm text-gray-600 mt-1">
                {drivers.length} driver{drivers.length !== 1 ? 's' : ''} on duty
              </p>
            </div>
            {/* WebSocket status indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-green-500 animate-pulse'
                    : wsStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-400'
                }`}
                title={`WebSocket: ${wsStatus}`}
              />
              <span className="text-xs text-gray-500">
                {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error ? (
            <div className="text-center py-12 px-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-600 font-medium">Failed to load drivers</p>
                <p className="text-xs text-red-500 mt-1">{error.message}</p>
              </div>
              {!token && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-700 font-medium">Authentication Required</p>
                  <p className="text-xs text-yellow-600 mt-1">Please log in to view live driver tracking</p>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-500">Loading drivers...</p>
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No active shifts</p>
              <p className="text-xs text-gray-400 mt-1">Drivers will appear here when they start their shifts</p>
            </div>
          ) : (
            drivers.map((driver, index) => {
              // Handle different field names from API
              const driverId = driver.driverId || driver.driver_id || driver.id || `driver-${index}`;
              return (
                <DriverCard
                  key={driverId}
                  driver={driver}
                  isSelected={driverId === selectedDriverId}
                  onClick={() => setSelectedDriverId(driverId)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Live Map */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl relative shadow-sm overflow-hidden">
        <LiveOpsMap
          drivers={drivers}
          isLoading={isLoading}
          selectedDriverId={selectedDriverId}
          onDriverClick={setSelectedDriverId}
        />
      </div>
    </div>
  );
}

// Driver Card Component for Live Ops
function DriverCard({
  driver,
  isSelected,
  onClick,
}: {
  driver: ActiveDriver;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Log the driver data to see what we're getting
  console.log('🚗 Driver Card Data:', driver);

  const progressPercentage =
    driver.completedBins && driver.totalBins
      ? Math.round((driver.completedBins / driver.totalBins) * 100)
      : 0;

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-600' };
      case 'paused':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-600' };
      case 'inactive':
      case 'ended':
        return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-600' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-600' };
    }
  };

  const statusColor = getStatusColor(driver.status || 'inactive');

  // Format last update time
  const getLastUpdateTime = () => {
    if (!driver.lastLocationUpdate) return 'No location data';

    try {
      const updateTime = new Date(driver.lastLocationUpdate);

      // Check if valid date
      if (isNaN(updateTime.getTime())) {
        return 'Just now';
      }

      const now = new Date();
      const diffMs = now.getTime() - updateTime.getTime();
      const diffSecs = Math.floor(diffMs / 1000);

      if (diffSecs < 0) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      return `${Math.floor(diffSecs / 3600)}h ago`;
    } catch (error) {
      console.error('Error parsing timestamp:', error, driver.lastLocationUpdate);
      return 'Just now';
    }
  };

  // Get initials safely
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const driverName = driver.driverName || 'Unknown Driver';
  const routeName = driver.routeName || 'No route assigned';

  return (
    <div
      className={`bg-white border-2 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${
        isSelected ? 'border-primary shadow-md' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      {/* Driver Info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
          {getInitials(driverName)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{driverName}</h3>
          <p className="text-xs text-gray-600">{routeName}</p>
        </div>
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-1 ${statusColor.bg} ${statusColor.text} rounded-full text-xs font-medium`}>
            <span className={`w-2 h-2 ${statusColor.dot} rounded-full ${driver.status === 'active' ? 'animate-pulse' : ''}`} />
            {driver.status ? driver.status.charAt(0).toUpperCase() + driver.status.slice(1) : 'Unknown'}
          </span>
        </div>
      </div>

      {/* Progress */}
      {driver.totalBins && driver.totalBins > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">
              {driver.completedBins || 0}/{driver.totalBins} bins ({progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Location Info */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-600">
          <MapPin className="w-3 h-3" />
          <span>{getLastUpdateTime()}</span>
        </div>
        {driver.currentLocation?.speed !== undefined && (
          <span className="text-gray-600">{Math.round(driver.currentLocation.speed)} km/h</span>
        )}
      </div>
    </div>
  );
}
