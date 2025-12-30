'use client';

import { X, Search, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface RouteFilters {
  schedules: string[];
  binCountMin: number | null;
  binCountMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  containsBinNumber: string;
  geographicAreas: string[];
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: RouteFilters;
  onFiltersChange: (filters: RouteFilters) => void;
  onClearAll: () => void;
  matchingRoutesCount: number;
  availableSchedules: string[];
  availableAreas: string[];
  isExternalClosing?: boolean;
}

export function FilterDrawer({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onClearAll,
  matchingRoutesCount,
  availableSchedules,
  availableAreas,
  isExternalClosing = false,
}: FilterDrawerProps) {
  const [isGeographyOpen, setIsGeographyOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Handle close animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // Match animation duration
  };

  if (!isOpen && !isClosing && !isExternalClosing) return null;

  const handleScheduleToggle = (schedule: string) => {
    const newSchedules = filters.schedules.includes(schedule)
      ? filters.schedules.filter(s => s !== schedule)
      : [...filters.schedules, schedule];
    onFiltersChange({ ...filters, schedules: newSchedules });
  };

  const handleAreaToggle = (area: string) => {
    const newAreas = filters.geographicAreas.includes(area)
      ? filters.geographicAreas.filter(a => a !== area)
      : [...filters.geographicAreas, area];
    onFiltersChange({ ...filters, geographicAreas: newAreas });
    setIsGeographyOpen(false);
  };

  const removeArea = (area: string) => {
    onFiltersChange({
      ...filters,
      geographicAreas: filters.geographicAreas.filter(a => a !== area)
    });
  };

  return (
    <>
      {/* Drawer */}
      <div className={`absolute top-0 right-0 h-full w-[380px] bg-white border-l border-gray-200 z-50 flex flex-col ${(isClosing || isExternalClosing) ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Filters</h2>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold hover:bg-red-100 transition-all inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear All
          </button>
        </div>

        {/* Filter Sections - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">

          {/* Schedule Filter */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Schedule</h3>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3">
              {/* Row 1 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Mon')}
                  onChange={() => handleScheduleToggle('Mon')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Mon</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Tue')}
                  onChange={() => handleScheduleToggle('Tue')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Tue</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Wed')}
                  onChange={() => handleScheduleToggle('Wed')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Wed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Thu')}
                  onChange={() => handleScheduleToggle('Thu')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Thu</span>
              </label>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Fri')}
                  onChange={() => handleScheduleToggle('Fri')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Fri</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Sat')}
                  onChange={() => handleScheduleToggle('Sat')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Sat</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.schedules.includes('Sun')}
                  onChange={() => handleScheduleToggle('Sun')}
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-sm text-gray-700 font-medium">Sun</span>
              </label>
            </div>
          </div>

          {/* Metrics Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Metrics</h3>

            {/* Bin Count Slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Bin Count</span>
                <span className="text-sm font-bold text-gray-900">
                  {filters.binCountMin ?? 0} - {filters.binCountMax ?? 100} bins
                </span>
              </div>

              {/* Slider Container */}
              <div className="relative h-6 flex items-center">
                {/* Full Gray Track */}
                <div className="absolute left-0 right-0 h-1.5 bg-gray-300 rounded-full top-1/2 -translate-y-1/2" />

                {/* Blue Fill Between Thumbs */}
                <div
                  className="absolute h-1.5 bg-primary rounded-full top-1/2 -translate-y-1/2"
                  style={{
                    left: `${((filters.binCountMin ?? 0) / 100) * 100}%`,
                    width: `${((filters.binCountMax ?? 100) - (filters.binCountMin ?? 0)) / 100 * 100}%`
                  }}
                />

                {/* Min Range Input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.binCountMin ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val <= (filters.binCountMax ?? 100)) {
                      onFiltersChange({ ...filters, binCountMin: val });
                    }
                  }}
                  className="range-slider-thumb absolute w-full top-1/2 -translate-y-1/2"
                  style={{ zIndex: filters.binCountMin ?? 0 > 50 ? 5 : 3 }}
                />

                {/* Max Range Input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.binCountMax ?? 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= (filters.binCountMin ?? 0)) {
                      onFiltersChange({ ...filters, binCountMax: val });
                    }
                  }}
                  className="range-slider-thumb absolute w-full top-1/2 -translate-y-1/2"
                  style={{ zIndex: 4 }}
                />
              </div>

              {/* Labels Below */}
              <div className="flex justify-between text-xs text-gray-500 px-0.5">
                <span>{filters.binCountMin ?? 0}</span>
                <span>bins</span>
              </div>
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Duration</span>
                <span className="text-sm font-bold text-gray-900">
                  {filters.durationMin ?? 0} - {filters.durationMax ?? 12} hours
                </span>
              </div>

              {/* Slider Container */}
              <div className="relative h-6 flex items-center">
                {/* Full Gray Track */}
                <div className="absolute left-0 right-0 h-1.5 bg-gray-300 rounded-full top-1/2 -translate-y-1/2" />

                {/* Blue Fill Between Thumbs */}
                <div
                  className="absolute h-1.5 bg-primary rounded-full top-1/2 -translate-y-1/2"
                  style={{
                    left: `${((filters.durationMin ?? 0) / 12) * 100}%`,
                    width: `${((filters.durationMax ?? 12) - (filters.durationMin ?? 0)) / 12 * 100}%`
                  }}
                />

                {/* Min Range Input */}
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={filters.durationMin ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val <= (filters.durationMax ?? 12)) {
                      onFiltersChange({ ...filters, durationMin: val });
                    }
                  }}
                  className="range-slider-thumb absolute w-full top-1/2 -translate-y-1/2"
                  style={{ zIndex: filters.durationMin ?? 0 > 6 ? 5 : 3 }}
                />

                {/* Max Range Input */}
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={filters.durationMax ?? 12}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val >= (filters.durationMin ?? 0)) {
                      onFiltersChange({ ...filters, durationMax: val });
                    }
                  }}
                  className="range-slider-thumb absolute w-full top-1/2 -translate-y-1/2"
                  style={{ zIndex: 4 }}
                />
              </div>

              {/* Labels Below */}
              <div className="flex justify-between text-xs text-gray-500 px-0.5">
                <span>{filters.durationMin ?? 0}</span>
                <span>hours</span>
              </div>
            </div>
          </div>

          {/* Geography Section */}
          <div className="border-t border-gray-200 pt-6 hidden">
            <h3 className="text-base font-bold text-gray-900 mb-3">Geography</h3>

            {/* Selected areas as chips */}
            {filters.geographicAreas.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {filters.geographicAreas.map((area) => (
                  <div
                    key={area}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full mr-1.5"
                  >
                    <span className="text-xs text-gray-900 font-medium">{area}</span>
                    <button
                      onClick={() => removeArea(area)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsGeographyOpen(!isGeographyOpen)}
                className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-2xl text-sm text-gray-400 text-left flex items-center justify-between hover:border-gray-400 transition-colors"
              >
                <span>Select area...</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isGeographyOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isGeographyOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {availableAreas
                    .filter(area => !filters.geographicAreas.includes(area))
                    .map(area => (
                      <button
                        key={area}
                        onClick={() => handleAreaToggle(area)}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {area}
                      </button>
                    ))}
                  {availableAreas.filter(area => !filters.geographicAreas.includes(area)).length === 0 && (
                    <div className="px-4 py-2.5 text-sm text-gray-400">No more areas available</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contains Specific Bin */}
          <div className="border-t border-gray-200 pt-6 pb-2">
            <h3 className="text-base font-bold text-gray-900 mb-3">Contains Specific Bin</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Contains Specific Bin"
                value={filters.containsBinNumber}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  containsBinNumber: e.target.value
                })}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-0 focus:border-primary placeholder:text-gray-400 bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full font-bold transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-full font-bold transition-all shadow-sm text-sm"
            >
              Show {matchingRoutesCount} {matchingRoutesCount === 1 ? 'Route' : 'Routes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
