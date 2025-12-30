'use client';

import { Route } from '@/lib/types/route';
import { Package, Clock, MapPin, Calendar } from 'lucide-react';

interface RoutesTableProps {
  routes: Route[];
  onRouteClick: (route: Route) => void;
  selectedRouteId?: string | null;
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

export function RoutesTable({ routes, onRouteClick, selectedRouteId }: RoutesTableProps) {
  if (routes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No routes found</h3>
        <p className="text-gray-600">Create your first route blueprint to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <div className="col-span-1"></div> {/* Color indicator */}
          <div className="col-span-3">Route Name</div>
          <div className="col-span-2">Geographic Area</div>
          <div className="col-span-2">Bins</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-2">Schedule</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100">
        {routes.map((route, index) => {
          const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];
          const isSelected = selectedRouteId === route.id;

          return (
            <div
              key={route.id}
              onClick={() => onRouteClick(route)}
              className={`grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-50 border-l-4'
                  : 'hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}
              style={{
                borderLeftColor: isSelected ? routeColor : 'transparent',
              }}
            >
              {/* Color Indicator */}
              <div className="col-span-1 flex items-center">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: routeColor }}
                  title={`Route ${index + 1}`}
                />
              </div>

              {/* Route Name */}
              <div className="col-span-3 flex flex-col justify-center min-w-0">
                <p className={`font-semibold truncate ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                  {route.name}
                </p>
                {route.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{route.description}</p>
                )}
              </div>

              {/* Geographic Area */}
              <div className="col-span-2 flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{route.geographic_area}</span>
              </div>

              {/* Bins */}
              <div className="col-span-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-900 font-semibold">{route.bin_count}</span>
                <span className="text-xs text-gray-500">bins</span>
              </div>

              {/* Duration */}
              <div className="col-span-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-900 font-semibold">{route.estimated_duration_hours}h</span>
              </div>

              {/* Schedule */}
              <div className="col-span-2 flex items-center gap-2">
                {route.schedule_pattern ? (
                  <>
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="px-2.5 py-1 bg-blue-50 text-primary text-xs font-medium rounded-full">
                      {route.schedule_pattern}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">No schedule</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
