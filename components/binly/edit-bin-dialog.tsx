'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, X, Loader2, Edit, FileText, Map as MapIcon, AlertTriangle, ChevronLeft, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails, hereReverseGeocode } from '@/lib/services/geocoding.service';
import { inputStyles, cn } from '@/lib/utils';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor, BinStatus } from '@/lib/types/bin';
import { updateBin, BinChangeReasonCategory } from '@/lib/api/bins';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Reason options by context ──────────────────────────────────────────────

// Incident reasons — trigger no-go zone automatically
const INCIDENT_REASONS: { value: BinChangeReasonCategory; label: string; autoZone: boolean }[] = [
  { value: 'missing', label: 'Missing Bin', autoZone: true },
  { value: 'theft', label: 'Theft', autoZone: true },
  { value: 'vandalism', label: 'Vandalism', autoZone: true },
  { value: 'landlord_complaint', label: 'Landlord Complaint', autoZone: true },
];

// All manual-select reason options (excluding pulled_from_service which is auto-applied)
const ALL_REASON_OPTIONS: { value: BinChangeReasonCategory; label: string; autoZone: boolean }[] = [
  ...INCIDENT_REASONS,
  { value: 'relocation_request', label: 'Relocation Request', autoZone: false },
  { value: 'other', label: 'Other', autoZone: false },
];

/**
 * Determine which reason options to show based on what actually changed.
 * Returns null if step 2 should be skipped entirely (trivial changes only).
 */
