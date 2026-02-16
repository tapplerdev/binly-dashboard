'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BinWithPriority, MoveRequest, getBinMarkerColor } from '@/lib/types/bin';
import { getBinsWithPriority } from '@/lib/api/bins';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Calendar,
  Loader2,
  MapPin,
  Search,
  AlertTriangle,
  Truck,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Package,
  Map as MapIcon,
} from 'lucide-react';
import { createMoveRequest, assignMoveToShift, assignMoveToUser } from '@/lib/api/move-requests';
import { getShifts, getShiftDetailsByDriverId, Shift } from '@/lib/api/shifts';
import { getUsers, User as UserType } from '@/lib/api/users';
import { cn } from '@/lib/utils';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails } from '@/lib/services/geocoding.service';
import { format, addDays } from 'date-fns';

// Google Maps imports
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

// Default map center (San Jose, CA - warehouse location)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Per-bin configuration type
interface BinMoveConfig {
  bin: BinWithPriority;
  moveType: 'store' | 'relocation';
  scheduledDate: number; // Unix timestamp
  newStreet?: string;
  newCity?: string;
  newZip?: string;
  newLatitude?: number;
  newLongitude?: number;
  reason?: string;
  notes?: string;
  assignmentType: 'unassigned' | 'user' | 'active_shift' | 'future_shift';
  assignedUserId?: string;
  assignedShiftId?: string;
  insertAfterBinId?: string;
  insertPosition?: 'start' | 'end';
}

interface ScheduleMoveModalWithMapProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'selection' | 'configuration';

