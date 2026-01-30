'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Package, Calendar, Edit, Trash2, Copy } from 'lucide-react';
import { Route } from '@/lib/types/route';
import { RouteMapView } from './route-map-view';
import { getBins } from '@/lib/api/bins';
import { Bin } from '@/lib/types/bin';

// Format duration: show minutes if < 1 hour, otherwise show hours
const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)}h`;
};

interface RouteDetailsDrawerProps {
  route: Route;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function RouteDetailsDrawer({ route, onClose, onEdit, onDelete, onDuplicate }: RouteDetailsDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [routeBins, setRouteBins] = useState<Bin[]>([]);
  const [loadingBins, setLoadingBins] = useState(true);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Load bin details - preserve route order
  useEffect(() => {
    async function loadBinDetails() {
      try {
        setLoadingBins(true);
        const allBins = await getBins();
        // Map over route.bin_ids to preserve optimized order
        const bins = route.bin_ids
          .map(binId => allBins.find(bin => bin.id === binId))
          .filter((bin): bin is Bin => bin !== undefined);
        setRouteBins(bins);
      } catch (error) {
        console.error('Failed to load bin details:', error);
      } finally {
        setLoadingBins(false);
      }
    }
    loadBinDetails();
  }, [route.bin_ids]);

  return (
    <>
      {/* Overlay */}
      <div className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 w-full md:max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{route.name}</h2>
            {route.description && (
              <p className="text-sm text-gray-600">{route.description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-fast"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Key Metrics */}
          <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 md:mb-4">Route Metrics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Total Bins</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{route.bin_count}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Est. Duration</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(route.estimated_duration_hours)}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Geographic Area</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">{route.geographic_area}</p>
              </div>

              {route.schedule_pattern && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Schedule Pattern</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{route.schedule_pattern}</p>
                </div>
              )}
            </div>
          </div>

          {/* Route Map Preview */}
          <div className="p-4 md:p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Route Visualization</h3>
            <div className="w-full h-64 md:h-96 rounded-lg overflow-hidden border border-gray-200">
              <RouteMapView route={route} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Animated route path showing {route.bin_count} bins across {route.geographic_area}
            </p>
          </div>

          {/* Assigned Bins */}
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Assigned Bins ({route.bin_count})</h3>
              <button className="text-sm text-primary hover:text-primary/80 font-medium transition-fast">
                View All Bins
              </button>
            </div>

            {/* Last Used Attribution */}
            <div className="mb-4 text-xs text-gray-500">
              <span>Last completed by </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-gray-700">Omar Gabr</span>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[8px] font-semibold">
                  OG
                </div>
              </span>
              <span> on Dec 26</span>
            </div>

            {loadingBins ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : routeBins.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">No bins assigned yet</p>
                <p className="text-xs text-gray-500">Use the bin selection tool to assign bins to this route</p>
              </div>
            ) : (
              <div className="space-y-2">
                {routeBins.slice(0, 5).map((bin, index) => {
                  const fillPercentage = bin.fill_percentage ?? 0;
                  const fillBadgeStyle = fillPercentage >= 80
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : fillPercentage >= 50
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                    : 'bg-green-100 text-green-700 border-green-200';

                  return (
                    <div
                      key={bin.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-fast"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">Bin #{bin.bin_number}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {bin.location_name || `${bin.current_street}, ${bin.city}`}
                        </p>
                      </div>
                      <div>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${fillBadgeStyle}`}>
                          {fillPercentage}% Fill
                        </span>
                      </div>
                    </div>
                  );
                })}
                {routeBins.length > 5 && (
                  <button className="w-full py-2 text-sm text-primary hover:text-primary/80 font-medium transition-fast">
                    Show {routeBins.length - 5} more bins
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 md:mb-4">Usage Statistics</h3>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Times Used</p>
                <p className="text-xl font-bold text-gray-900">0</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Avg. Completion</p>
                <p className="text-xl font-bold text-gray-900">-</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                <p className="text-xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="border-t border-gray-200 p-3 md:p-4 bg-gray-50 flex flex-col sm:flex-row gap-2 md:gap-3 shrink-0">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-fast flex items-center justify-center gap-2 h-10 md:h-auto"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm md:text-base">Edit Route</span>
          </button>
          <button
            onClick={onDuplicate}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-fast flex items-center justify-center gap-2 h-10 md:h-auto"
          >
            <Copy className="w-4 h-4" />
            <span className="text-sm md:text-base">Duplicate</span>
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast flex items-center justify-center gap-2 h-10 md:h-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm md:text-base">Delete Route</span>
          </button>
        </div>
      </div>
    </>
  );
}
