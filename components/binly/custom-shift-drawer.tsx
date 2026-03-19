'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  User,
  ClipboardCheck,
  Camera,
  Clock,
  ChevronUp,
  Warehouse,
  CalendarClock,
  MapPin,
} from 'lucide-react';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { useAuthStore } from '@/lib/auth/store';
import { useQueryClient } from '@tanstack/react-query';
import { shiftKeys } from '@/lib/hooks/use-shifts';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails } from '@/lib/services/geocoding.service';

interface ServiceStop {
  address: string;
  latitude: number;
  longitude: number;
  taskLabel: string;
  taskDescription: string;
  photoRequired: boolean;
  hasTimeWindow: boolean;
  earliestArrival: string;
  latestArrival: string;
  serviceDurationMinutes: number;
}

function createEmptyStop(): ServiceStop {
  return {
    address: '',
    latitude: 0,
    longitude: 0,
    taskLabel: '',
    taskDescription: '',
    photoRequired: true,
    hasTimeWindow: false,
    earliestArrival: '',
    latestArrival: '',
    serviceDurationMinutes: 5,
  };
}

export function CustomShiftDrawer({
  onClose,
}: {
  onClose: () => void;
}) {
  const { data: drivers = [], isLoading: loadingDrivers } =
    useDrivers();
  const { data: warehouse } = useWarehouseLocation();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  // Form state
  const [driverId, setDriverId] = useState('');
  const [shiftLabel, setShiftLabel] = useState('');
  const [stops, setStops] = useState<ServiceStop[]>([
    createEmptyStop(),
  ]);

  // Start location — simple checkbox
  const [startAtWarehouse, setStartAtWarehouse] =
    useState(false);

  // Final destination
  const [endAddress, setEndAddress] = useState('');
  const [endLat, setEndLat] = useState(0);
  const [endLon, setEndLon] = useState(0);
  const [endAtWarehouse, setEndAtWarehouse] =
    useState(false);

  // Shift deadline (vehicle latest_end constraint)
  const [finishBy, setFinishBy] = useState('');

  // UI state
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] =
    useState(false);
  const [isDriverClosing, setIsDriverClosing] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStopIndex, setExpandedStopIndex] = useState<
    number | null
  >(0);

  const driverDropdownRef = useRef<HTMLDivElement>(null);
  const selectedDriver = drivers.find(
    (d) => d.id === driverId,
  );

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
        !driverDropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        closeDriverDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
  }, [isDriverDropdownOpen]);

  // Update a stop at index
  const updateStop = (
    index: number,
    updates: Partial<ServiceStop>,
  ) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, ...updates } : s,
      ),
    );
  };

  // Add a new stop
  const addStop = () => {
    setStops((prev) => [...prev, createEmptyStop()]);
    setExpandedStopIndex(stops.length);
  };

  // Remove a stop
  const removeStop = (index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
    if (expandedStopIndex === index) {
      setExpandedStopIndex(null);
    } else if (
      expandedStopIndex !== null &&
      expandedStopIndex > index
    ) {
      setExpandedStopIndex(expandedStopIndex - 1);
    }
  };

  // Handle place selection for a stop
  const handleStopPlaceSelect = (
    index: number,
    place: HerePlaceDetails,
  ) => {
    updateStop(index, {
      address: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
    });
  };

  // Validate form
  const isValid = () => {
    if (!driverId) return false;
    if (stops.length === 0) return false;
    return stops.every(
      (s) => s.address && s.latitude !== 0 && s.taskLabel,
    );
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const tasksPayload = stops.map((stop) => {
        const task: Record<string, unknown> = {
          task_type: 'service',
          latitude: stop.latitude,
          longitude: stop.longitude,
          address: stop.address,
          task_label: stop.taskLabel,
          task_description:
            stop.taskDescription || undefined,
          photo_required: stop.photoRequired,
          service_duration_seconds:
            stop.serviceDurationMinutes * 60,
        };

        if (stop.hasTimeWindow && stop.earliestArrival) {
          task.earliest_arrival = new Date(
            stop.earliestArrival,
          ).toISOString();
        }
        if (stop.hasTimeWindow && stop.latestArrival) {
          task.latest_arrival = new Date(
            stop.latestArrival,
          ).toISOString();
        }
        if (
          stop.hasTimeWindow &&
          stop.earliestArrival &&
          stop.latestArrival
        ) {
          task.time_window_type = 'soft';
        }

        return task;
      });

      const payload: Record<string, unknown> = {
        driver_id: driverId,
        shift_type: 'custom',
        shift_label: shiftLabel || undefined,
        truck_bin_capacity: 0,
        lock_route_order: false,
        tasks: tasksPayload,
        warehouse_latitude: warehouse?.latitude || 0,
        warehouse_longitude: warehouse?.longitude || 0,
        warehouse_address:
          warehouse?.address || 'Warehouse',
      };

      // Finish by → vehicle latest_end
      if (finishBy) {
        payload.scheduled_end = new Date(
          finishBy,
        ).toISOString();
      }

      // Start at warehouse override
      if (startAtWarehouse && warehouse) {
        payload.start_latitude = warehouse.latitude;
        payload.start_longitude = warehouse.longitude;
        payload.start_address = warehouse.address;
      }

      // Final destination
      if (endAtWarehouse && warehouse) {
        payload.end_latitude = warehouse.latitude;
        payload.end_longitude = warehouse.longitude;
        payload.end_address = warehouse.address;
      } else if (endLat && endLon) {
        payload.end_latitude = endLat;
        payload.end_longitude = endLon;
        payload.end_address = endAddress;
      }

      const API_URL =
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:8080';

      const response = await fetch(
        `${API_URL}/api/manager/shifts/create-with-tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        let errorMessage =
          `Failed to create shift (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // not JSON
        }
        throw new Error(errorMessage);
      }

      queryClient.invalidateQueries({
        queryKey: shiftKeys.all,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create shift',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Custom Shift
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-fast"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
        >
          <div className="p-6 space-y-5">
            {/* Shift Label */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                Shift Name
              </label>
              <input
                type="text"
                value={shiftLabel}
                onChange={(e) =>
                  setShiftLabel(e.target.value)
                }
                placeholder="e.g. Monday inspections"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Driver Selection */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                Driver{' '}
                <span className="text-red-500">*</span>
              </label>
              <div
                className="relative"
                ref={driverDropdownRef}
              >
                <button
                  type="button"
                  onClick={() =>
                    isDriverDropdownOpen
                      ? closeDriverDropdown()
                      : setIsDriverDropdownOpen(true)
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-left flex items-center justify-between hover:bg-gray-50 transition-fast"
                >
                  <span
                    className={
                      selectedDriver
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }
                  >
                    {selectedDriver ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                          {selectedDriver.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <span className="font-medium">
                          {selectedDriver.name}
                        </span>
                      </div>
                    ) : (
                      'Select driver...'
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isDriverDropdownOpen && (
                  <div
                    className={`absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50 ${
                      isDriverClosing
                        ? 'animate-slide-out-up'
                        : 'animate-slide-in-down'
                    }`}
                  >
                    {loadingDrivers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    ) : drivers.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          No drivers available
                        </p>
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
                              driverId === driver.id
                                ? 'bg-blue-50 border border-blue-200'
                                : ''
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {driver.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-gray-900 text-sm">
                                {driver.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {driver.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Finish By */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-blue-600" />
                  Finish by
                </span>
              </label>
              <input
                type="datetime-local"
                value={finishBy}
                onChange={(e) =>
                  setFinishBy(e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Optional. Route will be optimized to
                finish before this time.
              </p>
            </div>

            {/* Start at Warehouse */}
            <label className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-fast">
              <input
                type="checkbox"
                checked={startAtWarehouse}
                onChange={(e) =>
                  setStartAtWarehouse(e.target.checked)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500/20"
              />
              <Warehouse className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Start at warehouse
                </p>
                <p className="text-xs text-gray-500">
                  {startAtWarehouse
                    ? warehouse?.address ||
                      'Warehouse location'
                    : "Driver starts from their current location"}
                </p>
              </div>
            </label>

            {/* Service Stops */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-900">
                  Service Stops{' '}
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-500">
                  {stops.length} stop
                  {stops.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {stops.map((stop, index) => (
                  <ServiceStopCard
                    key={index}
                    stop={stop}
                    index={index}
                    isExpanded={
                      expandedStopIndex === index
                    }
                    onToggle={() =>
                      setExpandedStopIndex(
                        expandedStopIndex === index
                          ? null
                          : index,
                      )
                    }
                    onUpdate={(updates) =>
                      updateStop(index, updates)
                    }
                    onPlaceSelect={(place) =>
                      handleStopPlaceSelect(index, place)
                    }
                    onRemove={() => removeStop(index)}
                    canRemove={stops.length > 1}
                  />
                ))}
              </div>

              {/* Add Stop Button */}
              <button
                type="button"
                onClick={addStop}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg transition-all text-sm font-medium text-blue-600"
              >
                <Plus className="w-4 h-4" />
                Add Stop
              </button>
            </div>

            {/* Final Destination */}
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-red-500" />
                  Final Destination
                </span>
              </label>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={endAtWarehouse}
                  onChange={(e) => {
                    setEndAtWarehouse(e.target.checked);
                    if (e.target.checked) {
                      setEndAddress('');
                      setEndLat(0);
                      setEndLon(0);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-700">
                  Return to warehouse
                </span>
              </label>
              {!endAtWarehouse && (
                <HerePlacesAutocomplete
                  value={endAddress}
                  onChange={setEndAddress}
                  onPlaceSelect={(place) => {
                    setEndAddress(
                      place.formattedAddress,
                    );
                    setEndLat(place.latitude);
                    setEndLon(place.longitude);
                  }}
                  placeholder="Where should the driver end up?"
                />
              )}
              {endAtWarehouse && (
                <p className="text-xs text-gray-500">
                  {warehouse?.address ||
                    'Warehouse location'}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-fast"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid() || isSubmitting}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-fast flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Custom Shift'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Individual service stop card — collapsible
 */
function ServiceStopCard({
  stop,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onPlaceSelect,
  onRemove,
  canRemove,
}: {
  stop: ServiceStop;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<ServiceStop>) => void;
  onPlaceSelect: (place: HerePlaceDetails) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-fast text-left"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {stop.taskLabel || 'Untitled stop'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {stop.address || 'No address set'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {stop.photoRequired && (
            <Camera className="w-3.5 h-3.5 text-gray-400" />
          )}
          {stop.hasTimeWindow && (
            <Clock className="w-3.5 h-3.5 text-gray-400" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {/* Task Label */}
          <div className="pt-3">
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Stop Name{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={stop.taskLabel}
              onChange={(e) =>
                onUpdate({ taskLabel: e.target.value })
              }
              placeholder="e.g. Check site condition"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Address{' '}
              <span className="text-red-500">*</span>
            </label>
            <HerePlacesAutocomplete
              value={stop.address}
              onChange={(val) =>
                onUpdate({ address: val })
              }
              onPlaceSelect={onPlaceSelect}
              placeholder="Search address..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Description
            </label>
            <textarea
              value={stop.taskDescription}
              onChange={(e) =>
                onUpdate({
                  taskDescription: e.target.value,
                })
              }
              placeholder="Instructions for the driver..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Photo Required + Duration row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stop.photoRequired}
                onChange={(e) =>
                  onUpdate({
                    photoRequired: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-xs text-gray-700">
                Photo required
              </span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-700">
                Duration
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={stop.serviceDurationMinutes}
                onChange={(e) =>
                  onUpdate({
                    serviceDurationMinutes:
                      parseInt(e.target.value) || 5,
                  })
                }
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">
                min
              </span>
            </div>
          </div>

          {/* Time Window (per-stop) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={stop.hasTimeWindow}
                onChange={(e) =>
                  onUpdate({
                    hasTimeWindow: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500/20"
              />
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-700">
                Arrival window
              </span>
              <span className="text-xs text-gray-400">
                (optional constraint for this stop)
              </span>
            </label>

            {stop.hasTimeWindow && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Earliest
                  </label>
                  <input
                    type="datetime-local"
                    value={stop.earliestArrival}
                    onChange={(e) =>
                      onUpdate({
                        earliestArrival: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Latest
                  </label>
                  <input
                    type="datetime-local"
                    value={stop.latestArrival}
                    onChange={(e) =>
                      onUpdate({
                        latestArrival: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Remove button */}
          {canRemove && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-fast"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove stop
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
