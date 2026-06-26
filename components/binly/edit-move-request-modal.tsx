'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MoveRequest } from '@/lib/types/bin';
import { updateMoveRequest, checkMoveRequestDependencies, ActiveShiftDependency, assignMoveToUser, clearMoveAssignment } from '@/lib/api/move-requests';
import { getAllUsers, User as UserType } from '@/lib/api/users';
import { getShifts } from '@/lib/api/shifts';
import { Shift } from '@/lib/types/shift';
import { hereReverseGeocode, geocodeAddress } from '@/lib/services/geocoding.service';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails } from '@/lib/services/geocoding.service';
import { X, MapPin, Calendar, Loader2, Building2, FileText, AlertCircle, User, UserPlus, UserMinus, Truck } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ActiveShiftWarningDialog } from './active-shift-warning-dialog';
import { MapMarkerPin } from '@/components/ui/map-marker-pin';
import { useNearbyIncidents } from '@/lib/hooks/use-zones';
import { formatIncidentType } from '@/lib/types/zone';

// ─── Map auto-fit controller ──────────────────────────────────────────────────
function MapBoundsController({
  currentPos,
  destPos,
}: {
  currentPos: { lat: number; lng: number } | null;
  destPos: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const points = [currentPos, destPos].filter(Boolean) as { lat: number; lng: number }[];
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, { top: 80, right: 60, bottom: 80, left: 60 });
  }, [map, currentPos, destPos]);

  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface EditMoveRequestModalProps {
  moveRequest: MoveRequest;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

export function EditMoveRequestModal({ moveRequest, onClose, onSuccess }: EditMoveRequestModalProps) {
  const queryClient = useQueryClient();

  // ── Form state ─────────────────────────────────────────────────────────────
  const scheduledDateStr = moveRequest.scheduled_date
    ? new Date(moveRequest.scheduled_date * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const [dateOption, setDateOption] = useState<'24h' | '3days' | 'week' | 'custom'>('custom');
  const [formData, setFormData] = useState({
    scheduled_date: scheduledDateStr,
    move_type: (moveRequest.move_type as 'store' | 'relocation') || 'store',
    new_street: moveRequest.new_street || '',
    new_city:   moveRequest.new_city   || '',
    new_zip:    moveRequest.new_zip    || '',
    reason: moveRequest.reason || '',
    notes:  moveRequest.notes  || '',
  });

  // ── Map / geocoding state ──────────────────────────────────────────────────
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [destPos, setDestPos] = useState<{ lat: number; lng: number } | null>(
    moveRequest.new_latitude && moveRequest.new_longitude
      ? { lat: moveRequest.new_latitude, lng: moveRequest.new_longitude }
      : null
  );
  const [destLat, setDestLat] = useState<number | null>(moveRequest.new_latitude ?? null);
  const [destLng, setDestLng] = useState<number | null>(moveRequest.new_longitude ?? null);
  const { data: nearbyIncidents = [] } = useNearbyIncidents(destPos?.lat ?? null, destPos?.lng ?? null, 800);
  const [geocodingCurrentAddr, setGeocodingCurrentAddr] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [addressAutoFilled, setAddressAutoFilled] = useState({ street: false, city: false, zip: false });

  // ── Submit state ───────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Active shift warning state ─────────────────────────────────────────────
  const [showActiveShiftWarning, setShowActiveShiftWarning] = useState(false);
  const [activeShiftDependencies, setActiveShiftDependencies] = useState<ActiveShiftDependency[]>([]);
  const [checkingDependencies, setCheckingDependencies] = useState(false);

  // ── Assignment state ──────────────────────────────────────────────────────
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState(false);

  // Fetch drivers for assignment dropdown
  const { data: users } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: getAllUsers,
    enabled: showAssignDropdown,
  });
  const drivers = users?.filter(u => u.role === 'driver') || [];

  // Fetch shifts to check if assigned driver is on an active one
  const { data: allShifts } = useQuery<Shift[]>({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });
  const assignedDriverShift = allShifts?.find(
    s => s.driverId === moveRequest.assigned_user_id && s.status === 'active'
  );

  const handleAssignToUser = async (userId: string, userName: string) => {
    setAssigningTo(userId);
    try {
      await assignMoveToUser({ move_request_id: moveRequest.id, user_id: userId });
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      // Update local moveRequest state
      moveRequest.assigned_user_id = userId;
      moveRequest.assigned_user_name = userName;
      moveRequest.assignment_type = 'manual';
      moveRequest.status = 'assigned';
      setShowAssignDropdown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setAssigningTo(null);
    }
  };

  const handleUnassign = async () => {
    setUnassigning(true);
    try {
      await clearMoveAssignment(moveRequest.id);
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      moveRequest.assigned_user_id = undefined as any;
      moveRequest.assigned_user_name = undefined as any;
      moveRequest.assignment_type = '' as any;
      moveRequest.status = 'pending';
      setShowAssignDropdown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign');
    } finally {
      setUnassigning(false);
    }
  };

  // ── Geocode current bin address on mount ───────────────────────────────────
  useEffect(() => {
    setGeocodingCurrentAddr(true);
    geocodeAddress(moveRequest.current_street, moveRequest.city, moveRequest.zip || '')
      .then(result => {
        if (result) {
          setCurrentPos({ lat: result.latitude, lng: result.longitude });
          // If no destination yet, default destination marker to current location
          if (!destPos) {
            setDestPos({ lat: result.latitude, lng: result.longitude });
            setDestLat(result.latitude);
            setDestLng(result.longitude);
          }
        }
      })
      .catch(() => {/* silently fail, map just won't center */})
      .finally(() => setGeocodingCurrentAddr(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Date quick-select ──────────────────────────────────────────────────────
  const handleDateQuickSelect = (option: '24h' | '3days' | 'week' | 'custom') => {
    setDateOption(option);
    if (option === 'custom') return;
    const now = new Date();
    const offsets: Record<string, number> = { '24h': 1, '3days': 3, 'week': 7 };
    now.setDate(now.getDate() + offsets[option]);
    setFormData(prev => ({ ...prev, scheduled_date: now.toISOString().split('T')[0] }));
  };

  // ── Drag-end handler — reverse geocode new position ───────────────────────
  const handleMarkerDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    const lat = e.latLng?.lat();
    const lng = e.latLng?.lng();
    if (lat == null || lng == null) return;

    setDestPos({ lat, lng });
    setDestLat(lat);
    setDestLng(lng);

    setReverseGeocoding(true);
    try {
      const result = await hereReverseGeocode(lat, lng);
      if (result) {
        setFormData(prev => ({
          ...prev,
          new_street: result.street || prev.new_street,
          new_city:   result.city   || prev.new_city,
          new_zip:    result.zip    || prev.new_zip,
        }));
        setAddressAutoFilled({ street: true, city: true, zip: true });
        setTimeout(() => setAddressAutoFilled({ street: false, city: false, zip: false }), 2000);
      }
    } catch {
      /* ignore */
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  const isRelocation = formData.move_type === 'relocation';

  // ── Click anywhere on map to place destination ────────────────────────────
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!isRelocation) return;
    const lat = e.latLng?.lat();
    const lng = e.latLng?.lng();
    if (lat == null || lng == null) return;

    setDestPos({ lat, lng });
    setDestLat(lat);
    setDestLng(lng);

    setReverseGeocoding(true);
    try {
      const result = await hereReverseGeocode(lat, lng);
      if (result) {
        setFormData(prev => ({
          ...prev,
          new_street: result.street || prev.new_street,
          new_city:   result.city   || prev.new_city,
          new_zip:    result.zip    || prev.new_zip,
        }));
        setAddressAutoFilled({ street: true, city: true, zip: true });
        setTimeout(() => setAddressAutoFilled({ street: false, city: false, zip: false }), 2000);
      }
    } catch { /* ignore */ }
    finally { setReverseGeocoding(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRelocation]);

  // ── Autocomplete place select — also updates map marker ───────────────────
  const handlePlaceSelect = (place: HerePlaceDetails) => {
    setFormData(prev => ({
      ...prev,
      new_street: place.street || prev.new_street,
      new_city:   place.city   || prev.new_city,
      new_zip:    place.zip    || prev.new_zip,
    }));
    if (place.latitude && place.longitude) {
      setDestPos({ lat: place.latitude, lng: place.longitude });
      setDestLat(place.latitude);
      setDestLng(place.longitude);
    }
    setAddressAutoFilled({ street: true, city: true, zip: true });
    setTimeout(() => setAddressAutoFilled({ street: false, city: false, zip: false }), 2000);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    // Check if address changed or move_type changed
    const addressChanged =
      formData.new_street !== (moveRequest.new_street || '') ||
      formData.new_city !== (moveRequest.new_city || '') ||
      formData.new_zip !== (moveRequest.new_zip || '') ||
      (destLat !== null && destLat !== moveRequest.new_latitude) ||
      (destLng !== null && destLng !== moveRequest.new_longitude);

    const moveTypeChanged = formData.move_type !== moveRequest.move_type;

    // If address or move_type changed, check for active shift dependencies
    if (addressChanged || moveTypeChanged) {
      setCheckingDependencies(true);
      try {
        const dependencies = await checkMoveRequestDependencies(moveRequest.id);

        if (dependencies.length > 0) {
          // Store dependencies and show warning dialog
          setActiveShiftDependencies(dependencies);
          setShowActiveShiftWarning(true);
          setCheckingDependencies(false);
          return; // Wait for user confirmation
        }
      } catch (error) {
        console.error('Failed to check move request dependencies:', error);
        // Continue anyway if dependency check fails
      }
      setCheckingDependencies(false);
    }

    // Proceed with update
    await performUpdate();
  };

  // Helper to perform the actual update (called after confirmation or if no dependencies)
  const performUpdate = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const scheduledTs = Math.floor(new Date(formData.scheduled_date + 'T12:00:00').getTime() / 1000);
      await updateMoveRequest(moveRequest.id, {
        scheduled_date: scheduledTs,
        move_type: formData.move_type, // ← ADDED: Send move type to backend
        reason: formData.reason || undefined,
        notes:  formData.notes  || undefined,
        ...(formData.move_type === 'relocation' && {
          new_street: formData.new_street || undefined,
          new_city:   formData.new_city   || undefined,
          new_zip:    formData.new_zip    || undefined,
          new_latitude:  destLat ?? undefined,
          new_longitude: destLng ?? undefined,
        }),
        ...(formData.move_type === 'store' && {
          new_street:    undefined,
          new_city:      undefined,
          new_zip:       undefined,
          new_latitude:  undefined,
          new_longitude: undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update move request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle active shift warning confirmation
  const handleActiveShiftWarningConfirm = async () => {
    setShowActiveShiftWarning(false);
    await performUpdate();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-stretch pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden pointer-events-auto">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 shrink-0 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Move Request</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Bin #{moveRequest.bin_number} · {moveRequest.current_street}, {moveRequest.city}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Assignment Section */}
          {moveRequest.status !== 'completed' && moveRequest.status !== 'cancelled' && (
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    moveRequest.assigned_user_name ? 'bg-blue-100' : 'bg-gray-200'
                  }`}>
                    <User className={`w-4 h-4 ${moveRequest.assigned_user_name ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {moveRequest.assigned_user_name
                        ? `Assigned to ${moveRequest.assigned_user_name}`
                        : 'Unassigned'}
                    </p>
                    {moveRequest.assigned_user_name && moveRequest.assignment_type === 'shift' && (
                      <p className="text-xs text-blue-600">In active shift</p>
                    )}
                    {moveRequest.assigned_user_name && moveRequest.assignment_type === 'manual' && (
                      <p className="text-xs text-gray-500">Manual assignment</p>
                    )}
                    {!moveRequest.assigned_user_name && (
                      <p className="text-xs text-gray-400">No one is handling this move yet</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Assign / Reassign button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {moveRequest.assigned_user_name ? 'Reassign' : 'Assign Driver'}
                    </button>

                    {/* Driver dropdown */}
                    {showAssignDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-20 py-1 max-h-48 overflow-y-auto">
                        {drivers.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-400">Loading drivers...</p>
                        )}
                        {drivers.map(driver => (
                          <button
                            key={driver.id}
                            onClick={() => handleAssignToUser(driver.id, driver.name)}
                            disabled={assigningTo === driver.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between transition-colors ${
                              moveRequest.assigned_user_id === driver.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            <span>{driver.name}</span>
                            {assigningTo === driver.id && <Loader2 className="w-3 h-3 animate-spin" />}
                            {moveRequest.assigned_user_id === driver.id && (
                              <span className="text-[10px] text-blue-500">current</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unassign button */}
                  {moveRequest.assigned_user_name && moveRequest.assignment_type !== 'shift' && (
                    <button
                      onClick={handleUnassign}
                      disabled={unassigning}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                    >
                      {unassigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                      Unassign
                    </button>
                  )}

                  {/* Active shift indicator */}
                  {assignedDriverShift && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200">
                      <Truck className="w-3.5 h-3.5" />
                      On active shift
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Body — map left, form right */}
          <div className="flex-1 flex overflow-hidden">

            {/* ── LEFT: Map ── */}
            <div className="flex-1 relative bg-gray-100">
              {geocodingCurrentAddr && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-100/70">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}

              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                <GoogleMap
                  defaultCenter={currentPos ?? DEFAULT_CENTER}
                  defaultZoom={14}
                  mapId="edit-move-request-map"
                  mapTypeId="hybrid"
                  gestureHandling="greedy"
                  streetViewControl={false}
                  mapTypeControl={false}
                  disableDefaultUI={false}
                  onClick={handleMapClick}
                  className="w-full h-full"
                >
                  <MapBoundsController currentPos={currentPos} destPos={isRelocation ? destPos : null} />

                  {/* Current location — amber fixed pin */}
                  {currentPos && (
                    <AdvancedMarker position={currentPos} zIndex={5}>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg ring-2 ring-white">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded shadow">
                          Bin #{moveRequest.bin_number}
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Destination — blue pin, draggable (relocation only) */}
                  {isRelocation && destPos && (
                    <AdvancedMarker
                      position={destPos}
                      draggable={true}
                      onDragEnd={handleMarkerDragEnd}
                      zIndex={10}
                    >
                      <div className="cursor-grab active:cursor-grabbing">
                        <MapMarkerPin size={44} color="blue" icon="dot" />
                      </div>
                    </AdvancedMarker>
                  )}
                </GoogleMap>
              </APIProvider>

              {/* Drag hint — relocation only */}
              {isRelocation && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow text-xs text-gray-600 text-center pointer-events-none">
                  {reverseGeocoding
                    ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up address...</span>
                    : 'Click anywhere on the map to place destination · or drag the pin · or type an address'}
                </div>
              )}

              {/* Nearby incidents warning */}
              {nearbyIncidents.length > 0 && destPos && isRelocation && (
                <div className="absolute top-4 right-4 z-20 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-lg max-w-[250px] animate-slide-in-down">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">
                    {nearbyIncidents.length} incident{nearbyIncidents.length > 1 ? 's' : ''} nearby
                  </p>
                  <div className="space-y-1">
                    {nearbyIncidents.slice(0, 3).map((inc) => (
                      <a
                        key={inc.id}
                        href={`/operations/no-go-zones?zone=${inc.zone_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                      >
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-medium">{formatIncidentType(inc.incident_type)}</span>
                        <span className="text-amber-500">— {Math.round(inc.distance_meters)}m</span>
                        <span className="text-amber-400 ml-auto">View →</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-relocation info overlay */}
              {!isRelocation && currentPos && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow text-xs text-gray-600 pointer-events-none">
                  Store move — bin will be picked up and held at warehouse
                </div>
              )}
            </div>

            {/* ── RIGHT: Form ── */}
            <div className="w-[400px] shrink-0 border-l border-gray-200 flex flex-col bg-gray-50 overflow-y-auto">
              <div className="p-6 space-y-6">

                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* ── Scheduled Date ── */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Scheduled Date
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {(['24h', '3days', 'week', 'custom'] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleDateQuickSelect(opt)}
                        className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          dateOption === opt
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt === '24h' ? '24 hrs' : opt === '3days' ? '3 days' : opt === 'week' ? '1 week' : 'Custom'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, scheduled_date: e.target.value }));
                      setDateOption('custom');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* ── Move Type ── */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    Move Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, move_type: 'store' }))}
                      className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${
                        formData.move_type === 'store'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm text-gray-900">Store in Warehouse</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pick up & hold for future use</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, move_type: 'relocation' }))}
                      className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${
                        formData.move_type === 'relocation'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm text-gray-900">Relocation</p>
                      <p className="text-xs text-gray-500 mt-0.5">Move to a new address</p>
                    </button>
                  </div>
                </div>

                {/* ── New Location (relocation only) ── */}
                {isRelocation && (
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      New Location
                      <span className="text-xs font-normal text-gray-400 ml-1">— or drag the pin on the map</span>
                    </label>
                    <div className="space-y-2">
                      <HerePlacesAutocomplete
                        value={formData.new_street}
                        onChange={val => {
                          setFormData(prev => ({ ...prev, new_street: val }));
                          setAddressAutoFilled(prev => ({ ...prev, street: false }));
                        }}
                        onPlaceSelect={handlePlaceSelect}
                        placeholder="Street address"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                          addressAutoFilled.street ? 'border-green-400 bg-green-50' : 'border-gray-300'
                        }`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={formData.new_city}
                          onChange={e => setFormData(prev => ({ ...prev, new_city: e.target.value }))}
                          placeholder="City"
                          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                            addressAutoFilled.city ? 'border-green-400 bg-green-50' : 'border-gray-300'
                          }`}
                        />
                        <input
                          type="text"
                          value={formData.new_zip}
                          onChange={e => setFormData(prev => ({ ...prev, new_zip: e.target.value }))}
                          placeholder="ZIP"
                          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                            addressAutoFilled.zip ? 'border-green-400 bg-green-50' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {reverseGeocoding && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Getting address from map pin...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Reason ── */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Reason <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g. Client requested earlier pickup"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* ── Notes ── */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Notes <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional details for the driver..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              {isRelocation
                ? 'Click the map to place destination, drag the pin to adjust, or type an address'
                : 'Bin will be stored at the warehouse after pickup'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || checkingDependencies}
                className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {(isSubmitting || checkingDependencies) && <Loader2 className="w-4 h-4 animate-spin" />}
                {checkingDependencies ? 'Checking...' : isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Active Shift Warning Dialog */}
      <ActiveShiftWarningDialog
        open={showActiveShiftWarning}
        onOpenChange={setShowActiveShiftWarning}
        onConfirm={handleActiveShiftWarningConfirm}
        dependencies={activeShiftDependencies}
        resourceType="move request"
        resourceName={`Bin #${moveRequest.bin_number} Move Request`}
        changeAction={
          formData.move_type !== moveRequest.move_type
            ? 'move_type_change'
            : 'address_change'
        }
        changeDetails={
          formData.move_type !== moveRequest.move_type
            ? `${moveRequest.move_type} → ${formData.move_type}`
            : `${moveRequest.new_street || '(none)'} → ${formData.new_street}`
        }
        loading={isSubmitting}
      />
    </>
  );
}
