'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, X, Loader2, Search, Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
import { inputStyles } from '@/lib/utils';
import { useBins } from '@/lib/hooks/use-bins';
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
  const mappableBins = bins.filter(isMappableBin);

  const [loading, setLoading] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
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
      setMarkerPosition(null);
      setSearchQuery('');
      setError('');
      setLocationQueue([]);
      setHasInteractedWithMap(false);
    }
  }, [open]);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setReverseGeocoding(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });

      if (result.results && result.results[0]) {
        const place = result.results[0];
        let street = '';
        let city = '';
        let zip = '';

        place.address_components.forEach((component) => {
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
        });

        setFormData({
          street: street.trim() || place.formatted_address,
          city: city,
          zip: zip,
          latitude: lat.toString(),
          longitude: lng.toString(),
          notes: '',
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
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
  const handlePlaceSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Only pan the map, don't create marker or fill form
      setMapCenter({ lat, lng });
      setSearchQuery('');
    },
    []
  );

  // Forward geocode address from form fields
  const forwardGeocodeAddress = useCallback(async () => {
    if (!formData.street || !formData.city || !formData.zip) return;

    try {
      const geocoder = new google.maps.Geocoder();
      const address = `${formData.street}, ${formData.city}, ${formData.zip}`;

      const result = await geocoder.geocode({ address });

      if (result.results && result.results[0]?.geometry?.location) {
        const location = result.results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();

        setMarkerPosition({ lat, lng });
        setMapCenter({ lat, lng });
        setFormData((prev) => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString(),
        }));
      }
    } catch (error) {
      console.error('Forward geocoding error:', error);
      // Silently fail - user can still click on map
    }
  }, [formData.street, formData.city, formData.zip]);

  // Debounced forward geocoding when address fields change
  useEffect(() => {
    if (!formData.street || !formData.city || !formData.zip) return;

    const timeoutId = setTimeout(() => {
      forwardGeocodeAddress();
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeoutId);
  }, [formData.street, formData.city, formData.zip, forwardGeocodeAddress]);

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

    // Clear form for next location
    setFormData({
      street: '',
      city: '',
      zip: '',
      latitude: '',
      longitude: '',
      notes: '',
    });
    setMarkerPosition(null);
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
        setError('Please add at least one location');
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
                  <input
                    type="text"
                    required
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
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
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Dallas"
                      className={inputStyles()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      ZIP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      placeholder="75201"
                      className={inputStyles()}
                    />
                  </div>
                </div>

                {/* Coordinates (Read-only) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.latitude}
                      placeholder="Auto-filled"
                      className={`${inputStyles()} bg-gray-100`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Longitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.longitude}
                      placeholder="Auto-filled"
                      className={`${inputStyles()} bg-gray-100`}
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

                {/* Render existing bins (gray markers) */}
                {mappableBins.map((bin) => (
                  <AdvancedMarker
                    key={bin.id}
                    position={{ lat: bin.latitude, lng: bin.longitude }}
                    zIndex={1}
                  >
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                      style={{ backgroundColor: getBinMarkerColor(bin.fill_percentage) }}
                      title={`Bin #${bin.bin_number}`}
                    />
                  </AdvancedMarker>
                ))}

                {/* Potential location marker (orange) */}
                {markerPosition && (
                  <AdvancedMarker position={markerPosition} zIndex={10}>
                    <div className="relative animate-bounce">
                      <div className="w-10 h-10 rounded-full bg-orange-500 border-4 border-white shadow-xl" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-orange-500" />
                    </div>
                  </AdvancedMarker>
                )}
              </Map>
            </APIProvider>

            {/* Search Bar Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-10">
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-2">
                <PlacesAutocomplete
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