export function ScheduleMoveModalWithMap({
  bin,
  bins,
  onClose,
  onSuccess,
}: ScheduleMoveModalWithMapProps) {
  const queryClient = useQueryClient();

  // UI State
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('selection');
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form'); // Mobile toggle

  // Map State
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null);

  // Bin Selection State
  const [selectedBins, setSelectedBins] = useState<BinWithPriority[]>(
    bin ? [bin] : bins || []
  );
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  // Global Settings (Step 1)
  const [globalDate, setGlobalDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dateOption, setDateOption] = useState<'24h' | '3days' | 'week' | 'custom'>('custom');

  // Per-Bin Configuration (Step 2)
  const [binConfigs, setBinConfigs] = useState<Record<string, BinMoveConfig>>({});

  // Fetch all bins for map display and search
  const { data: allBins, isLoading: binsLoading } = useQuery({
    queryKey: ['bins-with-priority'],
    queryFn: getBinsWithPriority,
  });

  // Fetch users for assignment
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  // Fetch shifts for assignment
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });

  // Initialize bin configs when bins are selected
  useEffect(() => {
    const newConfigs: Record<string, BinMoveConfig> = {};
    selectedBins.forEach((b) => {
      if (!binConfigs[b.id]) {
        const scheduledDate = new Date(globalDate).getTime();
        newConfigs[b.id] = {
          bin: b,
          moveType: 'store',
          scheduledDate,
          assignmentType: 'unassigned',
        };
      } else {
        newConfigs[b.id] = binConfigs[b.id];
      }
    });
    setBinConfigs(newConfigs);
  }, [selectedBins, globalDate]);

  // Filter bins for search
  const availableBins = useMemo(() => {
    if (!allBins) return [];

    const query = binSearchQuery.toLowerCase().trim();
    if (!query) return allBins;

    return allBins.filter((b) => {
      const binNumber = b.bin_number?.toString() || '';
      const street = b.current_street?.toLowerCase() || '';
      const city = b.city?.toLowerCase() || '';
      const zip = b.zip?.toLowerCase() || '';

      return (
        binNumber.includes(query) ||
        street.includes(query) ||
        city.includes(query) ||
        zip.includes(query)
      );
    });
  }, [allBins, binSearchQuery]);

  // Handle modal close
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Handle bin selection from map click
  const handleBinMarkerClick = useCallback((clickedBin: BinWithPriority) => {
    setSelectedBins((prev) => {
      const isSelected = prev.some((b) => b.id === clickedBin.id);
      if (isSelected) {
        // Deselect
        return prev.filter((b) => b.id !== clickedBin.id);
      } else {
        // Select
        return [...prev, clickedBin];
      }
    });

    // Pan to bin
    if (clickedBin.current_latitude && clickedBin.current_longitude) {
      setMapCenter({
        lat: clickedBin.current_latitude,
        lng: clickedBin.current_longitude,
      });
      setMapZoom(15);
    }
  }, []);

  // Handle bin selection from search
  const handleBinSearchSelect = (clickedBin: BinWithPriority) => {
    setSelectedBins((prev) => {
      const isSelected = prev.some((b) => b.id === clickedBin.id);
      if (isSelected) return prev; // Already selected
      return [...prev, clickedBin];
    });

    // Pan to bin
    if (clickedBin.current_latitude && clickedBin.current_longitude) {
      setMapCenter({
        lat: clickedBin.current_latitude,
        lng: clickedBin.current_longitude,
      });
      setMapZoom(15);
    }

    // Clear search
    setBinSearchQuery('');
    setShowBinDropdown(false);
  };

  // Handle date quick select
  const handleDateQuickSelect = (option: '24h' | '3days' | 'week' | 'custom') => {
    setDateOption(option);
    const now = new Date();
    switch (option) {
      case '24h':
        setGlobalDate(addDays(now, 1).toISOString().split('T')[0]);
        break;
      case '3days':
        setGlobalDate(addDays(now, 3).toISOString().split('T')[0]);
        break;
      case 'week':
        setGlobalDate(addDays(now, 7).toISOString().split('T')[0]);
        break;
      default:
        break;
    }
  };

  // Handle moving to configuration step
  const handleNext = () => {
    if (selectedBins.length === 0) {
      alert('Please select at least one bin');
      return;
    }
    setWizardStep('configuration');
  };

  // Handle submission
  const handleSubmit = async () => {
    if (selectedBins.length === 0) {
      alert('Please select at least one bin');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🚀 [BULK CREATE] Starting bulk move request creation...');
      console.log(`📦 [BULK CREATE] Creating ${selectedBins.length} move requests`);

      // Step 1: Create all move requests in parallel
      const createPromises = selectedBins.map((bin) => {
        const config = binConfigs[bin.id];
        if (!config) {
          throw new Error(`Missing configuration for bin ${bin.id}`);
        }

        const payload: any = {
          bin_id: bin.id,
          scheduled_date: Math.floor(config.scheduledDate / 1000), // Convert to Unix seconds
          move_type: config.moveType === 'store' ? 'store' : 'relocation',
          reason: config.reason || '',
          notes: config.notes || '',
        };

        if (config.moveType === 'relocation') {
          payload.new_street = config.newStreet;
          payload.new_city = config.newCity;
          payload.new_zip = config.newZip;
          payload.new_latitude = config.newLatitude;
          payload.new_longitude = config.newLongitude;
        }

        return createMoveRequest(payload);
      });

      const createdMoves = await Promise.all(createPromises);
      console.log(`✅ [BULK CREATE] Created ${createdMoves.length} move requests`);

      // Step 2: Assign each move request based on its configuration
      const assignPromises = createdMoves.map(async (move, index) => {
        const bin = selectedBins[index];
        const config = binConfigs[bin.id];

        if (config.assignmentType === 'user' && config.assignedUserId) {
          console.log(`🔄 [ASSIGN] Assigning move ${move.id} to user ${config.assignedUserId}`);
          await assignMoveToUser({
            move_request_id: move.id,
            user_id: config.assignedUserId,
          });
        } else if (
          (config.assignmentType === 'active_shift' || config.assignmentType === 'future_shift') &&
          config.assignedShiftId
        ) {
          console.log(`🔄 [ASSIGN] Assigning move ${move.id} to shift ${config.assignedShiftId}`);
          await assignMoveToShift({
            move_request_id: move.id,
            shift_id: config.assignedShiftId,
            insert_after_bin_id: config.insertAfterBinId,
            insert_position: config.insertPosition,
          });
        }
      });

      await Promise.all(assignPromises);
      console.log('✅ [BULK CREATE] All assignments complete');

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('❌ [BULK CREATE] Failed:', error);
      alert(`Failed to create move requests. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render bin marker
  const renderBinMarker = (bin: BinWithPriority) => {
    if (!bin.current_latitude || !bin.current_longitude) return null;

    const isSelected = selectedBins.some((b) => b.id === bin.id);
    const isHovered = hoveredBinId === bin.id;

    return (
      <AdvancedMarker
        key={bin.id}
        position={{ lat: bin.current_latitude, lng: bin.current_longitude }}
        zIndex={isSelected ? 20 : 10}
        onClick={() => handleBinMarkerClick(bin)}
      >
        <div className="relative">
          {/* Pulsing ring for selected bins */}
          {isSelected && (
            <div className="absolute inset-0 animate-ping">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 opacity-75"></div>
            </div>
          )}

          {/* Bin marker */}
          <div
            className={cn(
              'w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all',
              isSelected && 'border-blue-500 border-4 scale-110',
              isHovered && 'scale-125'
            )}
            style={{
              backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
            }}
            onMouseEnter={() => setHoveredBinId(bin.id)}
            onMouseLeave={() => setHoveredBinId(null)}
            title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
          >
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
              {bin.bin_number}
            </div>
          </div>
        </div>
      </AdvancedMarker>
    );
  };

  // Filter bins for list view
  const filteredBinsForList = useMemo(() => {
    if (!allBins) return [];

    const query = binSearchQuery.toLowerCase().trim();
    if (!query) return allBins;

    return allBins.filter((b) => {
      const binNumber = b.bin_number?.toString() || '';
      const street = b.current_street?.toLowerCase() || '';
      const city = b.city?.toLowerCase() || '';
      const zip = b.zip?.toLowerCase() || '';

      return (
        binNumber.includes(query) ||
        street.includes(query) ||
        city.includes(query) ||
        zip.includes(query)
      );
    });
  }, [allBins, binSearchQuery]);

  // Render Step 1: Selection
  const renderSelectionStep = () => (
    <>
      {/* Right Side: Map (60%) */}
      <div className="w-full md:w-[60%] relative flex flex-col bg-gray-100">
        {/* Map Header with Search */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-lg px-4 z-10">
          <div className="bg-white rounded-xl shadow-lg border border-gray-300 p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bin number or address..."
                value={binSearchQuery}
                onChange={(e) => setBinSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-0 rounded-lg focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
        </div>

        {/* Google Map */}
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <Map
            mapId="schedule-move-map"
            center={mapCenter}
            zoom={mapZoom}
            onCenterChanged={(e) => {
              if (e.detail.center) {
                setMapCenter(e.detail.center);
              }
            }}
            onZoomChanged={(e) => {
              if (e.detail.zoom) {
                setMapZoom(e.detail.zoom);
              }
            }}
            minZoom={3}
            maxZoom={20}
            gestureHandling="greedy"
            disableDefaultUI={true}
            zoomControl={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Render all bin markers */}
            {allBins?.map((b) => renderBinMarker(b))}
          </Map>
        </APIProvider>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs">
          <div className="font-semibold text-gray-900 mb-2">Click bins to select</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border border-white shadow-sm"></div>
              <span className="text-gray-700">80-100% full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 border border-white shadow-sm"></div>
              <span className="text-gray-700">50-79% full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border border-white shadow-sm"></div>
              <span className="text-gray-700">0-49% full</span>
            </div>
            <div className="flex items-center gap-2 pt-1.5 border-t border-gray-200">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600 shadow-sm"></div>
              <span className="font-semibold text-gray-900">Selected</span>
            </div>
          </div>
        </div>

        {/* Selection Counter Badge */}
        {selectedBins.length > 0 && (
          <div className="absolute top-4 right-4 bg-primary text-white px-4 py-2 rounded-full shadow-lg font-semibold text-sm z-10">
            {selectedBins.length} bin{selectedBins.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* Left Side: Bin List (40%) */}
      <div className="w-full md:w-[40%] flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Select bins for your route template</h3>
            {selectedBins.length > 0 && (
              <button
                onClick={() => setSelectedBins([])}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Search within list */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by bin number or address..."
              value={binSearchQuery}
              onChange={(e) => setBinSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Bin List */}
        <div className="flex-1 overflow-y-auto">
          {binsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-gray-500">Loading bins...</p>
            </div>
          ) : filteredBinsForList.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No bins found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBinsForList.map((b) => {
                const isSelected = selectedBins.some((sb) => sb.id === b.id);
                const fillColor =
                  b.fill_percentage >= 80
                    ? 'bg-red-500'
                    : b.fill_percentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500';

                return (
                  <label
                    key={b.id}
                    className={cn(
                      'flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors',
                      isSelected && 'bg-blue-50 hover:bg-blue-100'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleBinMarkerClick(b)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900">
                          Bin #{b.bin_number}
                        </span>
                        {b.fill_percentage !== null && (
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2 h-2 rounded-full', fillColor)}></div>
                            <span className="text-xs text-gray-600 font-medium">
                              {b.fill_percentage}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 truncate">{b.current_street}</div>
                      <div className="text-xs text-gray-500">
                        {b.city}, {b.zip}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with date and next button */}
        <div className="p-4 border-t border-gray-200 space-y-3 flex-shrink-0 bg-gray-50">
          {/* Date Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              When should these be moved? *
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleDateQuickSelect('24h')}
                className={cn(
                  'py-1.5 px-2 border rounded-lg text-xs font-medium transition-colors',
                  dateOption === '24h'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                )}
              >
                Within 24hrs
              </button>
              <button
                type="button"
                onClick={() => handleDateQuickSelect('3days')}
                className={cn(
                  'py-1.5 px-2 border rounded-lg text-xs font-medium transition-colors',
                  dateOption === '3days'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                )}
              >
                Within 3 days
              </button>
              <button
                type="button"
                onClick={() => handleDateQuickSelect('week')}
                className={cn(
                  'py-1.5 px-2 border rounded-lg text-xs font-medium transition-colors',
                  dateOption === 'week'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                )}
              >
                Next week
              </button>
              <button
                type="button"
                onClick={() => handleDateQuickSelect('custom')}
                className={cn(
                  'py-1.5 px-2 border rounded-lg text-xs font-medium transition-colors',
                  dateOption === 'custom'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                )}
              >
                Custom
              </button>
            </div>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => {
                setGlobalDate(e.target.value);
                setDateOption('custom');
              }}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Next Button */}
          <button
            onClick={handleNext}
            disabled={selectedBins.length === 0}
            className={cn(
              'w-full py-2.5 rounded-lg font-semibold text-sm transition-all',
              selectedBins.length > 0
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            Next: Configure Moves ({selectedBins.length})
          </button>
        </div>
      </div>
    </>
  );

  // Update a specific bin's configuration
  const updateBinConfig = (binId: string, updates: Partial<BinMoveConfig>) => {
    setBinConfigs((prev) => ({
      ...prev,
      [binId]: { ...prev[binId], ...updates },
    }));
  };

  // Bulk actions
  const applyBulkAssignment = (
    assignmentType: 'unassigned' | 'user' | 'active_shift' | 'future_shift',
    targetId?: string
  ) => {
    const updates: Record<string, BinMoveConfig> = {};
    selectedBins.forEach((bin) => {
      updates[bin.id] = {
        ...binConfigs[bin.id],
        assignmentType,
        ...(assignmentType === 'user' && targetId ? { assignedUserId: targetId } : {}),
        ...(assignmentType === 'active_shift' || assignmentType === 'future_shift'
          ? { assignedShiftId: targetId }
          : {}),
      };
    });
    setBinConfigs((prev) => ({ ...prev, ...updates }));
  };

  const applyBulkMoveType = (moveType: 'store' | 'relocation') => {
    const updates: Record<string, BinMoveConfig> = {};
    selectedBins.forEach((bin) => {
      updates[bin.id] = {
        ...binConfigs[bin.id],
        moveType,
      };
    });
    setBinConfigs((prev) => ({ ...prev, ...updates }));
  };

  // Handle place selection for relocation address
  const handlePlaceSelect = (binId: string, place: HerePlaceDetails) => {
    updateBinConfig(binId, {
      newStreet: place.address,
      newCity: place.city || '',
      newZip: place.postalCode || '',
      newLatitude: place.latitude,
      newLongitude: place.longitude,
    });
  };

  // Get active and future shifts
  const activeShifts = shifts?.filter((s) => s.status === 'in_progress') || [];
  const futureShifts = shifts?.filter((s) => s.status === 'ready') || [];

  // Render Step 2: Configuration
  const renderConfigurationStep = () => (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Bulk Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Quick Bulk Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Bulk Move Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Set All Move Types:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => applyBulkMoveType('store')}
                  className="flex-1 py-2 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-all"
                >
                  Store All
                </button>
                <button
                  onClick={() => applyBulkMoveType('relocation')}
                  className="flex-1 py-2 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-all"
                >
                  Relocate All
                </button>
              </div>
            </div>

            {/* Bulk Assignment */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Assign All To:
              </label>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'unassigned') {
                    applyBulkAssignment('unassigned');
                  } else if (value.startsWith('user:')) {
                    applyBulkAssignment('user', value.replace('user:', ''));
                  } else if (value.startsWith('active:')) {
                    applyBulkAssignment('active_shift', value.replace('active:', ''));
                  } else if (value.startsWith('future:')) {
                    applyBulkAssignment('future_shift', value.replace('future:', ''));
                  }
                  e.target.value = ''; // Reset select
                }}
                className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary"
              >
                <option value="">Select assignment...</option>
                <option value="unassigned">Leave Unassigned</option>
                {users && users.length > 0 && (
                  <optgroup label="Users">
                    {users.map((user) => (
                      <option key={user.id} value={`user:${user.id}`}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </optgroup>
                )}
                {activeShifts.length > 0 && (
                  <optgroup label="Active Shifts">
                    {activeShifts.map((shift) => (
                      <option key={shift.id} value={`active:${shift.id}`}>
                        Shift #{shift.id.slice(0, 8)} - {shift.driver_name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {futureShifts.length > 0 && (
                  <optgroup label="Future Shifts">
                    {futureShifts.map((shift) => (
                      <option key={shift.id} value={`future:${shift.id}`}>
                        Shift #{shift.id.slice(0, 8)} - {shift.driver_name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Per-Bin Configuration Cards */}
        <div className="space-y-4">
          {selectedBins.map((bin, index) => {
            const config = binConfigs[bin.id];
            if (!config) return null;

            return (
              <div
                key={bin.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 space-y-4 hover:border-gray-300 transition-all"
              >
                {/* Bin Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{
                        backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                      }}
                    >
                      {bin.bin_number}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Bin #{bin.bin_number}</div>
                      <div className="text-xs text-gray-500">{bin.current_street}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBins(selectedBins.filter((b) => b.id !== bin.id));
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Move Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Move Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateBinConfig(bin.id, { moveType: 'store' })}
                      className={cn(
                        'p-3 border-2 rounded-lg text-left transition-colors',
                        config.moveType === 'store'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="font-semibold text-sm text-gray-900">Store</div>
                      <div className="text-xs text-gray-600">Pickup and store</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBinConfig(bin.id, { moveType: 'relocation' })}
                      className={cn(
                        'p-3 border-2 rounded-lg text-left transition-colors',
                        config.moveType === 'relocation'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="font-semibold text-sm text-gray-900">Relocate</div>
                      <div className="text-xs text-gray-600">Move to new address</div>
                    </button>
                  </div>
                </div>

                {/* New Location (for relocation) */}
                {config.moveType === 'relocation' && (
                  <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      New Location
                    </h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <HerePlacesAutocomplete
                        value={config.newStreet || ''}
                        onChange={(value) => updateBinConfig(bin.id, { newStreet: value })}
                        onPlaceSelect={(place) => handlePlaceSelect(bin.id, place)}
                        placeholder="123 Main Street"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          value={config.newCity || ''}
                          onChange={(e) => updateBinConfig(bin.id, { newCity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          ZIP *
                        </label>
                        <input
                          type="text"
                          value={config.newZip || ''}
                          onChange={(e) => updateBinConfig(bin.id, { newZip: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="ZIP"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignment
                  </label>
                  <select
                    value={
                      config.assignmentType === 'unassigned'
                        ? 'unassigned'
                        : config.assignmentType === 'user'
                        ? `user:${config.assignedUserId}`
                        : config.assignmentType === 'active_shift'
                        ? `active:${config.assignedShiftId}`
                        : `future:${config.assignedShiftId}`
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'unassigned') {
                        updateBinConfig(bin.id, {
                          assignmentType: 'unassigned',
                          assignedUserId: undefined,
                          assignedShiftId: undefined,
                        });
                      } else if (value.startsWith('user:')) {
                        updateBinConfig(bin.id, {
                          assignmentType: 'user',
                          assignedUserId: value.replace('user:', ''),
                          assignedShiftId: undefined,
                        });
                      } else if (value.startsWith('active:')) {
                        updateBinConfig(bin.id, {
                          assignmentType: 'active_shift',
                          assignedShiftId: value.replace('active:', ''),
                          assignedUserId: undefined,
                        });
                      } else if (value.startsWith('future:')) {
                        updateBinConfig(bin.id, {
                          assignmentType: 'future_shift',
                          assignedShiftId: value.replace('future:', ''),
                          assignedUserId: undefined,
                          insertPosition: 'end',
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="unassigned">Leave Unassigned</option>
                    {users && users.length > 0 && (
                      <optgroup label="Users (Manual Assignment)">
                        {users.map((user) => (
                          <option key={user.id} value={`user:${user.id}`}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {activeShifts.length > 0 && (
                      <optgroup label="Active Shifts">
                        {activeShifts.map((shift) => (
                          <option key={shift.id} value={`active:${shift.id}`}>
                            {shift.driver_name} (Shift #{shift.id.slice(0, 8)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {futureShifts.length > 0 && (
                      <optgroup label="Future Shifts">
                        {futureShifts.map((shift) => (
                          <option key={shift.id} value={`future:${shift.id}`}>
                            {shift.driver_name} (Shift #{shift.id.slice(0, 8)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Insert Position for Future Shifts */}
                  {config.assignmentType === 'future_shift' && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Insert Position
                      </label>
                      <select
                        value={config.insertPosition || 'end'}
                        onChange={(e) =>
                          updateBinConfig(bin.id, {
                            insertPosition: e.target.value as 'start' | 'end',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="start">At Start</option>
                        <option value="end">At End</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={config.notes || ''}
                    onChange={(e) => updateBinConfig(bin.id, { notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={2}
                    placeholder="Additional details..."
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={() => setWizardStep('selection')}
            disabled={isSubmitting}
            className="flex-1 md:flex-none md:px-8 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 inline mr-2" />
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 md:flex-none md:px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                Creating {selectedBins.length} moves...
              </>
            ) : (
              <>
                Create All {selectedBins.length} Moves
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined'
    ? createPortal(
        <>
          {/* Overlay */}
          <div
            className={cn(
              'fixed inset-0 z-40 bg-black/50',
              isClosing ? 'animate-fade-out' : 'animate-fade-in'
            )}
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-0 md:p-4">
            <Card
              className={cn(
                'w-full h-full md:w-[90vw] md:max-w-6xl md:h-[85vh] md:rounded-2xl rounded-none pointer-events-auto overflow-hidden flex flex-col',
                isClosing ? 'animate-scale-out' : 'animate-scale-in'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 mr-2">
                    <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                      Schedule Bin Moves
                    </h2>
                    <p className="text-xs md:text-sm text-gray-600 mt-1">
                      {wizardStep === 'selection'
                        ? 'Step 1: Select bins from map or search'
                        : `Step 2: Configure ${selectedBins.length} move requests`}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex overflow-hidden">
                {wizardStep === 'selection' && renderSelectionStep()}
                {wizardStep === 'configuration' && renderConfigurationStep()}
              </div>
            </Card>
          </div>
        </>,
        document.body
      )
    : null;
}

// Map Controller Component (for programmatic pan/zoom)
function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center, zoom]);

  return null;
}
