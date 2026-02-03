'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, X, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails, hereReverseGeocode } from '@/lib/services/geocoding.service';
import { inputStyles, cn } from '@/lib/utils';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor, BinStatus } from '@/lib/types/bin';
import { updateBin } from '@/lib/api/bins';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface EditBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bin: Bin | null;
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

// Map center controller
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

    map.panTo(center);
    map.setZoom(16);

    const timeout = setTimeout(() => {
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, center, onComplete]);

  return null;
}

export function EditBinDialog({ open, onOpenChange, bin }: EditBinDialogProps) {
  const queryClient = useQueryClient();
  const { data: bins = [] } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const mappableBins = bins.filter(isMappableBin);

  const [loading, setLoading] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Form state
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [status, setStatus] = useState<BinStatus>('active');
  const [fillPercentage, setFillPercentage] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Initialize form with bin data when dialog opens
  useEffect(() => {
    if (open && bin) {
      setStreet(bin.current_street);
      setCity(bin.city);
      setZip(bin.zip);
      setStatus(bin.status as BinStatus);
      setFillPercentage(bin.fill_percentage ?? null);

      if (bin.latitude && bin.longitude) {
        setLatitude(bin.latitude);
        setLongitude(bin.longitude);
        setMarkerPosition({ lat: bin.latitude, lng: bin.longitude });
        setMapCenter({ lat: bin.latitude, lng: bin.longitude });
      }
    }
  }, [open, bin]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStreet('');
      setCity('');
      setZip('');
      setStatus('active');
      setFillPercentage(null);
      setLatitude(null);
      setLongitude(null);
      setMarkerPosition(null);
      setMapCenter(null);
      setSearchQuery('');
      setError('');
    }
  }, [open]);

  const handlePlaceSelect = useCallback((place: HerePlaceDetails) => {
    setStreet(place.street);
    setCity(place.city);
    setZip(place.zip);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setMarkerPosition({ lat: place.latitude, lng: place.longitude });
    setMapCenter({ lat: place.latitude, lng: place.longitude });
    setSearchQuery('');
    setError('');
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setMarkerPosition({ lat, lng });
    setLatitude(lat);
    setLongitude(lng);
    setReverseGeocoding(true);

    try {
      const result = await hereReverseGeocode(lat, lng);

      if (result) {
        setStreet(result.street);
        setCity(result.city);
        setZip(result.zip);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  const handleMarkerDrag = useCallback(async (lat: number, lng: number) => {
    setMarkerPosition({ lat, lng });
    setLatitude(lat);
    setLongitude(lng);
    setReverseGeocoding(true);

    try {
      const result = await hereReverseGeocode(lat, lng);

      if (result) {
        setStreet(result.street);
        setCity(result.city);
        setZip(result.zip);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  const updateBinMutation = useMutation({
    mutationFn: async () => {
      if (!bin) throw new Error('No bin selected');

      return updateBin(bin.id, {
        current_street: street.trim(),
        city: city.trim(),
        zip: zip.trim(),
        status,
        checked: bin.checked ?? false,
        fill_percentage: fillPercentage,
        move_requested: bin.move_requested ?? false,
        latitude,
        longitude,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['bins-with-priority'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update bin');
    },
  });

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!street.trim() || !city.trim() || !zip.trim()) {
      setError('Please fill in all address fields');
      return;
    }

    if (!latitude || !longitude) {
      setError('Please select a location on the map or search for an address');
      return;
    }

    setLoading(true);
    try {
      await updateBinMutation.mutateAsync();
    } catch (err) {
      // Error handled by mutation
    } finally {
      setLoading(false);
    }
  };

  if (!open || !bin) return null;

  const mapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="relative w-full max-w-[1400px] h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden animate-slide-in-up">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Edit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Bin #{bin.bin_number}
                </h2>
                <p className="text-sm text-gray-500">
                  Update bin location and details
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full pt-[88px] flex">
          {/* Left Panel - Form */}
          <div className="w-[400px] border-r border-gray-200 p-6 overflow-y-auto">
            {/* Address Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Address
              </label>
              <HerePlacesAutocomplete
                value={searchQuery}
                onChange={setSearchQuery}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search for a new address..."
              />
            </div>

            {/* Location Details */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Location Details</h3>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={inputStyles()}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputStyles()}
                    placeholder="Mountain View"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    ZIP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className={inputStyles()}
                    placeholder="94040"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={latitude?.toFixed(6) || ''}
                    readOnly
                    className={cn(inputStyles(), 'bg-gray-100 text-gray-600 cursor-not-allowed')}
                    placeholder="37.379010"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={longitude?.toFixed(6) || ''}
                    readOnly
                    className={cn(inputStyles(), 'bg-gray-100 text-gray-600 cursor-not-allowed')}
                    placeholder="-122.071880"
                  />
                </div>
              </div>
            </div>

            {/* Bin Details */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Bin Details</h3>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BinStatus)}
                  className={inputStyles()}
                >
                  <option value="active">Active</option>
                  <option value="missing">Missing</option>
                  <option value="retired">Retired</option>
                  <option value="in_storage">In Storage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Fill Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fillPercentage ?? ''}
                    onChange={(e) => setFillPercentage(e.target.value ? parseInt(e.target.value) : null)}
                    className={inputStyles()}
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={loading || reverseGeocoding}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>

          {/* Right Panel - Map */}
          <div className="flex-1 relative">
            <APIProvider apiKey={mapApiKey}>
              <Map
                mapId="edit-bin-map"
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={12}
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
                <MapCenterController
                  center={mapCenter}
                  onComplete={() => setMapCenter(null)}
                />

                {/* Current bin marker (being edited) - draggable */}
                {markerPosition && bin && (
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
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full border-4 border-white shadow-xl cursor-move transition-all duration-300 hover:scale-110"
                        style={{
                          backgroundColor: getBinMarkerColor(fillPercentage),
                        }}
                        title={`Bin #${bin.bin_number} - ${fillPercentage ?? 0}% (Drag to move)`}
                      >
                        <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                          {bin.bin_number}
                        </div>
                      </div>
                      {/* Subtle pulsing ring to indicate it's the active/editable bin */}
                      <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75" />
                    </div>
                  </AdvancedMarker>
                )}

                {/* Other bins */}
                {mappableBins
                  .filter((b) => b.id !== bin.id)
                  .map((b) => (
                    <AdvancedMarker
                      key={b.id}
                      position={{ lat: b.latitude!, lng: b.longitude! }}
                      zIndex={1}
                    >
                      <div
                        className="w-8 h-8 rounded-full border-2 border-white shadow-lg"
                        style={{
                          backgroundColor: getBinMarkerColor(b.fill_percentage),
                        }}
                        title={`Bin #${b.bin_number} - ${b.fill_percentage ?? 0}%`}
                      >
                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                          {b.bin_number}
                        </div>
                      </div>
                    </AdvancedMarker>
                  ))}

                {/* Warehouse */}
                {warehouse && (
                  <AdvancedMarker
                    position={{ lat: warehouse.latitude, lng: warehouse.longitude }}
                    zIndex={2}
                    title={warehouse.address || "Warehouse"}
                  >
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl border-4 border-white">
                      <svg
                        className="w-7 h-7 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                  </AdvancedMarker>
                )}
              </Map>
            </APIProvider>

            {/* Map Instruction Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-200">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {markerPosition ? 'Drag the marker to adjust location' : 'Click anywhere on the map to set location'}
              </p>
            </div>

            {/* Reverse Geocoding Indicator */}
            {reverseGeocoding && (
              <div className="absolute top-6 right-6 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-gray-600">Finding address...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
