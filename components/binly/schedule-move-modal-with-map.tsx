'use client';

import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
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
  ChevronUp,
  Package,
  Map as MapIcon,
  Filter,
  Lasso,
  Move,
  ExternalLink,
  Clock,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { createMoveRequest, assignMoveToShift, assignMoveToUser } from '@/lib/api/move-requests';
import { BinChangeReasonCategory } from '@/lib/api/bins';
import { getShifts, getShiftDetailsByDriverId } from '@/lib/api/shifts';
import { Shift } from '@/lib/types/shift';
import { getAllUsers, User as UserType } from '@/lib/api/users';
import { cn } from '@/lib/utils';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails } from '@/lib/services/geocoding.service';
import { format, addDays } from 'date-fns';
import { GroupedDropdown, Dropdown } from '@/components/ui/dropdown';
import { getNearbyPotentialLocations, NearbyPotentialLocation } from '@/lib/api/potential-locations';
import { PotentialLocationPickerModal } from './potential-location-picker-modal';
import { moveRequestReducer, createInitialState } from '@/lib/reducers/move-request-reducer';

// Google Maps imports
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

// Default map center (San Jose, CA - warehouse location)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 11;

// Per-bin configuration type
const MOVE_REASON_OPTIONS: { value: BinChangeReasonCategory; label: string; autoZone: boolean }[] = [
  { value: 'landlord_complaint', label: 'Landlord Complaint', autoZone: true },
  { value: 'theft', label: 'Theft', autoZone: true },
  { value: 'vandalism', label: 'Vandalism', autoZone: true },
  { value: 'missing', label: 'Missing Bin', autoZone: true },
  { value: 'relocation_request', label: 'Relocation Request', autoZone: false },
  { value: 'other', label: 'Other', autoZone: false },
];

interface BinMoveConfig {
  bin: BinWithPriority;
  moveType: 'store' | 'relocation' | 'redeployment';
  scheduledDate: number; // Unix timestamp
  dateOption: '24h' | '3days' | 'week' | 'custom'; // Quick-pick date option
  destinationType?: 'custom' | 'potential_location'; // Choose between custom address or potential location
  sourcePotentialLocationId?: string; // Selected potential location ID
  newStreet?: string;
  newCity?: string;
  newZip?: string;
  newLatitude?: number;
  newLongitude?: number;
  reason?: string;
  notes?: string;
  reasonCategory?: BinChangeReasonCategory;
  createNoGoZone?: boolean;
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

// Polyline connector component to draw lines between original and ghost pins
function PolylineConnector({ from, to }: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const polyline = new google.maps.Polyline({
      path: [from, to],
      strokeColor: '#9333EA',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 3,
          },
          offset: '0',
          repeat: '15px',
        },
      ],
    });

    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, from, to]);

  return null;
}

