'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBin } from '@/lib/api/bins';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2, Loader2, Package, MapPin, Navigation, MapIcon, List } from 'lucide-react';
import { cn } from '@/lib/utils';
// OLD: Google Places Autocomplete (commented out for rollback)
// import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
// NEW: HERE Maps Autocomplete
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { hereReverseGeocode, HerePlaceDetails } from '@/lib/services/geocoding.service';
import { Map as GoogleMap, AdvancedMarker, Pin, useMap, InfoWindow } from '@vis.gl/react-google-maps';

interface BinRow {
  id: string;
  bin_number: string; // Optional - auto-assigned if not provided
  current_street: string;
  city: string;
  zip: string;
  latitude: string;
  longitude: string;
  // Track what was manually entered vs auto-filled
  cityAutoFilled: boolean;
  zipAutoFilled: boolean;
  coordinatesAutoFilled: boolean;
  addressAutoFilled: boolean;
  isGeocodingAddress: boolean; // Loading state when selecting from autocomplete
  isGeocodingCoordinates: boolean; // Loading state for reverse geocoding
  error?: string;
}

interface BulkCreateBinModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

// Map content component that can use the useMap hook
const MapContent = React.memo(function MapContent({
  rows,
  currentRowIndex,
  onMarkerDrag,
  onMarkerClick,
  locateTriggerId,
  mapCenter,
  mapZoom
}: {
  rows: BinRow[];
  currentRowIndex: number;
  onMarkerDrag: (lat: number, lng: number) => void;
  onMarkerClick: (index: number) => void;
  locateTriggerId: string | null;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
}) {
  const map = useMap();
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(null);

  // Handle map center and zoom changes (when address is selected)
  React.useEffect(() => {
    if (!map) return;
    map.panTo(mapCenter);
    map.setZoom(mapZoom);
  }, [mapCenter, mapZoom, map]);

  // Handle locate trigger
  React.useEffect(() => {
    if (!locateTriggerId || !map) return;

    const row = rows.find(r => r.id === locateTriggerId);
    if (!row || !row.latitude || !row.longitude) return;

    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    // Pan and zoom to the bin location
    map.panTo({ lat, lng });
    map.setZoom(17);
  }, [locateTriggerId, map, rows]);

  return (
    <>
      {rows.map((row, index) => {
        if (!row.latitude || !row.longitude) return null;

        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);

        if (isNaN(lat) || isNaN(lng)) return null;

        return (
          <React.Fragment key={row.id}>
            <AdvancedMarker
              key={`marker-${row.id}`}
              position={{ lat, lng }}
              draggable={index === currentRowIndex}
              onClick={() => {
                setSelectedMarkerId(row.id);
                onMarkerClick(index);
              }}
              onDragEnd={(e) => {
                if (e.latLng && index === currentRowIndex) {
                  onMarkerDrag(e.latLng.lat(), e.latLng.lng());
                }
              }}
            />
            {selectedMarkerId === row.id && (
              <InfoWindow
                position={{ lat, lng }}
                onCloseClick={() => setSelectedMarkerId(null)}
                options={{
                  pixelOffset: new google.maps.Size(0, -60),
                  maxWidth: 150,
                }}
              >
                <div className="p-1 text-center">
                  <h3 className="font-semibold text-[11px] text-gray-900 whitespace-nowrap">Bin #{index + 1}</h3>
                  {row.current_street && (
                    <p className="text-[9px] text-gray-600 mt-0.5 leading-tight truncate">{row.current_street}</p>
                  )}
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
});

export function BulkCreateBinModal({ onClose, onSuccess }: BulkCreateBinModalProps) {
  const queryClient = useQueryClient();
  const [isClosing, setIsClosing] = useState(false);
  const [rows, setRows] = useState<BinRow[]>([
    {
      id: '1',
      bin_number: '',
      current_street: '',
      city: '',
      zip: '',
      latitude: '',
      longitude: '',
      cityAutoFilled: false,
      zipAutoFilled: false,
      coordinatesAutoFilled: false,
      addressAutoFilled: false,
      isGeocodingAddress: false,
      isGeocodingCoordinates: false,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0); // Track which bin we're editing
  const [locateTriggerId, setLocateTriggerId] = useState<string | null>(null);

  // Default map center (will update based on bin location)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.7749, // Default to San Francisco
    lng: -122.4194,
  });
  const [mapZoom, setMapZoom] = useState(13);
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form'); // Mobile view toggle

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Function to trigger locate on map
  const locateBinOnMap = useCallback((binId: string) => {
    setLocateTriggerId(binId);
    // Reset after a brief moment to allow for re-triggering
    setTimeout(() => setLocateTriggerId(null), 100);
  }, []);

  const addRow = () => {
    const newId = (Math.max(...rows.map((r) => parseInt(r.id))) + 1).toString();
    setRows([
      ...rows,
      {
        id: newId,
        bin_number: '',
        current_street: '',
        city: '',
        zip: '',
        latitude: '',
        longitude: '',
        cityAutoFilled: false,
        zipAutoFilled: false,
        coordinatesAutoFilled: false,
        addressAutoFilled: false,
        isGeocodingAddress: false,
        isGeocodingCoordinates: false,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof BinRow, value: string | number) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value, error: undefined } : r)));
  };

  // OLD: Google Places autocomplete selection (commented out for rollback)
  // const handlePlaceSelect = (id: string, place: google.maps.places.PlaceResult) => {
  //   if (!place.address_components || !place.geometry) return;
  //
  //   // Parse address components
  //   let street = '';
  //   let city = '';
  //   let zip = '';
  //
  //   place.address_components.forEach((component) => {
  //     const types = component.types;
  //
  //     if (types.includes('street_number')) {
  //       street = component.long_name;
  //     }
  //     if (types.includes('route')) {
  //       street = street ? `${street} ${component.long_name}` : component.long_name;
  //     }
  //     if (types.includes('locality')) {
  //       city = component.long_name;
  //     }
  //     if (!city && types.includes('sublocality_level_1')) {
  //       city = component.long_name;
  //     }
  //     if (types.includes('postal_code')) {
  //       zip = component.long_name;
  //     }
  //   });
  //
  //   const lat = place.geometry.location?.lat();
  //   const lng = place.geometry.location?.lng();
  //
  //   // Update map center to the selected location
  //   if (lat && lng) {
  //     setMapCenter({ lat, lng });
  //     setMapZoom(16); // Zoom in when address is selected
  //   }
  //
  //   // Update all fields with auto-filled data
  //   setRows((prevRows) =>
  //     prevRows.map((r) =>
  //       r.id === id
  //         ? {
  //             ...r,
  //             current_street: street.trim(),
  //             city: city.trim(),
  //             zip: zip.trim(),
  //             latitude: lat ? lat.toString() : '',
  //             longitude: lng ? lng.toString() : '',
  //             cityAutoFilled: true,
  //             zipAutoFilled: true,
  //             coordinatesAutoFilled: true,
  //             addressAutoFilled: false,
  //             isGeocodingAddress: false,
  //           }
  //         : r
  //     )
  //   );
  // };

  // NEW: HERE Maps autocomplete selection
  const handlePlaceSelect = (id: string, place: HerePlaceDetails) => {
    console.log('🗺️ HERE MAPS BULK MODAL: Place selected for row', id);
    console.log('   Street:', place.street);
    console.log('   City:', place.city);
    console.log('   ZIP:', place.zip);
    console.log('   Coordinates:', place.latitude, place.longitude);

    // Update map center to the selected location
    setMapCenter({ lat: place.latitude, lng: place.longitude });
    setMapZoom(16); // Zoom in when address is selected

    // Check if street address is missing
    const missingStreet = !place.street || place.street.trim() === '';

    // Update all fields with auto-filled data from HERE Maps (already parsed!)
    setRows((prevRows) =>
      prevRows.map((r) =>
        r.id === id
          ? {
              ...r,
              current_street: place.street.trim(),
              city: place.city.trim(),
              zip: place.zip.trim(),
              latitude: place.latitude.toString(),
              longitude: place.longitude.toString(),
              cityAutoFilled: true,
              zipAutoFilled: true,
              coordinatesAutoFilled: true,
              addressAutoFilled: false,
              isGeocodingAddress: false,
              error: missingStreet ? 'Street address is required. Please enter it manually or select a different location.' : undefined,
            }
          : r
      )
    );
  };

  // Reverse geocoding: When BOTH coordinates are filled
  // Debounce timers for reverse geocoding
  const geocodeTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const handleCoordinateChange = async (id: string, field: 'latitude' | 'longitude', value: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    // Clear existing timer for this row
    if (geocodeTimersRef.current[id]) {
      clearTimeout(geocodeTimersRef.current[id]);
      delete geocodeTimersRef.current[id];
    }

    // Update the field immediately
    updateRow(id, field, value);

    // Mark that coordinates were manually changed
    setRows((prevRows) =>
      prevRows.map((r) =>
        r.id === id ? { ...r, coordinatesAutoFilled: false } : r
      )
    );

    // Get updated coordinates
    const updatedRow = {
      ...row,
      [field]: value,
    };

    // Only proceed if both fields have values
    if (!updatedRow.latitude || !updatedRow.longitude) {
      return;
    }

    // Validate that both are valid numbers
    const lat = parseFloat(updatedRow.latitude);
    const lng = parseFloat(updatedRow.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return;
    }

    // Additional validation: check reasonable coordinate ranges
    // Latitude: -90 to 90, Longitude: -180 to 180
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return;
    }

    // Debounce: Wait 1.5 seconds after user stops typing
    geocodeTimersRef.current[id] = setTimeout(async () => {
      // Set loading state
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.id === id ? { ...r, isGeocodingCoordinates: true } : r
        )
      );

      // Reverse geocode
      const result = await hereReverseGeocode(lat, lng);

      if (result) {
        setRows((prevRows) =>
          prevRows.map((r) =>
            r.id === id
              ? {
                  ...r,
                  current_street: result.street,
                  city: result.city,
                  zip: result.zip,
                  addressAutoFilled: true,
                  cityAutoFilled: true,
                  zipAutoFilled: true,
                  isGeocodingCoordinates: false,
                }
              : r
          )
        );
      } else {
        setRows((prevRows) =>
          prevRows.map((r) =>
            r.id === id ? { ...r, isGeocodingCoordinates: false } : r
          )
        );
      }

      // Clean up timer reference
      delete geocodeTimersRef.current[id];
    }, 1500); // 1.5 second debounce
  };

  // Handle marker drag on map
  const handleMarkerDrag = useCallback(async (lat: number, lng: number) => {
    const currentRow = rows[currentRowIndex];
    if (!currentRow) return;

    // Update coordinates immediately
    setRows((prevRows) =>
      prevRows.map((r, idx) =>
        idx === currentRowIndex
          ? {
              ...r,
              latitude: lat.toFixed(6),
              longitude: lng.toFixed(6),
              coordinatesAutoFilled: false,
            }
          : r
      )
    );

    // Update map center
    setMapCenter({ lat, lng });

    // Reverse geocode to update address fields (using HERE Maps)
    setRows((prevRows) =>
      prevRows.map((r, idx) =>
        idx === currentRowIndex ? { ...r, isGeocodingCoordinates: true } : r
      )
    );

    const result = await hereReverseGeocode(lat, lng);

    if (result) {
      setRows((prevRows) =>
        prevRows.map((r, idx) =>
          idx === currentRowIndex
            ? {
                ...r,
                current_street: result.street,
                city: result.city,
                zip: result.zip,
                addressAutoFilled: true,
                cityAutoFilled: true,
                zipAutoFilled: true,
                isGeocodingCoordinates: false,
              }
            : r
        )
      );
    } else {
      setRows((prevRows) =>
        prevRows.map((r, idx) =>
          idx === currentRowIndex ? { ...r, isGeocodingCoordinates: false } : r
        )
      );
    }
  }, [currentRowIndex, rows]);

  const validateRows = (): boolean => {
    let isValid = true;
    const updatedRows = rows.map((row) => {
      // Check if row has any data
      const hasAnyData = row.current_street || row.city || row.zip || row.latitude || row.longitude;

      if (hasAnyData) {
        // Require BOTH complete address AND coordinates
        const hasCompleteAddress = row.current_street && row.city && row.zip;
        const hasCompleteCoordinates = row.latitude && row.longitude;

        if (!hasCompleteAddress) {
          isValid = false;
          return { ...row, error: 'Street address, city, and ZIP are required' };
        }

        if (!hasCompleteCoordinates) {
          isValid = false;
          return { ...row, error: 'Both latitude and longitude are required' };
        }
      }

      return row;
    });

    setRows(updatedRows);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateRows()) {
      setGlobalError('Please complete all required fields for each bin');
      return;
    }

    // Filter out empty rows (require BOTH complete address AND coordinates)
    const validRows = rows.filter(
      (r) =>
        r.current_street && r.city && r.zip && r.latitude && r.longitude
    );

    if (validRows.length === 0) {
      setGlobalError('Please add at least one bin');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create all bins in parallel
      const promises = validRows.map((row) =>
        createBin({
          bin_number: row.bin_number && parseInt(row.bin_number) > 0 ? parseInt(row.bin_number) : undefined,
          current_street: row.current_street,
          city: row.city,
          zip: row.zip,
          status: 'active',
          fill_percentage: 0, // New bins are always empty
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
        })
      );

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ['bins'] });
      onSuccess?.();
      handleClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create bins';
      // Check if it's a bin number conflict error
      if (errorMessage.includes('Bin number already exists') || errorMessage.includes('409')) {
        setGlobalError('One or more bin numbers already exist. Please use different bin numbers or leave empty for auto-assignment.');
      } else {
        setGlobalError(errorMessage);
      }
      setIsSubmitting(false);
    }
  };

  const validRowCount = rows.filter(
    (r) =>
      r.current_street && r.city && r.zip && r.latitude && r.longitude
  ).length;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-2 md:p-4">
        <Card
          className={`w-full max-w-[95vw] h-[95vh] md:h-[90vh] overflow-hidden flex pointer-events-auto rounded-xl md:rounded-2xl ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Responsive Layout: Vertical on mobile, Side-by-Side on desktop */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left Side: Input Panel - Full width on mobile, 550px on desktop */}
            <div className="w-full md:w-[550px] flex flex-col border-b md:border-b-0 md:border-r border-gray-200 bg-white">
              {/* Panel Header */}
              <div className="p-4 md:p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-gray-900">Create New Bin</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Bin numbers auto-assigned if not specified
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Mobile View Toggle (only visible on mobile) */}
                <div className="flex md:hidden gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      viewMode === 'form'
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <List className="w-4 h-4" />
                      <span>Form</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      viewMode === 'map'
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MapIcon className="w-4 h-4" />
                      <span>Map</span>
                    </div>
                  </button>
                </div>

                <p className="text-xs text-blue-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Enter address or drag pin to fine-tune</span>
                  <span className="md:hidden">
                    {viewMode === 'form' ? 'Enter address below' : 'View bin locations'}
                  </span>
                </p>
              </div>

              {/* Scrollable Form Content - Hidden on mobile when map is shown */}
              <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${viewMode === 'map' ? 'hidden md:block' : 'block'}`}>
                <div className="space-y-3 md:space-y-4">
                {/* Bin Cards */}
                {rows.map((row, index) => {
                  // Helper function for field styling
                  const getFieldStyle = (isAutoFilled: boolean, isLoading: boolean) => {
                    if (isLoading) {
                      return 'bg-gray-100 animate-pulse border-gray-300';
                    }
                    if (isAutoFilled) {
                      return 'bg-blue-50 border-blue-300 text-gray-900';
                    }
                    return 'bg-white border-gray-300 text-gray-900';
                  };

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "p-4 border rounded-lg space-y-3 cursor-pointer transition-all",
                        currentRowIndex === index
                          ? "border-primary bg-blue-50 ring-2 ring-primary ring-opacity-20"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                      onClick={() => setCurrentRowIndex(index)}
                    >
                      {/* Header with Bin number and actions */}
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Bin</h4>
                        <div className="flex items-center gap-2">
                          {/* Locate on Map button - only show if bin has coordinates */}
                          {row.latitude && row.longitude && (
                            <button
                              type="button"
                              onClick={() => locateBinOnMap(row.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              title="Locate on map"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Locate
                            </button>
                          )}
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove bin"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bin Number (Optional) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Bin Number (optional)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.bin_number}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            updateRow(row.id, 'bin_number', value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors bg-white text-gray-900"
                          placeholder="Auto-assigned if left empty"
                        />
                      </div>

                      {/* Street Address */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Street Address *
                        </label>
                        {/* OLD: Google Places Autocomplete (commented out for rollback) */}
                        {/* <PlacesAutocomplete
                          value={row.current_street}
                          onChange={(value) => updateRow(row.id, 'current_street', value)}
                          onPlaceSelect={(place) => handlePlaceSelect(row.id, place)}
                          disabled={row.isGeocodingCoordinates}
                          isAutoFilled={row.addressAutoFilled}
                          isLoading={row.isGeocodingCoordinates}
                          error={!!row.error}
                          placeholder="123 Main Street"
                        /> */}
                        {/* NEW: HERE Maps Autocomplete */}
                        <HerePlacesAutocomplete
                          value={row.current_street}
                          onChange={(value) => updateRow(row.id, 'current_street', value)}
                          onPlaceSelect={(place) => handlePlaceSelect(row.id, place)}
                          disabled={row.isGeocodingCoordinates}
                          isAutoFilled={row.addressAutoFilled}
                          isLoading={row.isGeocodingCoordinates}
                          error={!!row.error}
                          placeholder="123 Main Street"
                        />
                      </div>

                      {/* City and ZIP */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            City *
                          </label>
                          <input
                          type="text"
                          value={row.city}
                          onChange={(e) => updateRow(row.id, 'city', e.target.value)}
                          disabled={row.isGeocodingCoordinates}
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors',
                            getFieldStyle(row.cityAutoFilled, row.isGeocodingCoordinates),
                            row.error && 'border-red-300'
                          )}
                          placeholder="Portland"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            ZIP *
                          </label>
                          <input
                          type="text"
                          value={row.zip}
                          onChange={(e) => updateRow(row.id, 'zip', e.target.value)}
                          disabled={row.isGeocodingCoordinates}
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors',
                            getFieldStyle(row.zipAutoFilled, row.isGeocodingCoordinates),
                            row.error && 'border-red-300'
                          )}
                          placeholder="97201"
                        />
                        </div>
                      </div>

                      {/* Latitude and Longitude */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Latitude *
                          </label>
                          <input
                          type="text"
                          value={row.latitude}
                          onChange={(e) => handleCoordinateChange(row.id, 'latitude', e.target.value)}
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors',
                            getFieldStyle(row.coordinatesAutoFilled, row.isGeocodingCoordinates),
                            row.error && 'border-red-300'
                          )}
                          placeholder="45.5234"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Longitude *
                          </label>
                          <input
                          type="text"
                          value={row.longitude}
                          onChange={(e) => handleCoordinateChange(row.id, 'longitude', e.target.value)}
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors',
                            getFieldStyle(row.coordinatesAutoFilled, row.isGeocodingCoordinates),
                            row.error && 'border-red-300'
                          )}
                          placeholder="-122.6762"
                        />
                        </div>
                      </div>

                      {/* Error Message */}
                      {row.error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs text-red-700 font-medium">{row.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add Row Button */}
              <button
                type="button"
                onClick={addRow}
                className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Another Bin
              </button>

              {/* Global Error */}
              {globalError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{globalError}</p>
                </div>
              )}
                </div>
              </div>

              {/* Footer - Inside Left Panel - Hidden on mobile when map is shown */}
              <div className={`p-4 md:p-6 border-t border-gray-200 bg-gray-50 ${viewMode === 'map' ? 'hidden md:block' : 'block'}`}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                  <div className="text-xs text-gray-600 text-center sm:text-left order-2 sm:order-1">
                    {validRowCount > 0 && (
                      <span className="font-semibold text-gray-900">
                        {validRowCount} bin{validRowCount !== 1 ? 's' : ''} ready
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 order-1 sm:order-2">
                    <Button type="button" onClick={handleClose} variant="outline" size="sm" className="flex-1 sm:flex-none">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                      disabled={isSubmitting || validRowCount === 0}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5 mr-1.5" />
                          Create {validRowCount || ''} Bin{validRowCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Large Map - Shows on mobile when viewMode is 'map', always visible on desktop */}
            <div className={`flex-1 bg-gray-50 flex-col ${viewMode === 'form' ? 'hidden md:flex' : 'flex'}`}>
              <div className="flex-1 relative" style={{ pointerEvents: 'auto' }}>
                  <GoogleMap
                    defaultCenter={mapCenter}
                    defaultZoom={mapZoom}
                    mapTypeId="hybrid"
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    zoomControl={true}
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                    clickableIcons={true}
                    mapId="bin-creation-map"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {rows.some(r => r.latitude && r.longitude) && (
                      <MapContent
                        rows={rows}
                        currentRowIndex={currentRowIndex}
                        onMarkerDrag={handleMarkerDrag}
                        onMarkerClick={setCurrentRowIndex}
                        locateTriggerId={locateTriggerId}
                        mapCenter={mapCenter}
                        mapZoom={mapZoom}
                      />
                    )}
                  </GoogleMap>
                </div>
              </div>
          </form>
        </Card>
      </div>
    </>
  );
}
