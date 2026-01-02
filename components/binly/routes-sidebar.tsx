'use client';

import { useState, useEffect, useRef } from 'react';
import { Route } from '@/lib/types/route';
import { Package, Clock, MapPin, Calendar, Search, X, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

// Format duration: show minutes if < 1 hour, otherwise show hours
const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)}h`;
};

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'bins-asc'
  | 'bins-desc'
  | 'duration-asc'
  | 'duration-desc';

interface RoutesSidebarProps {
  routes: Route[];
  selectedRouteId?: string | null;
  visibleRouteIds?: Set<string>;
  onRouteSelect: (route: Route) => void;
  onViewDetails: (route: Route) => void;
  onRouteHover?: (routeId: string | null) => void;
  onShowAll?: () => void;
  onClearAll?: () => void;
}

// Route colors matching the map view
const ROUTE_COLORS = [
  '#4880FF', // Primary blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#EC4899', // Pink
];

export function RoutesSidebar({ routes, selectedRouteId, visibleRouteIds, onRouteSelect, onViewDetails, onRouteHover, onShowAll, onClearAll }: RoutesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isClosingDropdown, setIsClosingDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        if (isSortDropdownOpen) {
          handleCloseDropdown();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  // Filter routes based on search query
  const searchedRoutes = routes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort routes based on selected option
  const filteredRoutes = [...searchedRoutes].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'bins-asc':
        return a.bin_count - b.bin_count;
      case 'bins-desc':
        return b.bin_count - a.bin_count;
      case 'duration-asc':
        return a.estimated_duration_hours - b.estimated_duration_hours;
      case 'duration-desc':
        return b.estimated_duration_hours - a.estimated_duration_hours;
      default:
        return 0;
    }
  });

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'bins-asc', label: 'Bin Count (Low-High)' },
    { value: 'bins-desc', label: 'Bin Count (High-Low)' },
    { value: 'duration-asc', label: 'Duration (Short-Long)' },
    { value: 'duration-desc', label: 'Duration (Long-Short)' },
  ];

  const handleCloseDropdown = () => {
    setIsClosingDropdown(true);
    setTimeout(() => {
      setIsClosingDropdown(false);
      setIsSortDropdownOpen(false);
    }, 150); // Match animation duration
  };

  // Collapsed state - slim vertical bar
  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 h-full transition-all">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors mb-2"
          title="Expand routes list"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="transform -rotate-90 whitespace-nowrap text-xs font-semibold text-gray-500">
            Routes ({routes.length})
          </div>
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 p-6 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-1">No routes</p>
          <p className="text-xs text-gray-500">Create your first route</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full transition-all">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              title="Collapse routes list"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 whitespace-nowrap">Route List</h2>
              <p className="text-xs text-gray-500">{routes.length} route{routes.length !== 1 ? 's' : ''} total</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => {
                  if (isSortDropdownOpen) {
                    handleCloseDropdown();
                  } else {
                    setIsSortDropdownOpen(true);
                  }
                }}
                className="p-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                title="Sort routes"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>

              {(isSortDropdownOpen || isClosingDropdown) && (
                <div className={`absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[180px] ${isClosingDropdown ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        handleCloseDropdown();
                      }}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        sortBy === option.value ? 'bg-blue-50 text-primary font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onShowAll && (
              <button
                onClick={onShowAll}
                className="px-2 py-1 bg-blue-50 text-primary rounded-full text-[10px] font-bold hover:bg-blue-100 transition-all whitespace-nowrap"
                title="Show all routes on map"
              >
                Show All
              </button>
            )}
            {onClearAll && visibleRouteIds && visibleRouteIds.size > 0 && (
              <button
                onClick={onClearAll}
                className="px-2 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold hover:bg-red-100 transition-all whitespace-nowrap"
                title="Clear all routes from map"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Route Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search routes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Route Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredRoutes.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No routes found</p>
            <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
          </div>
        ) : (
          filteredRoutes.map((route, index) => {
          const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];
          const isSelected = selectedRouteId === route.id;
          const isVisible = visibleRouteIds?.has(route.id);

          return (
            <div
              key={route.id}
              onClick={() => onRouteSelect(route)}
              className={`relative rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                isVisible
                  ? isSelected
                    ? 'border-[#5E9646] border-[3px] bg-[#F4F7F4] shadow-[0_4px_12px_rgba(94,150,70,0.15)]' // Selected & visible - darker green, elegant shadow
                    : 'border-[#8BA888] border-2 bg-[#F4F7F4] shadow-[0_2px_8px_rgba(139,168,136,0.12)]' // Just visible - lighter green, subtle shadow
                  : 'border-gray-200 border-2 bg-white hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)]' // Not visible
              }`}
            >
              {/* Color indicator bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                style={{ backgroundColor: routeColor }}
              />

              {/* Route Name */}
              <div className="mb-2 pl-3">
                <h3 className={`font-semibold text-sm ${isVisible ? 'text-[#5E9646]' : 'text-gray-900'}`}>
                  {route.name}
                </h3>
              </div>

              {/* Quick Stats - Compact */}
              <div className="grid grid-cols-2 gap-2 mb-2 pl-3">
                <div className="flex items-center gap-1.5 bg-white/50 rounded-md px-2 py-1">
                  <Package className="w-3.5 h-3.5 text-gray-500" />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{route.bin_count}</span>
                    <span className="text-xs text-gray-500 ml-0.5">bins</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white/50 rounded-md px-2 py-1">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{formatDuration(route.estimated_duration_hours)}</span>
                  </div>
                </div>
              </div>

              {/* Geographic Area & Schedule - Compact Badges */}
              <div className="flex flex-wrap gap-1.5 mb-2 pl-3">
                <div className="flex items-center gap-1 bg-gray-100/80 rounded px-1.5 py-0.5">
                  <MapPin className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-700 font-medium">{route.geographic_area}</span>
                </div>
                {route.schedule_pattern && (
                  <div className="flex items-center gap-1 bg-blue-50/80 rounded px-1.5 py-0.5">
                    <Calendar className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary font-semibold">{route.schedule_pattern}</span>
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails(route);
                }}
                className={`mt-1 w-full py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isVisible
                    ? 'bg-[#5E9646] text-white hover:bg-[#4d7a38] shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                View Details
              </button>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