export function ScheduleMoveModalWithMap({
  bin,
  bins,
  onClose,
  onSuccess,
}: ScheduleMoveModalWithMapProps) {
  const queryClient = useQueryClient();

  // Unified state management with reducer
  const [state, dispatch] = useReducer(
    moveRequestReducer,
    createInitialState(bin, bins)
  );

  // Helper: Convert reducer state to old BinMoveConfig format for compatibility
  const binConfigs = useMemo(() => {
    const configs: Record<string, BinMoveConfig> = {};
    Object.entries(state.binConfigurations).forEach(([binId, config]) => {
      configs[binId] = {
        bin: config.bin,
        moveType: config.moveType,
        scheduledDate: config.schedule.date,
        dateOption: config.schedule.dateOption,
        destinationType: config.destination.type,
        sourcePotentialLocationId: config.destination.potentialLocationId,
        newStreet: config.destination.street,
        newCity: config.destination.city,
        newZip: config.destination.zip,
        newLatitude: config.destination.latitude,
        newLongitude: config.destination.longitude,
        reasonCategory: config.reason,
        notes: config.notes,
        createNoGoZone: config.createNoGoZone,
        assignmentType: config.assignment.type,
        assignedUserId: config.assignment.userId,
        assignedShiftId: config.assignment.shiftId,
        insertPosition: config.assignment.insertPosition,
      };
    });
    return configs;
  }, [state.binConfigurations]);

  // Helper: Get values from state for easy access
  const selectedBins = state.selectedBins;
  const wizardStep = state.step;
  const moveMode = state.mode;
  const nearbyPotentialLocations = state.nearbyPotentialLocations;
  const locationPickerBinId = state.ui.locationPickerBinId;
  const isSubmitting = state.ui.isSubmitting;
  const isClosing = state.ui.isClosing;

  // Computed properties: Separate bins by status for display
  const fieldBins = useMemo(() => {
    return selectedBins.filter(bin => bin.status !== 'in_storage');
  }, [selectedBins]);

  const warehouseBins = useMemo(() => {
    return selectedBins.filter(bin => bin.status === 'in_storage');
  }, [selectedBins]);

  // Determine which bins to show based on current mode
  const visibleBins = useMemo(() => {
    return moveMode === 'warehouse_bins' ? warehouseBins : fieldBins;
  }, [moveMode, fieldBins, warehouseBins]);

  const fieldBinCount = fieldBins.length;
  const warehouseBinCount = warehouseBins.length;

  // Debug logging for state changes
  useEffect(() => {
    console.log('🎯 [COMPONENT STATE] Selected bins changed:', selectedBins.length);
    console.log('📋 [COMPONENT STATE] Bin configs count:', Object.keys(binConfigs).length);
    console.log('🏷️ [COMPONENT STATE] Current mode:', moveMode);
    console.log('📦 [COMPONENT STATE] Field bins:', fieldBinCount, '| Warehouse bins:', warehouseBinCount);
    console.log('👀 [COMPONENT STATE] Visible bins:', visibleBins.length);
  }, [selectedBins, binConfigs, moveMode, fieldBinCount, warehouseBinCount, visibleBins]);

  // Local UI state (not part of move request logic)
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form'); // Mobile toggle
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null);
  const [lassoMode, setLassoMode] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [showBinDropdown, setShowBinDropdown] = useState(false);
  const [fillLevelFilter, setFillLevelFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical' | 'missing'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeShiftListExpanded, setActiveShiftListExpanded] = useState<Record<string, boolean>>({});
  const [futureShiftListExpanded, setFutureShiftListExpanded] = useState<Record<string, boolean>>({});

  // Mobile UI state
  const [showLegend, setShowLegend] = useState(false); // Collapsed by default on mobile
  const [bulkActionsExpanded, setBulkActionsExpanded] = useState(false); // Collapsed by default on mobile
  const [expandedBinCards, setExpandedBinCards] = useState<Record<string, boolean>>({}); // Track which bin cards are expanded

  // Drag-to-Relocate State (separate feature, not part of main reducer)
  const [binRelocations, setBinRelocations] = useState<Record<string, {
    newLat: number;
    newLng: number;
    newAddress?: string;
    newCity?: string;
    newZip?: string;
  }>>({});

  // Fetch all bins for map display and search (including warehouse bins)
  const { data: allBins, isLoading: binsLoading } = useQuery({
    queryKey: ['bins-with-priority-all'],
    queryFn: () => getBinsWithPriority({ status: 'all' }), // IMPORTANT: Get ALL bins including in_storage
  });

  // Fetch users for assignment
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  });

  // Fetch shifts for assignment
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });

  // Initialize bin configs when bins are selected
  useEffect(() => {
    dispatch({
      type: 'INITIALIZE_CONFIGS',
      bins: state.selectedBins,
      mode: state.mode,
    });
  }, [state.selectedBins, state.mode]);

  // Auto-fetch nearby potential locations for relocation and redeployment moves
  useEffect(() => {
    Object.entries(state.binConfigurations).forEach(([binId, config]) => {
      if ((config.moveType === 'relocation' || config.moveType === 'redeployment') &&
          !state.nearbyPotentialLocations[binId] &&
          !state.ui.loadingLocations.has(binId)) {
        dispatch({ type: 'START_LOADING_LOCATIONS', binId });
        getNearbyPotentialLocations(binId) // No max_distance = get ALL locations sorted by distance
          .then((locations) => {
            dispatch({ type: 'SET_POTENTIAL_LOCATIONS', binId, locations });
          })
          .catch((error) => {
            console.error(`Failed to fetch nearby locations for bin ${binId}:`, error);
            dispatch({ type: 'SET_POTENTIAL_LOCATIONS', binId, locations: [] });
          })
          .finally(() => {
            dispatch({ type: 'STOP_LOADING_LOCATIONS', binId });
          });
      }
    });
  }, [state.binConfigurations, state.nearbyPotentialLocations, state.ui.loadingLocations]);

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
    dispatch({ type: 'SET_CLOSING', isClosing: true });
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Handle bin selection from map click
  const handleBinMarkerClick = useCallback((clickedBin: BinWithPriority) => {
    const isCurrentlySelected = state.selectedBins.some((b) => b.id === clickedBin.id);

    console.log('🖱️ [BIN CLICK]', isCurrentlySelected ? 'DESELECTING' : 'SELECTING', 'bin:', clickedBin.bin_number, 'status:', clickedBin.status);

    if (isCurrentlySelected) {
      dispatch({ type: 'DESELECT_BIN', binId: clickedBin.id });
    } else {
      dispatch({ type: 'SELECT_BIN', bin: clickedBin });

      // If selecting a warehouse bin, ensure it's set to redeployment
      if (clickedBin.status === 'in_storage') {
        setTimeout(() => {
          dispatch({
            type: 'UPDATE_BIN_CONFIG',
            binId: clickedBin.id,
            updates: {
              moveType: 'redeployment',
              destination: { type: 'potential_location' }
            }
          });
        }, 0);
      }
    }

    // Pan to bin (check both coordinate field options)
    const lat = clickedBin.current_latitude ?? clickedBin.latitude;
    const lng = clickedBin.current_longitude ?? clickedBin.longitude;

    if (lat && lng) {
      setMapCenter({ lat, lng });
      setMapZoom(15);
    }
  }, [state.selectedBins]);

  // Handle bin selection from search
  const handleBinSearchSelect = (clickedBin: BinWithPriority) => {
    const isSelected = state.selectedBins.some((b) => b.id === clickedBin.id);
    if (!isSelected) {
      dispatch({ type: 'SELECT_BIN', bin: clickedBin });
    }

    // Pan to bin (check both coordinate field options)
    const lat = clickedBin.current_latitude ?? clickedBin.latitude;
    const lng = clickedBin.current_longitude ?? clickedBin.longitude;

    if (lat && lng) {
      setMapCenter({ lat, lng });
      setMapZoom(15);
    }

    // Clear search
    setBinSearchQuery('');
    setShowBinDropdown(false);
  };

  // Handle marker drag end (for relocation planning)
  const handleMarkerDragEnd = async (bin: BinWithPriority, event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;

    const newLat = event.latLng.lat();
    const newLng = event.latLng.lng();

    // Reverse geocode the new location
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat: newLat, lng: newLng } });

      if (result.results && result.results[0]) {
        const addressComponents = result.results[0].address_components;
        const formattedAddress = result.results[0].formatted_address;

        // Extract street, city, zip
        let street = '';
        let city = '';
        let zip = '';

        for (const component of addressComponents) {
          if (component.types.includes('street_number')) {
            street = component.long_name + ' ';
          }
          if (component.types.includes('route')) {
            street += component.long_name;
          }
          if (component.types.includes('locality')) {
            city = component.long_name;
          }
          if (component.types.includes('postal_code')) {
            zip = component.long_name;
          }
        }

        // Save relocation data
        setBinRelocations((prev) => ({
          ...prev,
          [bin.id]: {
            newLat,
            newLng,
            newAddress: street || formattedAddress,
            newCity: city,
            newZip: zip,
          },
        }));

        console.log(`[DRAG] Bin ${bin.bin_number} relocated to:`, { street, city, zip });
      }
    } catch (error) {
      console.error('[DRAG] Reverse geocoding failed:', error);
      // Still save coordinates even if geocoding fails
      setBinRelocations((prev) => ({
        ...prev,
        [bin.id]: {
          newLat,
          newLng,
          newAddress: `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`,
        },
      }));
    }
  };

  // Reset a single bin's relocation
  const handleResetRelocation = (binId: string) => {
    setBinRelocations((prev) => {
      const updated = { ...prev };
      delete updated[binId];
      return updated;
    });
  };

  // Clear all relocations
  const handleClearAllRelocations = () => {
    setBinRelocations({});
  };

  // Handle moving to configuration step
  const handleNext = () => {
    if (selectedBins.length === 0) {
      alert('Please select at least one bin');
      return;
    }

    // Update configs for bins with drag relocations
    selectedBins.forEach((bin) => {
      const relocation = binRelocations[bin.id];

      if (relocation) {
        // Bin was relocated via drag - update to relocation mode with destination
        dispatch({
          type: 'UPDATE_BIN_CONFIG',
          binId: bin.id,
          updates: {
            moveType: 'relocation',
            destination: {
              type: 'custom',
              street: relocation.newAddress || '',
              city: relocation.newCity || '',
              zip: relocation.newZip || '',
              latitude: relocation.newLat,
              longitude: relocation.newLng,
            },
          },
        });
      }
    });

    dispatch({ type: 'SET_STEP', step: 'configuration' });
  };

  // Handle submission
  const handleSubmit = async () => {
    if (selectedBins.length === 0) {
      alert('Please select at least one bin');
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', isSubmitting: true });

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
          move_type: config.moveType, // 'store', 'relocation', or 'redeployment'
          reason: config.reason || '',
          notes: config.notes || '',
          reason_category: config.reasonCategory || undefined,
          create_no_go_zone: config.reasonCategory === 'relocation_request' ? (config.createNoGoZone ?? false) : undefined,
        };

        // Add destination fields for relocation and redeployment
        if (config.moveType === 'relocation' || config.moveType === 'redeployment') {
          payload.new_street = config.newStreet;
          payload.new_city = config.newCity;
          payload.new_zip = config.newZip;
          payload.new_latitude = config.newLatitude;
          payload.new_longitude = config.newLongitude;
          // Include source_potential_location_id if a potential location was selected
          if (config.sourcePotentialLocationId) {
            payload.source_potential_location_id = config.sourcePotentialLocationId;
          }
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
      dispatch({ type: 'SET_SUBMITTING', isSubmitting: false });
    }
  };

  // Render potential location marker for redeployment destination selection
  const renderPotentialLocationMarker = (location: NearbyPotentialLocation, binId: string) => {
    if (!location.latitude || !location.longitude) return null;

    const config = binConfigs[binId];
    const isSelected = config?.sourcePotentialLocationId === location.id;

    return (
      <AdvancedMarker
        key={`potential-${location.id}`}
        position={{ lat: location.latitude, lng: location.longitude }}
        zIndex={isSelected ? 25 : 5}
        onClick={() => {
          console.log('🎯 [POTENTIAL MARKER] Clicked:', location.street);
          // Auto-select this potential location
          updateBinConfig(binId, {
            destinationType: 'potential_location',
            sourcePotentialLocationId: location.id,
            newStreet: location.street,
            newCity: location.city,
            newZip: location.zip,
            newLatitude: location.latitude,
            newLongitude: location.longitude,
          });
        }}
      >
        <div className="relative cursor-pointer group pointer-events-auto">
          {/* Marker */}
          <div
            className={cn(
              'w-7 h-7 rounded-full border-2 shadow-lg flex items-center justify-center text-xs font-bold transition-all pointer-events-auto',
              isSelected
                ? 'bg-green-500 border-white scale-110'
                : 'bg-orange-400 border-white hover:scale-110'
            )}
            title={`${location.street}, ${location.city} (${Math.round(location.distance_meters)}m away)`}
            onClick={(e) => {
              e.stopPropagation();
              console.log('🎯 [POTENTIAL MARKER DIV] Clicked:', location.street);
              updateBinConfig(binId, {
                destinationType: 'potential_location',
                sourcePotentialLocationId: location.id,
                newStreet: location.street,
                newCity: location.city,
                newZip: location.zip,
                newLatitude: location.latitude,
                newLongitude: location.longitude,
              });
            }}
          >
            <MapPin className="w-4 h-4 text-white fill-white pointer-events-none" />
          </div>
          {/* Label */}
          <div className={cn(
            'absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded whitespace-nowrap text-[10px] transition-all',
            isSelected
              ? 'bg-green-600 text-white'
              : 'bg-orange-500 text-white opacity-0 group-hover:opacity-100'
          )}>
            {isSelected ? '✓ Selected' : `${Math.round(location.distance_meters)}m`}
          </div>
        </div>
      </AdvancedMarker>
    );
  };

  // Render bin marker
  const renderBinMarker = (bin: BinWithPriority) => {
    // Check for both current_latitude/current_longitude AND latitude/longitude
    const lat = bin.current_latitude ?? bin.latitude;
    const lng = bin.current_longitude ?? bin.longitude;

    if (!lat || !lng) {
      return null;
    }

    const isSelected = selectedBins.some((b) => b.id === bin.id);
    const isHovered = hoveredBinId === bin.id;

    return (
      <AdvancedMarker
        key={bin.id}
        position={{ lat, lng }}
        zIndex={isSelected ? 20 : 10}
        onClick={() => !isDragMode && handleBinMarkerClick(bin)}
        draggable={isDragMode && isSelected}
        onDragEnd={(e) => handleMarkerDragEnd(bin, e)}
      >
        <div className="relative pointer-events-auto">
          {/* Pulsing ring for selected bins */}
          {isSelected && (
            <div className="absolute inset-0 animate-ping pointer-events-none">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 opacity-75"></div>
            </div>
          )}

          {/* Bin marker */}
          <div
            className={cn(
              'w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all pointer-events-auto',
              isSelected && 'border-blue-500 border-4 scale-110',
              isHovered && 'scale-125'
            )}
            style={{
              backgroundColor: isSelected ? '#3B82F6' : getBinMarkerColor(bin.fill_percentage, bin.status),
            }}
            onMouseEnter={() => setHoveredBinId(bin.id)}
            onMouseLeave={() => setHoveredBinId(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDragMode) {
                handleBinMarkerClick(bin);
              }
            }}
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

  // Filter bins for list view based on mode
  const filteredBinsForList = useMemo(() => {
    if (!allBins) return [];

    console.log('🔍 [FILTER] Total bins:', allBins.length);
    console.log('🔍 [FILTER] Move mode:', moveMode);

    // Check for ALL possible status values
    const statusCounts = allBins.reduce((acc, bin) => {
      acc[bin.status] = (acc[bin.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('🔍 [FILTER] Status breakdown:', statusCounts);

    let filtered = [...allBins];

    // Filter based on move mode
    if (moveMode === 'warehouse_bins') {
      // Show ONLY warehouse bins (in_storage)
      filtered = filtered.filter((b) => b.status === 'in_storage');
      console.log('🔍 [FILTER] Warehouse bins (in_storage):', filtered.length);

      // Show bins 92, 96, 101 specifically since they show "In Warehouse" in UI
      const testBins = allBins.filter(b => [92, 96, 101].includes(b.bin_number));
      console.log('🔍 [FILTER] Bins 92, 96, 101 statuses:', testBins.map(b => ({ num: b.bin_number, status: b.status })));
    } else {
      // Show field bins (NOT in warehouse)
      filtered = filtered.filter((b) => b.status !== 'in_storage');
      console.log('🔍 [FILTER] Field bins (not in_storage):', filtered.length);
    }

    // Apply search filter
    const query = binSearchQuery.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter((b) => {
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
    }

    // Apply fill level filter (skip for warehouse bins - they don't have fill levels)
    if (fillLevelFilter !== 'all' && moveMode === 'field_bins') {
      filtered = filtered.filter((b) => {
        // Handle missing bins separately
        if (fillLevelFilter === 'missing') {
          return b.status === 'missing';
        }

        const fillPct = b.fill_percentage ?? 0;
        switch (fillLevelFilter) {
          case 'critical':
            return fillPct >= 80;
          case 'high':
            return fillPct >= 50 && fillPct < 80;
          case 'medium':
            return fillPct >= 20 && fillPct < 50;
          case 'low':
            return fillPct < 20;
          default:
            return true;
        }
      });
    }

    // Sort by bin number (ascending)
    filtered.sort((a, b) => {
      const numA = a.bin_number ?? 0;
      const numB = b.bin_number ?? 0;
      return numA - numB;
    });

    return filtered;
  }, [allBins, binSearchQuery, fillLevelFilter, moveMode]);

  // Render Step 1: Selection
  const renderSelectionStep = () => (
    <>
      {/* Right Side: Map (60%) */}
      <div className="w-full md:w-[60%] relative flex flex-col bg-gray-100">
        {/* Map Header with Search */}
        <div className="absolute top-4 left-4 w-full max-w-md z-10">
          <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bin number or address..."
                value={binSearchQuery}
                onChange={(e) => setBinSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border-0 rounded-md focus:ring-2 focus:ring-primary text-xs"
              />
            </div>
          </div>
        </div>

        {/* Map Control Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {/* Drag Mode Toggle */}
          <button
            onClick={() => {
              setIsDragMode(!isDragMode);
              if (lassoMode) setLassoMode(false); // Turn off lasso if turning on drag
            }}
            className={cn(
              'px-3 py-2 rounded-lg shadow-lg border transition-all flex items-center gap-2 text-sm font-medium',
              isDragMode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
            title="Plan Relocations - Drag bins to plan moves"
          >
            <Move className="w-4 h-4" />
            {isDragMode && <span>Plan Relocations</span>}
          </button>

          {/* Lasso Select Button */}
          <button
            onClick={() => {
              setLassoMode(!lassoMode);
              if (isDragMode) setIsDragMode(false); // Turn off drag if turning on lasso
            }}
            className={cn(
              'p-2.5 rounded-lg shadow-lg border transition-all',
              lassoMode
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
            title="Lasso Select"
          >
            <Lasso className="w-4 h-4" />
          </button>

          {/* Clear Relocations Button (only show when there are relocations) */}
          {Object.keys(binRelocations).length > 0 && (
            <button
              onClick={handleClearAllRelocations}
              className="px-3 py-2 rounded-lg shadow-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all text-sm font-medium"
              title="Clear all planned relocations"
            >
              ↺ Reset All
            </button>
          )}
        </div>

        {/* Google Map */}
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <Map
            mapId="schedule-move-map"
            defaultCenter={mapCenter}
            defaultZoom={mapZoom}
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
            mapTypeId="hybrid"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Render ALL bin markers (not filtered - show everything on map) */}
            {allBins?.map((b) => renderBinMarker(b))}

            {/* Render ghost pins for relocated bins */}
            {allBins?.map((bin) => {
              const relocation = binRelocations[bin.id];
              if (!relocation) return null;

              const originalLat = bin.current_latitude ?? bin.latitude;
              const originalLng = bin.current_longitude ?? bin.longitude;

              if (!originalLat || !originalLng) return null;

              return (
                <React.Fragment key={`ghost-${bin.id}`}>
                  {/* Ghost pin at new location */}
                  <AdvancedMarker
                    position={{ lat: relocation.newLat, lng: relocation.newLng }}
                    zIndex={15}
                  >
                    <div className="relative">
                      {/* Ghost marker */}
                      <div
                        className="w-8 h-8 rounded-full border-2 border-dashed border-purple-600 shadow-lg cursor-pointer bg-purple-500/60 backdrop-blur-sm flex items-center justify-center text-white text-xs font-bold"
                        title={`New location: ${relocation.newAddress || 'Unknown'}`}
                      >
                        ⭢
                      </div>
                      {/* Label */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                        New
                      </div>
                    </div>
                  </AdvancedMarker>

                  {/* Polyline connector */}
                  <PolylineConnector
                    from={{ lat: originalLat, lng: originalLng }}
                    to={{ lat: relocation.newLat, lng: relocation.newLng }}
                  />
                </React.Fragment>
              );
            })}

            {/* Render potential location markers for redeployment */}
            {selectedBins.map((bin) => {
              const config = binConfigs[bin.id];
              // Only show potential locations when bin is configured for redeployment
              if (config?.moveType !== 'redeployment') return null;

              const locations = nearbyPotentialLocations[bin.id];
              if (!locations || locations.length === 0) return null;

              return locations.map((location) =>
                renderPotentialLocationMarker(location, bin.id)
              );
            })}
          </Map>
        </APIProvider>

        {/* Map Legend - Collapsible on mobile */}
        <div className="absolute bottom-4 left-4 z-10">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="md:hidden bg-white rounded-lg shadow-lg border border-gray-200 p-2.5 text-primary hover:bg-blue-50 transition-colors"
            title="Toggle legend"
          >
            <Info className="w-5 h-5" />
          </button>
          <div className={cn(
            "bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs transition-all",
            showLegend ? "block" : "hidden md:block"
          )}>
            <div className="font-semibold text-gray-900 mb-2">
              {selectedBins.some((b) => binConfigs[b.id]?.moveType === 'redeployment')
                ? 'Map Legend'
                : 'Click bins to select'}
            </div>
            <div className="space-y-1.5">
            {/* Show potential location legend when redeployment is active */}
            {selectedBins.some((b) => binConfigs[b.id]?.moveType === 'redeployment') && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-400 border border-white shadow-sm flex items-center justify-center">
                    <MapPin className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-gray-700">Potential locations</span>
                </div>
                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-200">
                  <div className="w-4 h-4 rounded-full bg-green-500 border border-white shadow-sm flex items-center justify-center">
                    <MapPin className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-900">Selected destination</span>
                </div>
              </>
            )}
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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-500 border border-white shadow-sm"></div>
              <span className="text-gray-700">Missing</span>
            </div>
            <div className="flex items-center gap-2 pt-1.5 border-t border-gray-200">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600 shadow-sm"></div>
              <span className="font-semibold text-gray-900">Selected bin</span>
            </div>
          </div>
          </div>
        </div>

        {/* Selection Counter Badge */}
        {selectedBins.length > 0 && (
          <div className="absolute top-16 left-4 bg-primary text-white px-3 py-1.5 rounded-full shadow-lg font-semibold text-xs z-10">
            {selectedBins.length} bin{selectedBins.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* Bin List - Bottom Sheet on Mobile, Sidebar on Desktop */}
      <div className="
        absolute md:relative
        bottom-0 md:bottom-auto
        left-0 right-0 md:left-auto md:right-auto
        w-full md:w-[40%]
        h-[50vh] md:h-auto
        flex flex-col bg-white
        rounded-t-2xl md:rounded-none
        shadow-2xl md:shadow-none
        border-t-2 md:border-t-0 md:border-l
        border-gray-200
        z-20
      ">
        {/* Drag Handle (Mobile Only) */}
        <div className="md:hidden pt-2 pb-1 flex justify-center">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Mode Selector - Mobile Only (at top of bottom sheet) */}
        <div className="md:hidden px-3 pt-2 pb-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: 'field_bins' })}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg border-2 font-medium text-xs transition-all flex items-center justify-center gap-1.5',
                moveMode === 'field_bins'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700'
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Field Bins</span>
              {fieldBinCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {fieldBinCount}
                </Badge>
              )}
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: 'warehouse_bins' })}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg border-2 font-medium text-xs transition-all flex items-center justify-center gap-1.5',
                moveMode === 'warehouse_bins'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700'
              )}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Warehouse</span>
              {warehouseBinCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {warehouseBinCount}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="p-3 md:p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 hidden md:block">Select bins for your route template</h3>
            <h3 className="text-xs font-semibold text-gray-900 md:hidden">Select bins</h3>
            {selectedBins.length > 0 && (
              <button
                onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by bin number or address..."
                value={binSearchQuery}
                onChange={(e) => setBinSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={cn(
                  'p-1.5 border rounded-lg transition-all',
                  fillLevelFilter !== 'all'
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                )}
                title="Filter by fill level"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-[5]"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[10]">
                    <button
                      onClick={() => {
                        setFillLevelFilter('all');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50',
                        fillLevelFilter === 'all' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      All bins
                    </button>
                    <button
                      onClick={() => {
                        setFillLevelFilter('critical');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                        fillLevelFilter === 'critical' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      Critical (80-100%)
                    </button>
                    <button
                      onClick={() => {
                        setFillLevelFilter('high');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                        fillLevelFilter === 'high' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      High (50-79%)
                    </button>
                    <button
                      onClick={() => {
                        setFillLevelFilter('medium');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                        fillLevelFilter === 'medium' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      Medium (20-49%)
                    </button>
                    <button
                      onClick={() => {
                        setFillLevelFilter('low');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                        fillLevelFilter === 'low' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      Low (0-19%)
                    </button>
                    <button
                      onClick={() => {
                        setFillLevelFilter('missing');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-200',
                        fillLevelFilter === 'missing' && 'bg-blue-50 text-primary font-medium'
                      )}
                    >
                      <AlertTriangle className="w-3 h-3 text-gray-600" />
                      Missing Bins
                    </button>
                  </div>
                </>
              )}
            </div>
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
                const isMissing = b.status === 'missing';
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
                      'flex items-center gap-2 md:gap-3 p-2 md:p-3 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100',
                      isSelected && 'bg-blue-50 hover:bg-blue-100',
                      isMissing && 'bg-gray-50/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleBinMarkerClick(b)}
                      className="w-4 h-4 md:w-4 md:h-4 text-primary border-gray-300 rounded focus:ring-primary min-w-[16px]"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900">
                          Bin #{b.bin_number}
                        </span>
                        {isMissing ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                            <AlertTriangle className="w-3 h-3" />
                            MISSING
                          </span>
                        ) : (
                          b.fill_percentage !== null && (
                            <div className="flex items-center gap-1.5">
                              <div className={cn('w-2 h-2 rounded-full', fillColor)}></div>
                              <span className="text-xs text-gray-600 font-medium">
                                {b.fill_percentage}%
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {b.current_street || 'No address'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {b.city && b.zip ? `${b.city}, ${b.zip}` : 'Location unknown'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with next button - Flush with bottom, no gap */}
        <div className="sticky bottom-0 p-3 pb-3 md:p-4 md:pb-4 border-t border-gray-200 flex-shrink-0 bg-white md:bg-gray-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none -mb-3 md:mb-0">
          {/* Next Button */}
          <button
            onClick={handleNext}
            disabled={selectedBins.length === 0}
            className={cn(
              'w-full py-3 md:py-2.5 rounded-lg font-semibold text-sm transition-all',
              selectedBins.length > 0
                ? 'bg-primary text-white hover:bg-primary/90 active:bg-primary shadow-sm'
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
    console.log('📝 [UPDATE CONFIG] Bin:', binId, 'Updates:', updates);

    // Convert old BinMoveConfig updates to reducer actions
    const reducerUpdates: any = {};

    if (updates.moveType !== undefined) {
      dispatch({ type: 'SET_MOVE_TYPE', binId, moveType: updates.moveType });
    }

    if (updates.destinationType !== undefined || updates.sourcePotentialLocationId !== undefined ||
        updates.newStreet !== undefined || updates.newCity !== undefined || updates.newZip !== undefined ||
        updates.newLatitude !== undefined || updates.newLongitude !== undefined) {

      // Build destination update object - ONLY include fields that are actually provided
      const destinationUpdate: any = {};

      if (updates.destinationType !== undefined) destinationUpdate.type = updates.destinationType;
      if (updates.newStreet !== undefined) destinationUpdate.street = updates.newStreet;
      if (updates.newCity !== undefined) destinationUpdate.city = updates.newCity;
      if (updates.newZip !== undefined) destinationUpdate.zip = updates.newZip;
      if (updates.newLatitude !== undefined) destinationUpdate.latitude = updates.newLatitude;
      if (updates.newLongitude !== undefined) destinationUpdate.longitude = updates.newLongitude;
      if (updates.sourcePotentialLocationId !== undefined) destinationUpdate.potentialLocationId = updates.sourcePotentialLocationId;

      console.log('🚀 [UPDATE CONFIG] Dispatching SET_DESTINATION with:', {
        binId,
        updates,
        destinationUpdate,
      });

      dispatch({
        type: 'SET_DESTINATION',
        binId,
        destination: destinationUpdate,
      });
    }

    if (updates.assignmentType !== undefined || updates.assignedUserId !== undefined ||
        updates.assignedShiftId !== undefined || updates.insertPosition !== undefined ||
        updates.insertAfterBinId !== undefined) {
      dispatch({
        type: 'SET_ASSIGNMENT',
        binId,
        assignment: {
          type: updates.assignmentType,
          userId: updates.assignedUserId,
          shiftId: updates.assignedShiftId,
          insertPosition: updates.insertPosition,
        },
      });
    }

    if (updates.scheduledDate !== undefined || updates.dateOption !== undefined) {
      dispatch({
        type: 'SET_SCHEDULE',
        binId,
        schedule: {
          date: updates.scheduledDate,
          dateOption: updates.dateOption,
        },
      });
    }

    if (updates.reasonCategory !== undefined || updates.notes !== undefined || updates.createNoGoZone !== undefined) {
      dispatch({
        type: 'SET_METADATA',
        binId,
        metadata: {
          reason: updates.reasonCategory,
          notes: updates.notes,
          createNoGoZone: updates.createNoGoZone,
        },
      });
    }
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

  const applyBulkMoveType = (moveType: 'store' | 'relocation' | 'redeployment') => {
    const updates: Record<string, BinMoveConfig> = {};
    selectedBins.forEach((bin) => {
      // Only allow redeployment for in_storage bins
      if (moveType === 'redeployment' && bin.status !== 'in_storage') {
        return; // Skip this bin
      }
      updates[bin.id] = {
        ...binConfigs[bin.id],
        moveType,
        // Reset destination type when changing move type
        ...(moveType === 'relocation' || moveType === 'redeployment' ? { destinationType: 'custom' } : {}),
      };
    });
    setBinConfigs((prev) => ({ ...prev, ...updates }));
  };

  const applyBulkDate = (dateString: string) => {
    const scheduledDate = new Date(dateString).getTime();
    const updates: Record<string, BinMoveConfig> = {};
    selectedBins.forEach((bin) => {
      updates[bin.id] = {
        ...binConfigs[bin.id],
        scheduledDate,
        dateOption: 'custom',
      };
    });
    setBinConfigs((prev) => ({ ...prev, ...updates }));
  };

  // Handle place selection for relocation address
  const handlePlaceSelect = (binId: string, place: HerePlaceDetails) => {
    console.log('🏠 [PLACE SELECT] Selected place:', place);
    updateBinConfig(binId, {
      newStreet: place.street,
      newCity: place.city || '',
      newZip: place.zip || '',
      newLatitude: place.latitude,
      newLongitude: place.longitude,
    });
  };

  // Get active and future shifts
  const activeShifts = shifts?.filter((s) => s.status === 'active') || [];
  const futureShifts = shifts?.filter((s) => s.status === 'scheduled') || [];

  // Render Step 2: Configuration
  const renderConfigurationStep = () => (
    <div className="flex-1 overflow-y-auto p-3 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
        {/* Bulk Actions - Collapsible on Mobile */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden">
          <button
            onClick={() => setBulkActionsExpanded(!bulkActionsExpanded)}
            className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-blue-100/50 transition-colors md:cursor-default"
          >
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-700" />
              <h3 className="text-xs md:text-sm font-semibold text-gray-900">
                Quick Bulk Actions
              </h3>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-gray-600 transition-transform md:hidden",
              bulkActionsExpanded && "rotate-180"
            )} />
          </button>
          <div className={cn(
            "transition-all overflow-hidden",
            bulkActionsExpanded ? "block" : "hidden md:block"
          )}>
            <div className="px-3 pb-3 md:px-4 md:pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <GroupedDropdown
                placeholder="Select assignment..."
                value=""
                optionGroups={[
                  {
                    label: 'General',
                    options: [{ value: 'unassigned', label: 'Leave Unassigned' }],
                  },
                  ...(users && users.length > 0
                    ? [
                        {
                          label: 'Users',
                          options: users.map((user) => ({
                            value: `user:${user.id}`,
                            label: `${user.name} (${user.role})`,
                          })),
                        },
                      ]
                    : []),
                  ...(activeShifts.length > 0
                    ? [
                        {
                          label: 'Active Shifts',
                          options: activeShifts.map((shift) => ({
                            value: `active:${shift.id}`,
                            label: `Shift #${shift.id.slice(0, 8)} - ${shift.driver_name}`,
                          })),
                        },
                      ]
                    : []),
                  ...(futureShifts.length > 0
                    ? [
                        {
                          label: 'Future Shifts',
                          options: futureShifts.map((shift) => ({
                            value: `future:${shift.id}`,
                            label: `Shift #${shift.id.slice(0, 8)} - ${shift.driver_name}`,
                          })),
                        },
                      ]
                    : []),
                ]}
                onChange={(value) => {
                  if (value === 'unassigned') {
                    applyBulkAssignment('unassigned');
                  } else if (value.startsWith('user:')) {
                    applyBulkAssignment('user', value.replace('user:', ''));
                  } else if (value.startsWith('active:')) {
                    applyBulkAssignment('active_shift', value.replace('active:', ''));
                  } else if (value.startsWith('future:')) {
                    applyBulkAssignment('future_shift', value.replace('future:', ''));
                  }
                }}
              />
            </div>

            {/* Bulk Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Set All Dates:
              </label>
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) {
                    applyBulkDate(e.target.value);
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
            </div>
          </div>
        </div>

        {/* Per-Bin Configuration Cards */}
        <div className="space-y-4">
          {selectedBins.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="font-medium">No bins selected</p>
              <p className="text-sm mt-2">Go back and select bins from the map to configure moves</p>
            </div>
          )}

          {/* Show ALL selected bins in configuration step, grouped by type */}
          {fieldBinCount > 0 && (
            <div className="space-y-4">
              {/* Enhanced Field Bins Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">
                      Field Bins ({fieldBinCount})
                    </h3>
                    <p className="text-sm text-blue-700">
                      Bins currently deployed in the field
                    </p>
                  </div>
                </div>
              </div>

              {fieldBins.map((bin, index) => {
            const config = binConfigs[bin.id];
            if (!config) return null;

            return (
              <div
                key={bin.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-3 md:p-4 space-y-3 md:space-y-4 hover:border-gray-300 transition-all border-l-4 border-l-blue-500"
              >
                {/* Bin Header */}
                <div className="flex items-center justify-between pb-2 md:pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs md:text-sm font-bold"
                      style={{
                        backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                      }}
                    >
                      {bin.bin_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm md:text-base text-gray-900">Bin #{bin.bin_number}</div>
                      <div className="text-xs text-gray-500 truncate">{bin.current_street}</div>
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
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                    Move Type *
                  </label>
                  {bin.status === 'in_storage' ? (
                    // Warehouse bin - only show redeployment
                    <div>
                      <button
                        type="button"
                        onClick={() => updateBinConfig(bin.id, { moveType: 'redeployment', destinationType: 'custom' })}
                        className={cn(
                          'w-full p-3 border-2 rounded-lg text-left transition-colors',
                          config.moveType === 'redeployment'
                            ? 'border-primary bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="font-semibold text-sm text-gray-900">Redeploy</div>
                        <div className="text-xs text-gray-600">Deploy from warehouse to field</div>
                      </button>
                    </div>
                  ) : (
                    // Field bin - show store and relocate
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateBinConfig(bin.id, {
                          moveType: 'store',
                          // Wipe all destination data when switching to store
                          destinationType: 'custom',
                          sourcePotentialLocationId: null,
                          newStreet: '',
                          newCity: '',
                          newZip: '',
                          newLatitude: undefined,
                          newLongitude: undefined,
                        })}
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
                        onClick={() => updateBinConfig(bin.id, {
                          moveType: 'relocation',
                          // Wipe all destination data when switching to relocation
                          destinationType: 'custom',
                          sourcePotentialLocationId: null,
                          newStreet: '',
                          newCity: '',
                          newZip: '',
                          newLatitude: undefined,
                          newLongitude: undefined,
                        })}
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
                  )}
                </div>

                {/* Warehouse Storage Info (for store move type) */}
                {config.moveType === 'store' && (
                  <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex gap-2">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Warehouse Storage
                        </p>
                        <p className="text-xs text-blue-700">
                          This bin will be picked up from its current location and stored at the warehouse.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* New Location (for relocation OR redeployment) */}
                {(config.moveType === 'relocation' || config.moveType === 'redeployment') && (
                  <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <MapIcon className="w-4 h-4" />
                      {config.moveType === 'redeployment' ? 'Deployment Destination' : 'New Location'}
                    </h4>

                    {config.moveType === 'redeployment' && (
                      <div className="space-y-2">
                        <div className="flex gap-2 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg shadow-sm">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-orange-400 border-2 border-white shadow-md flex items-center justify-center animate-pulse">
                              <MapPin className="w-5 h-5 text-white fill-white" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-orange-900 mb-1">
                              💡 Click Orange Pins on Map
                            </p>
                            <p className="text-xs text-orange-700">
                              Orange markers show potential deployment locations. Click any marker to instantly select it as the destination.
                            </p>
                          </div>
                        </div>
                        {nearbyPotentialLocations[bin.id]?.length > 0 && (
                          <div className="text-xs text-gray-600 text-center">
                            Found {nearbyPotentialLocations[bin.id].length} potential location{nearbyPotentialLocations[bin.id].length !== 1 ? 's' : ''} on map
                          </div>
                        )}
                      </div>
                    )}

                    {/* Destination Type Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Location Type
                      </label>
                      <Dropdown
                        label=""
                        value={config.destinationType || 'custom'}
                        options={[
                          { value: 'custom', label: 'Custom Address' },
                          { value: 'potential_location', label: 'Potential Location' },
                        ]}
                        onChange={(value) => {
                          // Wipe all destination data when switching types
                          updateBinConfig(bin.id, {
                            destinationType: value as 'custom' | 'potential_location',
                            sourcePotentialLocationId: null,
                            newStreet: '',
                            newCity: '',
                            newZip: '',
                            newLatitude: undefined,
                            newLongitude: undefined,
                          });
                        }}
                      />
                    </div>

                    {/* Custom Address Fields */}
                    {config.destinationType === 'custom' && (
                      <div onClick={(e) => e.stopPropagation()}>
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

                    {/* Potential Location Selection */}
                    {config.destinationType === 'potential_location' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Selected Location
                        </label>
                        {state.ui.loadingLocations.has(bin.id) ? (
                          <div className="flex items-center justify-center py-3 text-xs text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Loading nearby locations...
                          </div>
                        ) : nearbyPotentialLocations[bin.id]?.length === 0 ? (
                          <div className="py-3 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                            No potential locations available.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {config.sourcePotentialLocationId && config.newStreet ? (
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-green-900">{config.newStreet}</div>
                                    <div className="text-xs text-green-700">{config.newCity}, {config.newZip}</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => dispatch({ type: 'OPEN_LOCATION_PICKER', binId: bin.id })}
                                    className="px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 rounded transition-colors"
                                  >
                                    Change
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => dispatch({ type: 'OPEN_LOCATION_PICKER', binId: bin.id })}
                                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-blue-50 transition-all text-center group"
                              >
                                <MapPin className="w-6 h-6 text-gray-400 group-hover:text-primary mx-auto mb-2" />
                                <div className="text-sm font-medium text-gray-700 group-hover:text-primary">
                                  Click to Select from Map
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {nearbyPotentialLocations[bin.id]?.length || 0} locations available
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Assignment - 4 Box Layout */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Assignment
                  </label>

                  {/* 4 Assignment Options Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Leave Unassigned */}
                    <button
                      type="button"
                      onClick={() => {
                        updateBinConfig(bin.id, {
                          assignmentType: 'unassigned',
                          assignedUserId: undefined,
                          assignedShiftId: undefined,
                        });
                      }}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50',
                        config.assignmentType === 'unassigned'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <X className={cn('w-4 h-4', config.assignmentType === 'unassigned' ? 'text-primary' : 'text-gray-400')} />
                        <span className={cn('text-sm font-semibold', config.assignmentType === 'unassigned' ? 'text-primary' : 'text-gray-700')}>
                          Leave Unassigned
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">No driver assigned</p>
                    </button>

                    {/* Assign to Person */}
                    <button
                      type="button"
                      onClick={() => {
                        if (config.assignmentType !== 'user') {
                          updateBinConfig(bin.id, {
                            assignmentType: 'user',
                            assignedShiftId: undefined,
                          });
                        }
                      }}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50',
                        config.assignmentType === 'user'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <User className={cn('w-4 h-4', config.assignmentType === 'user' ? 'text-primary' : 'text-gray-400')} />
                        <span className={cn('text-sm font-semibold', config.assignmentType === 'user' ? 'text-primary' : 'text-gray-700')}>
                          Assign to Person
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Manual one-off task</p>
                    </button>

                    {/* Active Shift */}
                    <button
                      type="button"
                      onClick={() => {
                        if (config.assignmentType !== 'active_shift') {
                          updateBinConfig(bin.id, {
                            assignmentType: 'active_shift',
                            assignedUserId: undefined,
                          });
                          // Auto-expand list when switching to active shift
                          setActiveShiftListExpanded((prev) => ({ ...prev, [bin.id]: true }));
                        }
                      }}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-all',
                        activeShifts.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50',
                        config.assignmentType === 'active_shift'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                      disabled={activeShifts.length === 0}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className={cn('w-4 h-4', config.assignmentType === 'active_shift' ? 'text-primary' : 'text-gray-400')} />
                        <span className={cn('text-sm font-semibold', config.assignmentType === 'active_shift' ? 'text-primary' : 'text-gray-700')}>
                          Active Shift
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {activeShifts.length === 0 ? 'No active shifts' : `${activeShifts.length} available`}
                      </p>
                    </button>

                    {/* Future Shift */}
                    <button
                      type="button"
                      onClick={() => {
                        if (config.assignmentType !== 'future_shift') {
                          updateBinConfig(bin.id, {
                            assignmentType: 'future_shift',
                            assignedUserId: undefined,
                            insertPosition: 'end',
                          });
                          // Auto-expand list when switching to future shift
                          setFutureShiftListExpanded((prev) => ({ ...prev, [bin.id]: true }));
                        }
                      }}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-all',
                        futureShifts.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50',
                        config.assignmentType === 'future_shift'
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                      disabled={futureShifts.length === 0}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className={cn('w-4 h-4', config.assignmentType === 'future_shift' ? 'text-primary' : 'text-gray-400')} />
                        <span className={cn('text-sm font-semibold', config.assignmentType === 'future_shift' ? 'text-primary' : 'text-gray-700')}>
                          Future Shift
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {futureShifts.length === 0 ? 'No future shifts' : `${futureShifts.length} scheduled`}
                      </p>
                    </button>
                  </div>

                  {/* User Selection Dropdown */}
                  {config.assignmentType === 'user' && users && users.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Select User
                      </label>
                      <Dropdown
                        label=""
                        placeholder="Choose a user..."
                        value={config.assignedUserId || ''}
                        options={users.map((user) => ({
                          value: user.id,
                          label: `${user.name} (${user.role})`,
                        }))}
                        onChange={(value) => {
                          updateBinConfig(bin.id, {
                            assignedUserId: value,
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Active Shift Selection — rich cards with collapse/expand */}
                  {config.assignmentType === 'active_shift' && activeShifts.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-gray-700">
                          Select Active Shift
                        </label>
                        {config.assignedShiftId && !activeShiftListExpanded[bin.id] && (
                          <button
                            type="button"
                            onClick={() => setActiveShiftListExpanded((prev) => ({ ...prev, [bin.id]: true }))}
                            className="text-xs text-primary hover:underline"
                          >
                            Change
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {activeShifts
                          .filter((shift) =>
                            // If collapsed and a shift is selected, only show the selected one
                            activeShiftListExpanded[bin.id] || !config.assignedShiftId
                              ? true
                              : shift.id === config.assignedShiftId
                          )
                          .map((shift) => {
                            const isSelected = config.assignedShiftId === shift.id;
                            const collected = shift.binsCollected ?? 0;
                            const total = shift.binCount ?? 0;
                            const progressPct = total > 0 ? Math.round((collected / total) * 100) : 0;
                            return (
                              <div
                                key={shift.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBinConfig(bin.id, { assignedShiftId: shift.id });
                                  // Auto-collapse after selection
                                  setActiveShiftListExpanded((prev) => ({ ...prev, [bin.id]: false }));
                                }}
                                className={cn(
                                  'relative rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-all',
                                  isSelected
                                    ? 'border-primary bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                )}
                              >
                                {/* Top row: driver name + view link */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-gray-900">
                                      {shift.driverName}
                                    </span>
                                  </div>
                                  <a
                                    href={`/operations/shifts`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    View
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                {/* Stats row */}
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Started {shift.startTime}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {collected}/{total} bins
                                  </span>
                                  {shift.total_distance_miles != null && (
                                    <span>{shift.total_distance_miles.toFixed(1)} mi</span>
                                  )}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      progressPct >= 75
                                        ? 'bg-green-500'
                                        : progressPct >= 40
                                        ? 'bg-yellow-400'
                                        : 'bg-blue-500'
                                    )}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Future Shift Selection — rich cards with collapse/expand */}
                  {config.assignmentType === 'future_shift' && futureShifts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-gray-700">
                          Select Future Shift
                        </label>
                        {config.assignedShiftId && !futureShiftListExpanded[bin.id] && (
                          <button
                            type="button"
                            onClick={() => setFutureShiftListExpanded((prev) => ({ ...prev, [bin.id]: true }))}
                            className="text-xs text-primary hover:underline"
                          >
                            Change
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {futureShifts
                          .filter((shift) =>
                            futureShiftListExpanded[bin.id] || !config.assignedShiftId
                              ? true
                              : shift.id === config.assignedShiftId
                          )
                          .map((shift) => {
                            const isSelected = config.assignedShiftId === shift.id;
                            const total = shift.binCount ?? 0;
                            return (
                              <div
                                key={shift.id}
                                onClick={() => {
                                  updateBinConfig(bin.id, { assignedShiftId: shift.id });
                                  // Auto-collapse after selection
                                  setFutureShiftListExpanded((prev) => ({ ...prev, [bin.id]: false }));
                                }}
                                className={cn(
                                  'relative rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-all',
                                  isSelected
                                    ? 'border-primary bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                )}
                              >
                                {/* Top row: driver name + view link */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-gray-900">
                                      {shift.driverName}
                                    </span>
                                  </div>
                                  <a
                                    href={`/operations/shifts`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    View
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                {/* Stats row */}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {shift.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {shift.startTime}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    {total} bins planned
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date *
                  </label>
                  {/* Quick-pick date badges */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateBinConfig(bin.id, {
                          scheduledDate: addDays(new Date(), 1).getTime(),
                          dateOption: '24h',
                        });
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-center',
                        config.dateOption === '24h'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Within 24hrs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateBinConfig(bin.id, {
                          scheduledDate: addDays(new Date(), 3).getTime(),
                          dateOption: '3days',
                        });
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-center',
                        config.dateOption === '3days'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Within 3 days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateBinConfig(bin.id, {
                          scheduledDate: addDays(new Date(), 7).getTime(),
                          dateOption: 'week',
                        });
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-center',
                        config.dateOption === 'week'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Next week
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateBinConfig(bin.id, { dateOption: 'custom' });
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-center',
                        config.dateOption === 'custom'
                          ? 'border-primary bg-blue-50 text-primary'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Custom date
                    </button>
                  </div>
                  {/* Custom date input - always visible but prominent when custom is selected */}
                  <input
                    type="date"
                    value={new Date(config.scheduledDate).toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value).getTime();
                      updateBinConfig(bin.id, {
                        scheduledDate: newDate,
                        dateOption: 'custom',
                      });
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className={cn(
                      'w-full px-3 py-2 border-2 rounded-lg text-sm focus:ring-2 focus:ring-primary transition-colors',
                      config.dateOption === 'custom'
                        ? 'border-primary focus:border-primary'
                        : 'border-gray-200 focus:border-primary'
                    )}
                  />
                </div>

                {/* Reason Category - Only show for store and relocation, NOT redeployment */}
                {config.moveType !== 'redeployment' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Reason for Move <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <Dropdown
                        label=""
                        value={config.reasonCategory || ''}
                        options={[
                          { value: '', label: 'Select a reason...' },
                          ...MOVE_REASON_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                        ]}
                        onChange={(value) => updateBinConfig(bin.id, {
                          reasonCategory: value ? value as BinChangeReasonCategory : undefined,
                          createNoGoZone: false,
                        })}
                        className="w-full"
                      />
                    </div>

                    {/* Auto no-go zone notice */}
                    {config.reasonCategory && MOVE_REASON_OPTIONS.find((o) => o.value === config.reasonCategory)?.autoZone && (
                      <div className="flex gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          A no-go zone will be automatically created at the current bin location.
                        </p>
                      </div>
                    )}

                    {/* Optional no-go zone checkbox for relocation_request */}
                    {config.reasonCategory === 'relocation_request' && (
                      <div className="flex items-start gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <input
                          id={`no-go-zone-${bin.id}`}
                          type="checkbox"
                          checked={config.createNoGoZone ?? false}
                          onChange={(e) => updateBinConfig(bin.id, { createNoGoZone: e.target.checked })}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor={`no-go-zone-${bin.id}`} className="text-xs text-gray-700 cursor-pointer">
                          <span className="font-medium">Create no-go zone</span> at current location
                        </label>
                      </div>
                    )}
                  </>
                )}

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
          )}

          {/* Warehouse Bins Section */}
          {warehouseBinCount > 0 && (
            <div className="space-y-4">
              {/* Enhanced Warehouse Bins Header */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center shadow-md">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900">
                      Warehouse Bins ({warehouseBinCount})
                    </h3>
                    <p className="text-sm text-green-700">
                      Bins currently stored in warehouse
                    </p>
                  </div>
                </div>
              </div>

              {warehouseBins.map((bin, index) => {
            const config = binConfigs[bin.id];
            if (!config) return null;

            return (
              <div
                key={bin.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 space-y-4 hover:border-gray-300 transition-all border-l-4 border-l-green-600"
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
                    onClick={() => handleRemoveBin(bin.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                {/* Move Type (Warehouse bins are always redeployment) */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Move Type *
                  </label>
                  <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    Redeployment (Deploy bin from warehouse to field)
                  </div>
                </div>

                {/* Destination Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Deployment Location *
                  </label>

                  {/* Destination Type Dropdown */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Location Type
                    </label>
                    <Dropdown
                      label=""
                      value={config.destinationType || 'potential_location'}
                      options={[
                        { value: 'custom', label: 'Custom Address' },
                        { value: 'potential_location', label: 'Potential Location' },
                      ]}
                      onChange={(value) => {
                        // Wipe all destination data when switching types
                        updateBinConfig(bin.id, {
                          destinationType: value as 'custom' | 'potential_location',
                          sourcePotentialLocationId: null,
                          newStreet: '',
                          newCity: '',
                          newZip: '',
                          newLatitude: undefined,
                          newLongitude: undefined,
                        });
                      }}
                    />
                  </div>

                  {/* Custom Address Fields */}
                  {config.destinationType === 'custom' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <div className="mb-2">
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

                  {/* Potential Location Selection */}
                  {config.destinationType === 'potential_location' && (
                    <div>
                      {config.sourcePotentialLocationId && config.newStreet ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">
                              {config.newStreet}
                            </div>
                            <div className="text-xs text-green-700 mt-0.5">
                              {config.newCity}, {config.newZip}
                            </div>
                          </div>
                          <button
                            onClick={() => dispatch({ type: 'OPEN_LOCATION_PICKER', binId: bin.id })}
                            className="text-xs text-green-700 hover:text-green-900 font-medium ml-2"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => dispatch({ type: 'OPEN_LOCATION_PICKER', binId: bin.id })}
                          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-sm text-gray-600 hover:text-primary font-medium"
                        >
                          Select deployment location from map
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Assignment */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Assignment
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateBinConfig(bin.id, {
                          assignmentType: 'unassigned',
                          assignedUserId: undefined,
                          assignedShiftId: undefined,
                        });
                      }}
                      className={cn(
                        'flex-1 px-3 py-2 border rounded-lg text-xs font-medium transition-all',
                        config.assignment?.type === 'unassigned'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      )}
                    >
                      Leave Unassigned
                    </button>
                  </div>
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    value={config.schedule?.date ? new Date(config.schedule.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const newDate = new Date(e.target.value).getTime();
                        updateBinConfig(bin.id, {
                          scheduledDate: newDate,
                          dateOption: 'custom',
                        });
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
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
          )}
        </div>

        {/* Footer Actions - Flush with bottom, no gap */}
        <div className="flex gap-2 md:gap-4 p-3 pb-3 md:pt-4 md:pb-4 md:px-0 border-t border-gray-200 sticky bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none -mx-3 md:mx-0 -mb-3 md:mb-0">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', step: 'selection' })}
            className="flex-1 md:flex-none md:px-8 py-3 border-2 border-gray-300 rounded-lg md:rounded-xl font-semibold text-sm md:text-base hover:bg-gray-50 active:bg-gray-100 transition-all"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 inline mr-1 md:mr-2" />
            Back
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_STEP', step: 'review' })}
            className="flex-1 md:flex-none md:px-8 py-3 bg-primary text-white rounded-lg md:rounded-xl font-semibold text-sm md:text-base hover:bg-primary/90 active:bg-primary transition-all"
          >
            <span className="hidden md:inline">Next: Review ({selectedBins.length})</span>
            <span className="md:hidden">Review ({selectedBins.length})</span>
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 inline ml-1 md:ml-2" />
          </button>
        </div>
      </div>
    </div>
  );

  // Render Step 3: Review & Confirm
  const renderReviewStep = () => (
    <div className="flex-1 overflow-y-auto p-3 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Summary Header */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 md:p-6 border border-green-200">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                Review Your Move Requests
              </h3>
              <p className="text-sm md:text-base text-gray-700">
                You're about to schedule <span className="font-semibold">{selectedBins.length} bin move{selectedBins.length !== 1 ? 's' : ''}</span>.
                Please review the details below before submitting.
              </p>
              {fieldBinCount > 0 && warehouseBinCount > 0 && (
                <div className="flex gap-3 mt-3">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {fieldBinCount} Field Bin{fieldBinCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    {warehouseBinCount} Warehouse Bin{warehouseBinCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Move Request Cards */}
        <div className="space-y-3 md:space-y-4">
          {selectedBins.map((bin) => {
            const config = binConfigs[bin.id];
            if (!config) return null;

            const assignedUser = config.assignedUserId ? users?.find(u => u.id === config.assignedUserId) : null;
            const assignedShift = config.assignedShiftId ? shifts?.find(s => s.id === config.assignedShiftId) : null;

            return (
              <Card key={bin.id} className="p-4 md:p-5 border-2 border-gray-200 hover:border-gray-300 transition-all">
                {/* Bin Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm md:text-base font-bold flex-shrink-0"
                      style={{
                        backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                      }}
                    >
                      {bin.bin_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base md:text-lg text-gray-900">Bin #{bin.bin_number}</div>
                      <div className="text-sm text-gray-600 truncate">{bin.current_street}</div>
                      <div className="text-xs text-gray-500">{bin.city}, {bin.zip}</div>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 capitalize flex-shrink-0">
                    {config.moveType}
                  </Badge>
                </div>

                {/* Move Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scheduled Date */}
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 font-medium">Scheduled Date</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {format(config.scheduledDate, 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>

                  {/* Assignment */}
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 font-medium">Assignment</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {config.assignmentType === 'unassigned' && 'Unassigned'}
                        {config.assignmentType === 'user' && assignedUser && assignedUser.name}
                        {(config.assignmentType === 'active_shift' || config.assignmentType === 'future_shift') &&
                          assignedShift && `Shift - ${assignedShift.driver_name}`}
                      </div>
                    </div>
                  </div>

                  {/* Destination (for relocation/redeployment) */}
                  {(config.moveType === 'relocation' || config.moveType === 'redeployment') && config.newStreet && (
                    <div className="flex items-start gap-2 md:col-span-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 font-medium">New Location</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {config.newStreet}
                          {config.newCity && config.newZip && `, ${config.newCity}, ${config.newZip}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes (if any) */}
                  {config.notes && (
                    <div className="flex items-start gap-2 md:col-span-2">
                      <AlertTriangle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 font-medium">Notes</div>
                        <div className="text-sm text-gray-700">{config.notes}</div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer Actions - Flush with bottom, no gap */}
        <div className="flex gap-2 md:gap-4 p-3 pb-3 md:pt-4 md:pb-4 md:px-0 border-t border-gray-200 sticky bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none -mx-3 md:mx-0 -mb-3 md:mb-0">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', step: 'configuration' })}
            disabled={isSubmitting}
            className="flex-1 md:flex-none md:px-8 py-3 border-2 border-gray-300 rounded-lg md:rounded-xl font-semibold text-sm md:text-base hover:bg-gray-50 active:bg-gray-100 transition-all disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 inline mr-1 md:mr-2" />
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 md:flex-none md:px-8 py-3 bg-green-600 text-white rounded-lg md:rounded-xl font-semibold text-sm md:text-base hover:bg-green-700 active:bg-green-600 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 inline mr-1 md:mr-2 animate-spin" />
                <span className="hidden md:inline">Creating {selectedBins.length} move{selectedBins.length !== 1 ? 's' : ''}...</span>
                <span className="md:hidden">Creating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 inline mr-1 md:mr-2" />
                <span className="hidden md:inline">
                  Confirm & Schedule {selectedBins.length} Move{selectedBins.length !== 1 ? 's' : ''}
                </span>
                <span className="md:hidden">
                  Confirm ({selectedBins.length})
                </span>
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
                'w-full h-full md:w-[95vw] md:max-w-[1400px] md:h-[90vh] md:rounded-2xl rounded-none pointer-events-auto overflow-hidden flex flex-col',
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
                      {wizardStep === 'selection' && 'Step 1 of 3: Select bins from map or search'}
                      {wizardStep === 'configuration' && `Step 2 of 3: Configure ${selectedBins.length} move request${selectedBins.length !== 1 ? 's' : ''}`}
                      {wizardStep === 'review' && `Step 3 of 3: Review & confirm ${selectedBins.length} move request${selectedBins.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Mode Selector - Only show in selection step (hidden on mobile, shown in bottom sheet) */}
                {wizardStep === 'selection' && (
                  <div className="mt-4 flex gap-2 hidden md:flex">
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_MODE', mode: 'field_bins' });
                      }}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all',
                        moveMode === 'field_bins'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          <span>Field Bins</span>
                        </div>
                        {fieldBinCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {fieldBinCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Store or relocate active bins</p>
                    </button>
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_MODE', mode: 'warehouse_bins' });
                      }}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all',
                        moveMode === 'warehouse_bins'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          <span>Warehouse Bins</span>
                        </div>
                        {warehouseBinCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {warehouseBinCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Deploy bins from warehouse to field</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex overflow-hidden">
                {wizardStep === 'selection' && renderSelectionStep()}
                {wizardStep === 'configuration' && renderConfigurationStep()}
                {wizardStep === 'review' && renderReviewStep()}
              </div>
            </Card>
          </div>

          {/* Potential Location Picker Modal */}
          {locationPickerBinId && (() => {
            const bin = selectedBins.find(b => b.id === locationPickerBinId);
            const locations = nearbyPotentialLocations[locationPickerBinId];
            const config = binConfigs[locationPickerBinId];

            if (!bin || !locations) return null;

            // Calculate reserved locations (selected by other bins)
            const reservedLocations = selectedBins
              .filter(b => b.id !== locationPickerBinId) // Exclude current bin
              .map(b => {
                const otherConfig = binConfigs[b.id];
                if (otherConfig?.sourcePotentialLocationId) {
                  return {
                    locationId: otherConfig.sourcePotentialLocationId,
                    binNumber: b.bin_number,
                  };
                }
                return null;
              })
              .filter((r): r is { locationId: string; binNumber: number } => r !== null);

            return (
              <PotentialLocationPickerModal
                bin={bin}
                potentialLocations={locations}
                selectedLocationId={config?.sourcePotentialLocationId}
                reservedLocations={reservedLocations}
                onSelect={(location) => {
                  updateBinConfig(locationPickerBinId, {
                    destinationType: 'potential_location',
                    sourcePotentialLocationId: location.id,
                    newStreet: location.street,
                    newCity: location.city,
                    newZip: location.zip,
                    newLatitude: location.latitude,
                    newLongitude: location.longitude,
                  });
                  dispatch({ type: 'CLOSE_LOCATION_PICKER' });
                }}
                onClose={() => dispatch({ type: 'CLOSE_LOCATION_PICKER' })}
              />
            );
          })()}
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
