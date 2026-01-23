'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, List, User, X, Search, ChevronDown, Filter, MapPin, Loader2 } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel, ShiftStatus } from '@/lib/types/shift';
import { ShiftDetailsDrawer } from './shift-details-drawer';
import { BinSelectionMap } from './bin-selection-map';
import { Route, getRouteLabel } from '@/lib/types/route';
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
  const [viewMode, setViewMode] = useState<ViewMode>('live');
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
          assignRouteMutation={assignRouteMutation}
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

// Create Shift Drawer Component
function CreateShiftDrawer({
  onClose,
  assignRouteMutation,
}: {
  onClose: () => void;
  assignRouteMutation: ReturnType<typeof useAssignRoute>;
}) {
  const { data: routes = [], isLoading: loadingRoutes } = useRoutes();
  const { data: drivers = [], isLoading: loadingDrivers } = useDrivers();
  const [formData, setFormData] = useState({
    date: '2025-12-28',
    driverId: '',
    selectionType: 'route' as 'route' | 'custom',
    routeId: '',
    selectedBins: [] as string[],
  });
  const [showBinSelection, setShowBinSelection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const [isDriverClosing, setIsDriverClosing] = useState(false);
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

  // Get selected driver info
  const selectedDriver = drivers.find(d => d.id === formData.driverId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Get bin IDs based on selection type
      let binIds: string[] = [];

      if (formData.selectionType === 'route') {
        // Use bins from selected route
        const selectedRoute = routes.find(r => r.id === formData.routeId);
        if (!selectedRoute || !selectedRoute.bin_ids) {
          throw new Error('Selected route has no bins');
        }
        binIds = selectedRoute.bin_ids;
      } else {
        // Use custom selected bins
        binIds = formData.selectedBins;
      }

      if (binIds.length === 0) {
        throw new Error('No bins selected');
      }

      // Call backend API to assign route (create shift) with React Query mutation
      await assignRouteMutation.mutateAsync({
        driver_id: formData.driverId,
        route_id: formData.routeId || 'custom',
        bin_ids: binIds,
      });

      // Success! Close drawer
      onClose();
    } catch (err) {
      console.error('Failed to create shift:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shift. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBinSelectionConfirm = (selectedBinIds: string[]) => {
    setFormData({ ...formData, selectedBins: selectedBinIds });
  };

  // Get selected route for display
  const selectedRoute = routes.find(r => r.id === formData.routeId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Schedule New Shift</h2>
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
            {/* Step 1: Date */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  1
                </div>
                <label className="text-sm font-semibold text-gray-900">Date</label>
              </div>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            {/* Step 2: Driver */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  2
                </div>
                <label className="text-sm font-semibold text-gray-900">Driver</label>
              </div>

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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedDriver.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : selectedDriver.status === 'on-shift'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedDriver.status === 'available' ? 'Available' :
                           selectedDriver.status === 'on-shift' ? 'On Shift' : 'Unavailable'}
                        </span>
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
                        <p className="text-xs text-gray-400 mt-1">Please add drivers to continue</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {drivers.map((driver) => (
                          <button
                            key={driver.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, driverId: driver.id });
                              closeDriverDropdown();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-fast ${
                              formData.driverId === driver.id ? 'bg-primary/5 border border-primary/20' : ''
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {driver.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{driver.name}</p>
                              <p className="text-xs text-gray-500 truncate">{driver.email}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                              driver.status === 'available'
                                ? 'bg-green-100 text-green-700'
                                : driver.status === 'on-shift'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {driver.status === 'available' ? 'Available' :
                               driver.status === 'on-shift' ? 'On Shift' : 'Unavailable'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Bin Assignment */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  3
                </div>
                <label className="text-sm font-semibold text-gray-900">Bin Assignment</label>
              </div>

              {/* Selection Type Radio Buttons */}
              <div className="space-y-3">
                {/* Option A: Use Existing Route */}
                <div
                  onClick={() => setFormData({ ...formData, selectionType: 'route', selectedBins: [] })}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.selectionType === 'route'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={formData.selectionType === 'route'}
                      onChange={() => {}}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900">Use existing route</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">
                        Select a pre-defined route template with optimized bin assignments
                      </p>

                      {formData.selectionType === 'route' && (
                        <div className="animate-slide-in-down">
                          {loadingRoutes ? (
                            <div className="flex items-center justify-center py-2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <select
                              value={formData.routeId}
                              onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              required={formData.selectionType === 'route'}
                            >
                              <option value="">Select route...</option>
                              {routes.map((route) => (
                                <option key={route.id} value={route.id}>
                                  {getRouteLabel(route)} • {route.geographic_area} • {route.schedule_pattern}
                                </option>
                              ))}
                            </select>
                          )}

                          {selectedRoute && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>~{selectedRoute.estimated_duration_hours}h • {selectedRoute.description}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Option B: Custom Bin Selection */}
                <div
                  onClick={() => setFormData({ ...formData, selectionType: 'custom', routeId: '' })}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.selectionType === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={formData.selectionType === 'custom'}
                      onChange={() => {}}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-1">Custom bin selection</p>
                      <p className="text-xs text-gray-600 mb-3">
                        One-time job: manually select specific bins using the map
                      </p>

                      {formData.selectionType === 'custom' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowBinSelection(true);
                          }}
                          className="w-full border-2 border-dashed border-gray-300 hover:border-primary rounded-lg p-6 text-center transition-all hover:bg-gray-50 animate-slide-in-down"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                            </div>
                            {formData.selectedBins.length === 0 ? (
                              <>
                                <p className="text-sm font-medium text-gray-900">Select Bins on Map</p>
                                <p className="text-xs text-gray-500">Click to open map with lasso select</p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-primary">{formData.selectedBins.length} bins selected</p>
                                <p className="text-xs text-gray-500">Click to modify selection</p>
                              </>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {/* Error message */}
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
                disabled={
                  isSubmitting ||
                  !formData.driverId ||
                  (formData.selectionType === 'route' && !formData.routeId) ||
                  (formData.selectionType === 'custom' && formData.selectedBins.length === 0)
                }
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
          initialSelectedBins={formData.selectedBins}
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
