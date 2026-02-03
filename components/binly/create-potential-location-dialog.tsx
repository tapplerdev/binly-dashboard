'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, X, Loader2, Search, Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
// OLD: Google Places Autocomplete (commented out for rollback)
// import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
// NEW: HERE Maps Autocomplete
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails, hereReverseGeocode } from '@/lib/services/geocoding.service';
import { inputStyles, cn } from '@/lib/utils';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';

interface QueuedLocation {
  street: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

interface CreatePotentialLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

// Map click handler component
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [map, onMapClick]);

  return null;
}

// Map center controller - only pans when center changes
function MapCenterController({
  center,
  onComplete,
}: {
  center: { lat: number; lng: number } | null;
  onComplete: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !center) return;

    // Pan to the new center and zoom in
    map.panTo(center);
    map.setZoom(16);

    // Reset center after animation completes
    const timeout = setTimeout(() => {
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, center, onComplete]);

  return null;
}

export function CreatePotentialLocationDialog({
  open,
  onOpenChange,
}: CreatePotentialLocationDialogProps) {
  const { data: bins = [] } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const mappableBins = bins.filter(isMappableBin);

  const [loading, setLoading] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [isGeocodingCoordinates, setIsGeocodingCoordinates] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationQueue, setLocationQueue] = useState<QueuedLocation[]>([]);
  const [hasInteractedWithMap, setHasInteractedWithMap] = useState(false);
  const [formData, setFormData] = useState({
    street: '',
    city: '',
    zip: '',
    latitude: '',
    longitude: '',
    notes: '',
  });
  const [autoFilled, setAutoFilled] = useState({
    street: false,
    city: false,
    zip: false,
    coordinates: false,
  });

  // Ref for coordinate debounce timer
  const coordinateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        street: '',
        city: '',
        zip: '',
        latitude: '',
        longitude: '',
        notes: '',
      });
      setAutoFilled({
        street: false,
        city: false,
        zip: false,
        coordinates: false,
      });
      setMarkerPosition(null);
      setSearchQuery('');
      setError('');
      setLocationQueue([]);
      setHasInteractedWithMap(false);
      setIsGeocodingCoordinates(false);
      // Clear debounce timer if modal closes
      if (coordinateTimerRef.current) {
        clearTimeout(coordinateTimerRef.current);
        coordinateTimerRef.current = null;
      }
    }
  }, [open]);

  // Reverse geocode coordinates to address (for map clicks) - using HERE Maps
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setReverseGeocoding(true);
    try {
      const result = await hereReverseGeocode(lat, lng);

      if (result) {
        console.log('✅ POTENTIAL LOCATION: Reverse geocoding from map click successful');

        setFormData({
          street: result.street,
          city: result.city,
          zip: result.zip,
          latitude: lat.toString(),
          longitude: lng.toString(),
          notes: '',
        });
        setAutoFilled({
          street: true,
          city: true,
          zip: true,
          coordinates: false, // Coordinates were set from map click, not auto-filled
        });
      } else {
        console.warn('⚠️ POTENTIAL LOCATION: No address found for map click');
        setError('No address found for this location');
      }
    } catch (error) {
      console.error('❌ POTENTIAL LOCATION: Reverse geocoding error:', error);
      setError('Failed to get address from location');
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  // Handle map click
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setMarkerPosition({ lat, lng });
      setMapCenter({ lat, lng });
      setHasInteractedWithMap(true);
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  // Handle place selection from autocomplete - only pan/zoom, no marker
  // OLD: Google Places version (commented out for rollback)
  // const handlePlaceSelect = useCallback(
  //   (place: google.maps.places.PlaceResult) => {
  //     if (!place.geometry?.location) return;
  //
  //     const lat = place.geometry.location.lat();
  //     const lng = place.geometry.location.lng();
  //
  //     // Only pan the map, don't create marker or fill form
  //     setMapCenter({ lat, lng });
  //     setSearchQuery('');
  //   },
  //   []
  // );

  // NEW: HERE Maps version
  const handlePlaceSelect = useCallback(
    (place: HerePlaceDetails) => {
      // Only pan the map, don't create marker or fill form
      setMapCenter({ lat: place.latitude, lng: place.longitude });
      setSearchQuery('');
    },
    []
  );

  // Handle autocomplete selection for street address
  // OLD: Google Places version (commented out for rollback)
  // const handleStreetPlaceSelect = useCallback((place: google.maps.places.PlaceResult) => {
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
  //   if (!lat || !lng) return;
  //
  //   // Update all fields with auto-filled data
  //   setFormData({
  //     ...formData,
  //     street: street.trim(),
  //     city: city.trim(),
  //     zip: zip.trim(),
  //     latitude: lat.toString(),
  //     longitude: lng.toString(),
  //   });
  //
  //   // Mark fields as auto-filled
  //   setAutoFilled({
  //     street: false, // User typed this (from autocomplete)
  //     city: true,
  //     zip: true,
  //     coordinates: true,
  //   });
  //
  //   // Create marker and pan map to location
  //   setMarkerPosition({ lat, lng });
  //   setMapCenter({ lat, lng });
  //   setHasInteractedWithMap(true);
  // }, [formData]);

  // NEW: HERE Maps version
  const handleStreetPlaceSelect = useCallback((place: HerePlaceDetails) => {
    // Update all fields with data from HERE Maps
    setFormData({
      ...formData,
      street: place.street.trim(),
      city: place.city.trim(),
      zip: place.zip.trim(),
      latitude: place.latitude.toString(),
      longitude: place.longitude.toString(),
    });

    // Mark fields as auto-filled
    setAutoFilled({
      street: false, // User typed this (from autocomplete)
      city: true,
      zip: true,
      coordinates: true,
    });

    // Create marker and pan map to location
    setMarkerPosition({ lat: place.latitude, lng: place.longitude });
    setMapCenter({ lat: place.latitude, lng: place.longitude });
    setHasInteractedWithMap(true);
  }, [formData]);

  // Handle coordinate change with debounced reverse geocoding
  const handleCoordinateChange = useCallback((field: 'latitude' | 'longitude', value: string) => {
    // Clear existing timer
    if (coordinateTimerRef.current) {
      clearTimeout(coordinateTimerRef.current);
      coordinateTimerRef.current = null;
    }

    // Update the field immediately
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Mark coordinates as manually changed
    setAutoFilled((prev) => ({
      ...prev,
      coordinates: false,
    }));

    // Get the updated values (consider the change we just made)
    const lat = field === 'latitude' ? value : formData.latitude;
    const lng = field === 'longitude' ? value : formData.longitude;

    // Only proceed if both fields have values
    if (!lat || !lng) {
      return;
    }

    // Validate that both are valid numbers
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return;
    }

    // Additional validation: check reasonable coordinate ranges
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return;
    }

    // Debounce: Wait 1.5 seconds after user stops typing
    coordinateTimerRef.current = setTimeout(async () => {
      setIsGeocodingCoordinates(true);

      try {
        // Use HERE Maps reverse geocoding instead of Google
        const result = await hereReverseGeocode(latNum, lngNum);

        if (result) {
          console.log('✅ POTENTIAL LOCATION: Reverse geocoding from typed coordinates successful');

          setFormData((prev) => ({
            ...prev,
            street: result.street,
            city: result.city,
            zip: result.zip,
          }));

          setAutoFilled({
            street: true,
            city: true,
            zip: true,
            coordinates: false, // Coordinates were manually entered
          });

          // Create marker on map
          setMarkerPosition({ lat: latNum, lng: lngNum });
          setMapCenter({ lat: latNum, lng: lngNum });
          setHasInteractedWithMap(true);
        } else {
          console.warn('⚠️ POTENTIAL LOCATION: No address found for typed coordinates');
        }
      } catch (error) {
        console.error('❌ POTENTIAL LOCATION: Reverse geocoding from coordinates error:', error);
      } finally {
        setIsGeocodingCoordinates(false);
      }

      coordinateTimerRef.current = null;
    }, 1500); // 1.5 second debounce
  }, [formData.latitude, formData.longitude]);

  // Handle marker drag (reverse geocode with HERE Maps)
  const handleMarkerDrag = useCallback(async (lat: number, lng: number) => {
    console.log('🗺️ POTENTIAL LOCATION: Marker dragged to', lat, lng);

    // Update coordinates and marker position immediately
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));

    setMarkerPosition({ lat, lng });

    // Mark coordinates as manually changed (not auto-filled)
    setAutoFilled((prev) => ({
      ...prev,
      coordinates: false,
    }));

    // Start reverse geocoding
    setIsGeocodingCoordinates(true);

    try {
      const result = await hereReverseGeocode(lat, lng);

      if (result) {
        console.log('✅ POTENTIAL LOCATION: Reverse geocoding successful');

        setFormData((prev) => ({
          ...prev,
          street: result.street,
          city: result.city,
          zip: result.zip,
        }));

        setAutoFilled({
          street: true,
          city: true,
          zip: true,
          coordinates: false, // Coordinates were manually dragged
        });
      } else {
        console.warn('⚠️ POTENTIAL LOCATION: No address found for coordinates');
      }
    } catch (error) {
      console.error('❌ POTENTIAL LOCATION: Reverse geocoding error:', error);
    } finally {
      setIsGeocodingCoordinates(false);
    }
  }, []);

  // Forward geocode address from form fields (DISABLED - use autocomplete or map click instead)
  // Users should use HERE Maps autocomplete for address entry
  // If they type manually without autocomplete, they can:
  //   1. Use the autocomplete dropdown
  //   2. Click on the map
  //   3. Manually type coordinates
  // Keeping this code commented for potential future HERE Maps /geocode endpoint integration
  // const forwardGeocodeAddress = useCallback(async () => {
  //   if (!formData.street || !formData.city || !formData.zip) return;
  //   // TODO: Implement HERE Maps forward geocoding if needed
  //   // For now, users must use autocomplete, map click, or manual coordinates
  // }, [formData.street, formData.city, formData.zip]);

  // Debounced forward geocoding when address fields change (DISABLED)
  // useEffect(() => {
  //   if (!formData.street || !formData.city || !formData.zip) return;
  //   const timeoutId = setTimeout(() => {
  //     forwardGeocodeAddress();
  //   }, 1000); // Debounce 1 second
  //   return () => clearTimeout(timeoutId);
  // }, [formData.street, formData.city, formData.zip, forwardGeocodeAddress]);

  // Add current location to queue
  const handleAddToQueue = useCallback(() => {
    // Validate required fields
    if (!formData.street || !formData.city || !formData.zip) {
      setError('Please fill in street, city, and zip code');
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setError('Please select a location on the map');
      return;
    }

    const newLocation: QueuedLocation = {
      street: formData.street,
      city: formData.city,
      zip: formData.zip,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      notes: formData.notes,
    };

    setLocationQueue((prev) => [...prev, newLocation]);

    // Clear form and marker for next location
    setFormData({
      street: '',
      city: '',
      zip: '',
      latitude: '',
      longitude: '',
      notes: '',
    });
    setAutoFilled({
      street: false,
      city: false,
      zip: false,
      coordinates: false,
    });
    setMarkerPosition(null); // Clear orange marker - user must click map again
    setError('');

    console.log('✅ Added location to queue:', newLocation);
  }, [formData]);

  // Get auth token from Zustand persist storage
  const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;

    try {
      const authStorage = localStorage.getItem('binly-auth-storage');
      if (!authStorage) return null;

      const parsed = JSON.parse(authStorage);
      return parsed?.state?.token || null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        setError('You must be logged in to create a potential location');
        setLoading(false);
        return;
      }

      // Debug logging
      console.log('🔍 Creating potential location(s)...');
      console.log('   Token preview:', token.substring(0, 20) + '...');
      console.log('   Token length:', token.length);

      // Decode JWT to inspect claims (without verification)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('   Token payload:', payload);

          // Check expiration
          if (payload.exp) {
            const expirationDate = new Date(payload.exp * 1000);
            const now = new Date();
            console.log('   Token expires:', expirationDate.toISOString());
            console.log('   Current time:', now.toISOString());
            console.log('   Token expired?', now > expirationDate);

            if (now > expirationDate) {
              throw new Error('Token has expired. Please log out and log back in.');
            }
          }
        }
      } catch (decodeError) {
        console.error('   Failed to decode token:', decodeError);
        if (decodeError instanceof Error && decodeError.message.includes('expired')) {
          throw decodeError;
        }
      }

      // Build locations array for batch submission
      const locationsToCreate: any[] = [];

      // Add queued locations
      locationQueue.forEach(loc => {
        locationsToCreate.push({
          street: loc.street,
          city: loc.city,
          zip: loc.zip,
          latitude: loc.latitude,
          longitude: loc.longitude,
          ...(loc.notes && { notes: loc.notes }),
        });
      });

      // Add current form data if it has valid data
      if (formData.street && formData.city && formData.zip && formData.latitude && formData.longitude) {
        locationsToCreate.push({
          street: formData.street,
          city: formData.city,
          zip: formData.zip,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          ...(formData.notes && { notes: formData.notes }),
        });
      }

      // Validate we have at least one location
      if (locationsToCreate.length === 0) {
        // Only show error if they have started filling the form or have queue items
        // (prevents accidental Enter key presses from showing errors)
        const hasStartedForm = formData.street || formData.city || formData.zip || formData.latitude || formData.longitude;
        if (hasStartedForm || locationQueue.length > 0) {
          setError('Please add at least one location to the queue or fill in all required fields');
        }
        setLoading(false);
        return;
      }

      // Send as array if multiple, or single object if just one
      const payload = locationsToCreate.length === 1 ? locationsToCreate[0] : locationsToCreate;

      console.log('   Creating', locationsToCreate.length, 'location(s)');
      console.log('   Payload:', JSON.stringify(payload, null, 2));

      // Use environment variable or default to production
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ropacal-backend-production.up.railway.app';

      const response = await fetch(
        `${apiUrl}/api/potential-locations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      console.log('   Response status:', response.status);
      console.log('   Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.text();
        console.log('   Error response:', errorData);
        throw new Error(errorData || 'Failed to create potential location');
      }

      // Backend now returns an array (batch endpoint)
      const successData = await response.json();
      console.log('✅ Success: Created', Array.isArray(successData) ? successData.length : 1, 'location(s)');
      console.log('   Response:', successData);

      // Extract the created location (first item in array)
      const createdLocation = Array.isArray(successData) ? successData[0] : successData;
      console.log('   Created location:', createdLocation);

      // Success
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent('potential-location-created'));
    } catch (err) {
      console.error('❌ Create potential location error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in flex items-center justify-center"
        onClick={() => onOpenChange(false)}
      >
        {/* Modal - Larger for map view */}
        <div
          className="w-[90vw] max-w-6xl h-[85vh] bg-white rounded-2xl shadow-2xl z-50 animate-scale-in overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Potential Location</h2>
                <p className="text-sm text-gray-600">
                  {markerPosition
                    ? 'Fine-tune the location or add notes'
                    : 'Search for an address or click on the map'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Split View Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Form */}
          <div className="w-[35%] p-6 overflow-y-auto border-r border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Reverse Geocoding Indicator */}
              {reverseGeocoding && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-600">Finding address...</p>
                </div>
              )}

              {/* Location Card */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Location Details</h3>

                {/* Street */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  {/* OLD: Google Places Autocomplete (commented for rollback) */}
                  {/* <PlacesAutocomplete
                    value={formData.street}
                    onChange={(value) => {
                      setFormData({ ...formData, street: value });
                      setAutoFilled((prev) => ({ ...prev, street: false }));
                    }}
                    onPlaceSelect={handleStreetPlaceSelect}
                    disabled={isGeocodingCoordinates}
                    isAutoFilled={autoFilled.street}
                    isLoading={isGeocodingCoordinates}
                    placeholder="123 Main St"
                    className={inputStyles()}
                  /> */}
                  {/* NEW: HERE Maps Autocomplete */}
                  <HerePlacesAutocomplete
                    value={formData.street}
                    onChange={(value) => {
                      setFormData({ ...formData, street: value });
                      setAutoFilled((prev) => ({ ...prev, street: false }));
                    }}
                    onPlaceSelect={handleStreetPlaceSelect}
                    disabled={isGeocodingCoordinates}
                    isAutoFilled={autoFilled.street}
                    isLoading={isGeocodingCoordinates}
                    placeholder="123 Main St"
                    className={inputStyles()}
                  />
                </div>

                {/* City and Zip */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => {
                        setFormData({ ...formData, city: e.target.value });
                        setAutoFilled((prev) => ({ ...prev, city: false }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      disabled={isGeocodingCoordinates}
                      placeholder="Dallas"
                      className={cn(
                        inputStyles(),
                        isGeocodingCoordinates && 'bg-gray-200 animate-pulse',
                        autoFilled.city && !isGeocodingCoordinates && 'bg-blue-50 border-blue-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      ZIP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => {
                        setFormData({ ...formData, zip: e.target.value });
                        setAutoFilled((prev) => ({ ...prev, zip: false }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      disabled={isGeocodingCoordinates}
                      placeholder="75201"
                      className={cn(
                        inputStyles(),
                        isGeocodingCoordinates && 'bg-gray-200 animate-pulse',
                        autoFilled.zip && !isGeocodingCoordinates && 'bg-blue-50 border-blue-200'
                      )}
                    />
                  </div>
                </div>

                {/* Coordinates (Editable with debounced reverse geocoding) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => handleCoordinateChange('latitude', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="37.7749"
                      className={cn(
                        inputStyles(),
                        isGeocodingCoordinates && 'bg-gray-200 animate-pulse',
                        autoFilled.coordinates && !isGeocodingCoordinates && 'bg-blue-50 border-blue-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => handleCoordinateChange('longitude', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="-122.4194"
                      className={cn(
                        inputStyles(),
                        isGeocodingCoordinates && 'bg-gray-200 animate-pulse',
                        autoFilled.coordinates && !isGeocodingCoordinates && 'bg-blue-50 border-blue-200'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information about this location..."
                  rows={3}
                  className={inputStyles()}
                />
              </div>

              {/* Queue - Show queued locations as full detail cards */}
              {locationQueue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-semibold text-gray-900">
                        Queued Locations ({locationQueue.length})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocationQueue([])}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Scrollable queue container */}
                  <div className="max-h-[300px] overflow-y-auto space-y-3">
                    {locationQueue.map((loc, index) => (
                      <div
                        key={index}
                        className="bg-green-50 border-2 border-green-200 rounded-xl p-4 space-y-3"
                      >
                        {/* Header with remove button */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-green-600 text-white flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">
                              Location {index + 1}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLocationQueue((prev) => prev.filter((_, i) => i !== index));
                            }}
                            className="w-6 h-6 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors"
                            title="Remove from queue"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>

                        {/* Address details */}
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Street Address</p>
                            <p className="text-sm text-gray-900">{loc.street}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">City</p>
                              <p className="text-sm text-gray-900">{loc.city}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">ZIP</p>
                              <p className="text-sm text-gray-900">{loc.zip}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Latitude</p>
                              <p className="text-xs text-gray-700 font-mono">{loc.latitude.toFixed(6)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Longitude</p>
                              <p className="text-xs text-gray-700 font-mono">{loc.longitude.toFixed(6)}</p>
                            </div>
                          </div>

                          {loc.notes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Notes</p>
                              <p className="text-xs text-gray-700">{loc.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4">
                {/* Add to Queue Button - only show if form has data */}
                {formData.street && formData.city && formData.zip && markerPosition && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddToQueue}
                    className="w-full gap-2"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4" />
                    Add to Queue
                  </Button>
                )}

                {/* Cancel and Submit Row */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={loading || (locationQueue.length === 0 && !markerPosition)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        {locationQueue.length > 0 ? (
                          <>
                            <Layers className="w-4 h-4" />
                            Create All ({locationQueue.length + (formData.street && formData.city && formData.zip && markerPosition ? 1 : 0)})
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            Create Location
                          </>
                        )}
                      </>
                    )}
                </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Side - Map */}
          <div className="w-[65%] relative">
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
              <Map
                mapId="potential-location-map"
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={11}
                minZoom={3}
                maxZoom={20}
                gestureHandling="greedy"
                disableDefaultUI={false}
                zoomControl={true}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                style={{ width: '100%', height: '100%' }}
              >
                <MapClickHandler onMapClick={handleMapClick} />
                <MapCenterController center={mapCenter} onComplete={() => setMapCenter(null)} />

                {/* Render existing bins */}
                {mappableBins.map((bin) => (
                  <AdvancedMarker
                    key={bin.id}
                    position={{ lat: bin.latitude, lng: bin.longitude }}
                    zIndex={1}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-300 animate-scale-in"
                      style={{
                        backgroundColor: getBinMarkerColor(bin.fill_percentage),
                      }}
                      title={`Bin #${bin.bin_number} - ${bin.fill_percentage ?? 0}%`}
                    >
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                        {bin.bin_number}
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}

                {/* Warehouse marker - Home icon */}
                {warehouse && (
                  <AdvancedMarker
                    position={{ lat: warehouse.latitude, lng: warehouse.longitude }}
                    zIndex={2}
                    title={warehouse.address || "Warehouse - Base of Operations"}
                  >
                    <div className="relative">
                      {/* Home icon container */}
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl border-4 border-white cursor-pointer transition-all duration-300 hover:scale-110">
                        <svg
                          className="w-7 h-7 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      </div>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Queued location markers (green) */}
                {locationQueue.map((location, index) => (
                  <AdvancedMarker
                    key={`queued-${index}`}
                    position={{ lat: location.latitude, lng: location.longitude }}
                    zIndex={5}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-green-500 border-3 border-white shadow-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{index + 1}</span>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-green-500" />
                    </div>
                  </AdvancedMarker>
                ))}

                {/* Current potential location marker (orange, bouncing, draggable) */}
                {markerPosition && (
                  <AdvancedMarker
                    position={markerPosition}
                    zIndex={10}
                    draggable={true}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        handleMarkerDrag(e.latLng.lat(), e.latLng.lng());
                      }
                    }}
                  >
                    <div className="relative animate-bounce">
                      <div className="w-10 h-10 rounded-full bg-orange-500 border-4 border-white shadow-xl cursor-move" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-orange-500" />
                    </div>
                  </AdvancedMarker>
                )}
              </Map>
            </APIProvider>

            {/* Search Bar Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-10">
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-2">
                {/* OLD: Google Places Autocomplete (commented for rollback) */}
                {/* <PlacesAutocomplete
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Search for an address..."
                  className="border-0 focus:ring-0"
                /> */}
                {/* NEW: HERE Maps Autocomplete */}
                <HerePlacesAutocomplete
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Search for an address..."
                  className="border-0 focus:ring-0"
                />
              </div>
            </div>

            {/* Instructions */}
            {!hasInteractedWithMap && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 px-4 py-2">
                <p className="text-xs text-gray-700 font-medium flex items-center gap-2 whitespace-nowrap">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  Click anywhere on the map to place a location
                </p>
              </div>
            )}

            {/* Queue counter badge - below search bar */}
            <div className={`absolute top-16 right-4 backdrop-blur-sm rounded-full shadow-lg px-4 py-2 transition-colors ${
              locationQueue.length > 0
                ? 'bg-green-50/95 border-2 border-green-200'
                : 'bg-white/95 border border-gray-200'
            }`}>
              <p className="text-xs font-medium flex items-center gap-1.5">
                {locationQueue.length > 0 && <Layers className="w-3.5 h-3.5 text-green-600" />}
                <span className={`font-bold ${locationQueue.length > 0 ? 'text-green-900' : 'text-gray-900'}`}>
                  {locationQueue.length}
                </span>
                <span className={locationQueue.length > 0 ? 'text-green-700' : 'text-gray-600'}>
                  {locationQueue.length === 1 ? 'location' : 'locations'}
                </span>
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
