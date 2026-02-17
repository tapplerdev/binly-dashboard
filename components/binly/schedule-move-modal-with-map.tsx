'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Filter,
  Lasso,
  Move,
} from 'lucide-react';
import { createMoveRequest, assignMoveToShift, assignMoveToUser } from '@/lib/api/move-requests';
import { getShifts, getShiftDetailsByDriverId, Shift } from '@/lib/api/shifts';
import { getUsers, User as UserType } from '@/lib/api/users';
import { cn } from '@/lib/utils';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails } from '@/lib/services/geocoding.service';
import { format, addDays } from 'date-fns';
import { GroupedDropdown, Dropdown } from '@/components/ui/dropdown';

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
  dateOption: '24h' | '3days' | 'week' | 'custom'; // Quick-pick date option
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

  // UI State
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('selection');
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form'); // Mobile toggle

  // Map State
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null);
  const [lassoMode, setLassoMode] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);

  // Drag-to-Relocate State
  const [binRelocations, setBinRelocations] = useState<Record<string, {
    newLat: number;
    newLng: number;
    newAddress?: string;
    newCity?: string;
    newZip?: string;
  }>>({});

  // Bin Selection State
  const [selectedBins, setSelectedBins] = useState<BinWithPriority[]>(
    bin ? [bin] : bins || []
  );
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  // Filter State
  const [fillLevelFilter, setFillLevelFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical' | 'missing'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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
    const defaultScheduledDate = addDays(new Date(), 1).getTime();
    selectedBins.forEach((b) => {
      if (!binConfigs[b.id]) {
        newConfigs[b.id] = {
          bin: b,
          moveType: 'store',
          scheduledDate: defaultScheduledDate,
          dateOption: '24h',
          assignmentType: 'unassigned',
        };
      } else {
        newConfigs[b.id] = binConfigs[b.id];
      }
    });
    setBinConfigs(newConfigs);
  }, [selectedBins]);

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

    // Pan to bin (check both coordinate field options)
    const lat = clickedBin.current_latitude ?? clickedBin.latitude;
    const lng = clickedBin.current_longitude ?? clickedBin.longitude;

    if (lat && lng) {
      setMapCenter({ lat, lng });
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

    // Initialize bin configs with relocation data for dragged bins
    const initialConfigs: Record<string, BinMoveConfig> = {};
    // Default scheduled date to tomorrow
    const defaultScheduledDate = addDays(new Date(), 1).getTime();

    selectedBins.forEach((bin) => {
      const relocation = binRelocations[bin.id];

      if (relocation) {
        // Bin was relocated via drag - auto-set to relocation mode
        initialConfigs[bin.id] = {
          bin,
          moveType: 'relocation',
          scheduledDate: defaultScheduledDate,
          dateOption: '24h',
          newStreet: relocation.newAddress || '',
          newCity: relocation.newCity || '',
          newZip: relocation.newZip || '',
          newLatitude: relocation.newLat,
          newLongitude: relocation.newLng,
          reason: '',
          notes: '',
          assignmentType: 'unassigned',
        };
      } else {
        // Bin not relocated - default to store
        initialConfigs[bin.id] = {
          bin,
          moveType: 'store',
          scheduledDate: defaultScheduledDate,
          dateOption: '24h',
          reason: '',
          notes: '',
          assignmentType: 'unassigned',
        };
      }
    });

    setBinConfigs(initialConfigs);
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

  // Filter bins for list view
  const filteredBinsForList = useMemo(() => {
    if (!allBins) return [];

    let filtered = [...allBins];

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

    // Apply fill level filter
    if (fillLevelFilter !== 'all') {
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
  }, [allBins, binSearchQuery, fillLevelFilter]);

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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-500 border border-white shadow-sm"></div>
              <span className="text-gray-700">Missing</span>
            </div>
            <div className="flex items-center gap-2 pt-1.5 border-t border-gray-200">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600 shadow-sm"></div>
              <span className="font-semibold text-gray-900">Selected</span>
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
                      'flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors',
                      isSelected && 'bg-blue-50 hover:bg-blue-100',
                      isMissing && 'bg-gray-50/50'
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

        {/* Footer with next button */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
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
    updateBinConfig(binId, {
      newStreet: place.address,
      newCity: place.city || '',
      newZip: place.postalCode || '',
      newLatitude: place.latitude,
      newLongitude: place.longitude,
    });
  };

  // Get active and future shifts
  const activeShifts = shifts?.filter((s) => s.status === 'active') || [];
  const futureShifts = shifts?.filter((s) => s.status === 'scheduled') || [];

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

                  {/* Active Shift Selection Dropdown */}
                  {config.assignmentType === 'active_shift' && activeShifts.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Select Active Shift
                      </label>
                      <Dropdown
                        label=""
                        placeholder="Choose a shift..."
                        value={config.assignedShiftId || ''}
                        options={activeShifts.map((shift) => ({
                          value: shift.id,
                          label: `${shift.driverName} - Shift #${shift.id.slice(0, 8)}`,
                        }))}
                        onChange={(value) => {
                          updateBinConfig(bin.id, {
                            assignedShiftId: value,
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Future Shift Selection Dropdown */}
                  {config.assignmentType === 'future_shift' && futureShifts.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Select Future Shift
                      </label>
                      <Dropdown
                        label=""
                        placeholder="Choose a shift..."
                        value={config.assignedShiftId || ''}
                        options={futureShifts.map((shift) => ({
                          value: shift.id,
                          label: `${shift.driverName} - ${shift.date} at ${shift.startTime}`,
                        }))}
                        onChange={(value) => {
                          updateBinConfig(bin.id, {
                            assignedShiftId: value,
                          });
                        }}
                      />
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
