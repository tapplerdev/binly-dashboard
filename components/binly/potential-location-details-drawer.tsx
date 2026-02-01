'use client';

import { X, MapPin, User, Calendar, FileText, Check, Trash2, Map, ExternalLink, Truck, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useRouter } from 'next/navigation';

interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  requested_by_user_id: string;
  requested_by_name: string;
  notes?: string;
  created_at_iso: string;
  converted_to_bin_id?: string;
  converted_at_iso?: string;
  converted_by_user_id?: string;
  converted_via_shift_id?: string;
  bin_number?: number;
}

interface PotentialLocationDetailsDrawerProps {
  location: PotentialLocation;
  onClose: () => void;
  onConvert: () => void;
  onDelete: () => void;
}

export function PotentialLocationDetailsDrawer({
  location,
  onClose,
  onConvert,
  onDelete,
}: PotentialLocationDetailsDrawerProps) {
  const router = useRouter();

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewOnMap = () => {
    // Navigate to live map and center on this location
    router.push(`/operations/live-map?lat=${location.latitude}&lng=${location.longitude}&zoom=16`);
  };

  const isConverted = !!location.converted_at_iso;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[500px] lg:w-[600px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-bold text-primary">Potential Location</h2>
                {isConverted && (
                  <>
                    <Badge variant="default" className="gap-1">
                      <Check className="w-3 h-3" />
                      Converted
                    </Badge>
                    {location.converted_via_shift_id ? (
                      <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200">
                        <Truck className="w-3 h-3" />
                        Driver Placement
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200">
                        <UserCog className="w-3 h-3" />
                        Manager Conversion
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">Location ID: {location.id.slice(0, 8)}...</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-9 h-9 md:w-8 md:h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Address Section */}
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Location
                </p>
                <p className="font-semibold text-gray-900 mb-1">{location.street}</p>
                <p className="text-sm text-gray-600">
                  {location.city}, {location.zip}
                </p>
              </div>
            </div>

            {/* Coordinates */}
            {location.latitude && location.longitude && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Map className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Coordinates:</span>
                  <span className="font-mono text-gray-900">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Map Section */}
          {location.latitude && location.longitude && (
            <div className="border-b border-gray-200">
              <div className="relative h-[240px] w-full">
                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                  <GoogleMap
                    defaultCenter={{ lat: location.latitude, lng: location.longitude }}
                    defaultZoom={15}
                    mapId="potential-location-map"
                    disableDefaultUI={true}
                    gestureHandling="greedy"
                    className="w-full h-full"
                  >
                    <AdvancedMarker
                      position={{ lat: location.latitude, lng: location.longitude }}
                    />
                  </GoogleMap>
                </APIProvider>

                {/* View on Live Map Button */}
                <button
                  onClick={handleViewOnMap}
                  className="absolute bottom-4 right-4 bg-white hover:bg-gray-50 px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors border border-gray-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Live Map
                </button>
              </div>
            </div>
          )}

          {/* Requested By Section */}
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Requested By
                </p>
                <p className="font-semibold text-gray-900">{location.requested_by_name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  User ID: {location.requested_by_user_id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          {/* Date Created Section */}
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Date Created
                </p>
                <p className="font-semibold text-gray-900">{formatDate(location.created_at_iso)}</p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {location.notes && (
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-gray-900 leading-relaxed">{location.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Conversion Info (if converted) */}
          {isConverted && (
            <div className="p-4 md:p-6 border-b border-gray-200 bg-green-50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  {location.converted_via_shift_id ? (
                    <Truck className="w-5 h-5 text-green-600" />
                  ) : (
                    <Check className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-1">
                    Conversion Details
                  </p>
                  <p className="text-sm text-green-900 mb-2">
                    Converted to Bin #{location.bin_number}
                  </p>
                  <p className="text-xs text-green-700">
                    {formatDate(location.converted_at_iso!)}
                  </p>

                  {/* Show conversion type with context */}
                  {location.converted_via_shift_id ? (
                    <>
                      <p className="text-xs text-green-700 mt-2">
                        <span className="font-semibold">Placed by driver</span> during active shift
                      </p>
                      <button
                        onClick={() => router.push(`/operations/shifts/${location.converted_via_shift_id}`)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Shift Details
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-green-700 mt-2">
                      <span className="font-semibold">Converted manually</span> by manager
                      {location.converted_by_user_id && (
                        <span className="block mt-1">User ID: {location.converted_by_user_id.slice(0, 8)}...</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isConverted && (
          <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50 shrink-0">
            <div className="flex gap-3">
              <Button
                onClick={onConvert}
                className="flex-1 gap-2 h-11"
              >
                <Check className="w-4 h-4" />
                Convert to Bin
              </Button>
              <Button
                onClick={onDelete}
                variant="destructive"
                className="flex-1 gap-2 h-11"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