function getContextualReasons(
  bin: Bin,
  newStatus: BinStatus,
  newStreet: string,
  newCity: string,
  newZip: string,
  newFill: number | null,
  newBinNumber: number,
  newLat: number | null,
  newLng: number | null,
): {
  skipReason: boolean;
  autoReason: BinChangeReasonCategory | null;
  availableReasons: { value: BinChangeReasonCategory; label: string; autoZone: boolean }[];
  defaultReason: BinChangeReasonCategory | null;
} {
  const statusChanged = newStatus !== (bin.status as BinStatus);
  const addressChanged =
    newStreet.trim() !== bin.current_street ||
    newCity.trim() !== bin.city ||
    newZip.trim() !== bin.zip;
  const coordsChanged =
    (newLat !== null && newLat !== bin.latitude) ||
    (newLng !== null && newLng !== bin.longitude);
  const fillChanged = newFill !== (bin.fill_percentage ?? null);
  const binNumberChanged = newBinNumber !== bin.bin_number;

  const meaningfulChange = statusChanged || addressChanged || coordsChanged;

  // Only fill/bin-number changed — skip reason step entirely
  if (!meaningfulChange && (fillChanged || binNumberChanged)) {
    return { skipReason: true, autoReason: null, availableReasons: [], defaultReason: null };
  }

  // Status → in_storage: auto-apply pulled_from_service, no dropdown
  if (statusChanged && newStatus === 'in_storage') {
    return {
      skipReason: false,
      autoReason: 'pulled_from_service',
      availableReasons: [],
      defaultReason: null,
    };
  }

  // Status → missing: show incident reasons, pre-select missing
  if (statusChanged && newStatus === 'missing') {
    return {
      skipReason: false,
      autoReason: null,
      availableReasons: [
        ...INCIDENT_REASONS,
        { value: 'other', label: 'Other', autoZone: false },
      ],
      defaultReason: 'missing',
    };
  }

  // Status → active/retired/needs_check/pending_move (non-incident status change): other only
  if (statusChanged && !addressChanged && !coordsChanged) {
    return {
      skipReason: false,
      autoReason: null,
      availableReasons: [{ value: 'other', label: 'Other', autoZone: false }],
      defaultReason: 'other',
    };
  }

  // Address/coords changed, status stays active (relocation): relocation-relevant reasons
  if ((addressChanged || coordsChanged) && !statusChanged) {
    return {
      skipReason: false,
      autoReason: null,
      availableReasons: [
        { value: 'relocation_request', label: 'Relocation Request', autoZone: false },
        { value: 'landlord_complaint', label: 'Landlord Complaint', autoZone: true },
        { value: 'other', label: 'Other', autoZone: false },
      ],
      defaultReason: 'relocation_request',
    };
  }

  // Mixed: status + address both changed — full options
  return {
    skipReason: false,
    autoReason: null,
    availableReasons: ALL_REASON_OPTIONS,
    defaultReason: null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form');

  // Step state: 'edit' = form, 'reason' = reason step
  const [step, setStep] = useState<'edit' | 'reason'>('edit');

  // Reason step state
  const [reasonCategory, setReasonCategory] = useState<BinChangeReasonCategory | ''>('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [createNoGoZone, setCreateNoGoZone] = useState(false);

  // Context computed during handleNextStep (so it only runs once, not on every render)
  const [reasonContext, setReasonContext] = useState<{
    skipReason: boolean;
    autoReason: BinChangeReasonCategory | null;
    availableReasons: { value: BinChangeReasonCategory; label: string; autoZone: boolean }[];
    defaultReason: BinChangeReasonCategory | null;
  } | null>(null);

  // Form state
  const [binNumber, setBinNumber] = useState<number>(0);
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
      setBinNumber(bin.bin_number);
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
      setViewMode('form');
      setStep('edit');
      setReasonCategory('');
      setReasonNotes('');
      setCreateNoGoZone(false);
      setReasonContext(null);
    }
  }, [open]);

  // When status changes to in_storage, auto-fill warehouse address
  useEffect(() => {
    if (status === 'in_storage' && warehouse) {
      // Parse warehouse address into parts
      // Warehouse address format: "123 Main St, City, CA 94040" or similar
      const addr = warehouse.address;
      // Simple heuristic: everything before first comma is street
      const parts = addr.split(',').map((p: string) => p.trim());
      if (parts.length >= 2) {
        setStreet(parts[0]);
        // Try to extract city and zip from remaining parts
        const rest = parts.slice(1).join(', ');
        // Look for zip pattern
        const zipMatch = rest.match(/\b(\d{5})\b/);
        if (zipMatch) {
          setZip(zipMatch[1]);
          // City is everything up to the zip
          const cityPart = rest.replace(/[\s,]*[A-Z]{2}\s*\d{5}[-\d]*/, '').trim().replace(/,$/, '').trim();
          setCity(cityPart || parts[1]);
        } else {
          setCity(parts[1] || '');
          setZip(parts[2] || '');
        }
      } else {
        setStreet(addr);
      }
      setLatitude(warehouse.latitude);
      setLongitude(warehouse.longitude);
      setMarkerPosition({ lat: warehouse.latitude, lng: warehouse.longitude });
      setMapCenter({ lat: warehouse.latitude, lng: warehouse.longitude });
    }
  }, [status, warehouse]);

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

  const handleStreetPlaceSelect = useCallback((place: HerePlaceDetails) => {
    setStreet(place.street);
    setCity(place.city);
    setZip(place.zip);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setMarkerPosition({ lat: place.latitude, lng: place.longitude });
    setMapCenter({ lat: place.latitude, lng: place.longitude });
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
    mutationFn: async (overrideReason?: BinChangeReasonCategory) => {
      if (!bin) throw new Error('No bin selected');

      const finalReason = overrideReason ?? (reasonCategory || null);

      return updateBin(bin.id, {
        bin_number: binNumber,
        current_street: street.trim(),
        city: city.trim(),
        zip: zip.trim(),
        status,
        checked: bin.checked ?? false,
        fill_percentage: fillPercentage,
        move_requested: bin.move_requested ?? false,
        latitude,
        longitude,
        reason_category: finalReason as BinChangeReasonCategory | null,
        reason_notes: reasonNotes.trim() || null,
        create_no_go_zone: reasonCategory === 'relocation_request' ? createNoGoZone : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['bins-with-priority'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setError(error.message || 'Failed to update bin');
    },
  });

  // Step 1: validate form → determine context → advance or skip to step 2
  const handleNextStep = () => {
    setError('');
    if (!bin) return;

    if (!street.trim() || !city.trim() || !zip.trim()) {
      setError('Please fill in all address fields');
      return;
    }
    if (!latitude || !longitude) {
      setError('Please select a location on the map or search for an address');
      return;
    }

    const ctx = getContextualReasons(
      bin,
      status,
      street,
      city,
      zip,
      fillPercentage,
      binNumber,
      latitude,
      longitude,
    );

    // Trivial change (fill/bin-number only) — submit silently with 'other'
    if (ctx.skipReason) {
      setLoading(true);
      updateBinMutation
        .mutateAsync('other')
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    // Store context, pre-fill default reason if any
    setReasonContext(ctx);
    if (ctx.autoReason) {
      setReasonCategory(ctx.autoReason);
    } else if (ctx.defaultReason) {
      setReasonCategory(ctx.defaultReason);
    } else {
      setReasonCategory('');
    }
    setCreateNoGoZone(false);
    setStep('reason');
  };

  // Step 2: validate reason → submit
  const handleSubmit = async () => {
    setError('');

    const isAuto = reasonContext?.autoReason != null;

    if (!isAuto && !reasonCategory) {
      setError('Please select a reason for this change');
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

  // Auto-creates zone for selected reason (for display)
  const selectedReasonOption = (reasonContext?.availableReasons ?? ALL_REASON_OPTIONS).find(
    (o) => o.value === reasonCategory,
  );

  if (!open || !bin) return null;

  const mapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const isAutoReason = reasonContext?.autoReason != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="relative w-full max-w-[1400px] h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden animate-slide-in-up">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex items-center justify-between mb-3 md:mb-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Edit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                  Edit Bin #{bin.bin_number}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 hidden md:block">
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

          {/* Mobile View Toggle */}
          <div className="flex md:hidden gap-2 mt-2">
            <button
              onClick={() => setViewMode('form')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                viewMode === 'form'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Form</span>
              </div>
            </button>
            <button
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
        </div>

        {/* Content */}
        <div className="h-full pt-[140px] md:pt-[88px] flex">
          {/* Left Panel */}
          <div className={`w-full md:w-[480px] border-r border-gray-200 p-4 md:p-6 overflow-y-auto ${viewMode === 'map' ? 'hidden md:block' : 'block'}`}>

            {step === 'edit' ? (
              <>
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

                {/* in_storage notice */}
                {status === 'in_storage' && warehouse && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                    <Warehouse className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      Address auto-set to warehouse location. The bin will be marked as stored.
                    </p>
                  </div>
                )}

                {/* Location Details */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Location Details</h3>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <HerePlacesAutocomplete
                      value={street}
                      onChange={setStreet}
                      onPlaceSelect={handleStreetPlaceSelect}
                      placeholder="123 Main St"
                      className={inputStyles()}
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
                      Bin Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={binNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setBinNumber(value ? parseInt(value) : 0);
                      }}
                      className={inputStyles()}
                      placeholder="Enter bin number"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <Dropdown
                      label=""
                      value={status}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'missing', label: 'Missing' },
                        { value: 'retired', label: 'Retired' },
                        { value: 'in_storage', label: 'In Storage' },
                      ]}
                      onChange={(value) => setStatus(value as BinStatus)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Fill Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={fillPercentage ?? ''}
                        onChange={(e) => setFillPercentage(e.target.value ? parseInt(e.target.value) : null)}
                        className={cn(inputStyles(), 'pr-10')}
                        placeholder="0"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
                        %
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Step 1 Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => onOpenChange(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    className="flex-1"
                    disabled={reverseGeocoding || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Next: Review'
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2 — Reason */}
                <div className="mb-4 flex items-center gap-2">
                  <button
                    onClick={() => { setStep('edit'); setError(''); }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {isAutoReason ? 'Confirm Change' : 'Reason for Change'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isAutoReason
                        ? 'Review what will happen before saving'
                        : 'Required for all administrative edits'}
                    </p>
                  </div>
                </div>

                {/* Summary of changes */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-blue-800 mb-1">Saving changes to Bin #{bin.bin_number}:</p>
                  <p className="text-xs text-blue-700">{street}, {city} {zip}</p>
                  <p className="text-xs text-blue-700">Status: {status} · Fill: {fillPercentage ?? '—'}%</p>
                </div>

                {/* ── PULLED FROM SERVICE: auto-reason, no dropdown ── */}
                {isAutoReason && reasonContext?.autoReason === 'pulled_from_service' ? (
                  <div className="mb-4 space-y-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex gap-2">
                      <Warehouse className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">Pulled from service</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Bin will be marked as <strong>In Storage</strong> at the warehouse location. No incident zone will be created — this is an operational pull, not an incident.
                        </p>
                      </div>
                    </div>

                    {warehouse && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-medium text-green-800 mb-0.5">Warehouse address</p>
                        <p className="text-xs text-green-700">{warehouse.address}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* ── NORMAL REASON DROPDOWN ── */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Reason Category <span className="text-red-500">*</span>
                      </label>
                      <Dropdown
                        label=""
                        value={reasonCategory}
                        options={(reasonContext?.availableReasons ?? ALL_REASON_OPTIONS).map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        onChange={(value) => {
                          setReasonCategory(value as BinChangeReasonCategory);
                          setCreateNoGoZone(false);
                        }}
                        className="w-full"
                      />
                    </div>

                    {/* Auto no-go zone notice for incident reasons */}
                    {selectedReasonOption?.autoZone && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          A no-go zone will be automatically created at the current bin location to flag this area.
                        </p>
                      </div>
                    )}

                    {/* Optional no-go zone checkbox for relocation_request */}
                    {reasonCategory === 'relocation_request' && (
                      <div className="mb-4 flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <input
                          id="create-no-go-zone"
                          type="checkbox"
                          checked={createNoGoZone}
                          onChange={(e) => setCreateNoGoZone(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="create-no-go-zone" className="text-xs text-gray-700 cursor-pointer">
                          <span className="font-medium">Create no-go zone</span> at current location to avoid re-placing a bin here
                        </label>
                      </div>
                    )}
                  </>
                )}

                {/* Notes — always available */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    rows={3}
                    className={cn(inputStyles(), 'resize-none')}
                    placeholder="Additional context about this change..."
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Step 2 Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => { setStep('edit'); setError(''); }}
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1"
                    disabled={loading || (!isAutoReason && !reasonCategory)}
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
              </>
            )}
          </div>

          {/* Right Panel - Map */}
          <div className={`flex-1 relative ${viewMode === 'form' ? 'hidden md:flex' : 'flex'} flex-col`}>
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
                mapTypeId="hybrid"
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

                {/* Current bin marker (being edited) - draggable standard Google Maps pin */}
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
                  />
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
