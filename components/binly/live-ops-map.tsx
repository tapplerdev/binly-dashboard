'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { ActiveDriver } from '@/lib/types/active-driver';
import { Loader2, MapPin } from 'lucide-react';

// San Jose warehouse location (default center)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 12;

interface LiveOpsMapProps {
  drivers: ActiveDriver[];
  isLoading: boolean;
  selectedDriverId: string | null;
  onDriverClick: (driverId: string) => void;
}

// Map controller for programmatic zoom/pan
function MapController({
  selectedDriver,
  onComplete,
}: {
  selectedDriver: ActiveDriver | null;
  onComplete: () => void;
}) {
  const map = useMap();
  const lastDriverIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !selectedDriver || !selectedDriver.currentLocation) return;

    // Only pan/zoom when a NEW driver is selected, not on location updates
    if (lastDriverIdRef.current === selectedDriver.driverId) {
      return; // Same driver, just a location update - don't re-zoom
    }

    lastDriverIdRef.current = selectedDriver.driverId;

    const { latitude, longitude } = selectedDriver.currentLocation;
    map.panTo({ lat: latitude, lng: longitude });
    map.setZoom(15);

    const timeout = setTimeout(() => {
      onComplete();
    }, 500);

    return () => clearTimeout(timeout);
  }, [map, selectedDriver, onComplete]);

  return null;
}

// Driver status color mapping
function getDriverStatusColor(status: ActiveDriver['status']) {
  switch (status) {
    case 'active':
      return '#10B981'; // Green
    case 'paused':
      return '#F59E0B'; // Yellow/Orange
    case 'inactive':
    case 'ended':
      return '#6B7280'; // Gray
    default:
      return '#6B7280';
  }
}

export function LiveOpsMap({
  drivers,
  isLoading,
  selectedDriverId,
  onDriverClick,
}: LiveOpsMapProps) {
  const [targetDriver, setTargetDriver] = useState<ActiveDriver | null>(null);

  // When selectedDriverId changes, find the driver and set as target
  useEffect(() => {
    if (selectedDriverId) {
      const driver = drivers.find(d => d.driverId === selectedDriverId);
      if (driver && driver.currentLocation) {
        setTargetDriver(driver);
      }
    }
  }, [selectedDriverId, drivers]);

  // Filter drivers with valid locations
  const driversWithLocations = drivers.filter(d => {
    const hasLocation = d.currentLocation !== null &&
                       d.currentLocation !== undefined &&
                       d.currentLocation.latitude !== undefined &&
                       d.currentLocation.longitude !== undefined;
    console.log('Driver location check:', {
      driverId: d.driverId,
      hasLocation,
      currentLocation: d.currentLocation
    });
    return hasLocation;
  });

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-gray-600">Loading drivers...</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <Map
        mapId="binly-live-ops-map"
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        minZoom={3}
        maxZoom={20}
        gestureHandling="greedy"
        disableDefaultUI={true}
        zoomControl={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Map controller for selected driver navigation */}
        <MapController
          selectedDriver={targetDriver}
          onComplete={() => setTargetDriver(null)}
        />

        {/* Render driver markers */}
        {driversWithLocations.map((driver) => {
          const location = driver.currentLocation!;
          const isSelected = driver.driverId === selectedDriverId;
          const statusColor = getDriverStatusColor(driver.status);

          return (
            <AdvancedMarker
              key={driver.driverId}
              position={{ lat: location.latitude, lng: location.longitude }}
              zIndex={isSelected ? 100 : 10}
              onClick={() => onDriverClick(driver.driverId)}
            >
              <div className="relative">
                {/* Driver avatar - simple circle with initials */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer transition-all duration-300 ${
                    isSelected ? 'scale-125 shadow-2xl' : 'shadow-lg hover:scale-110'
                  } ${driver.status === 'active' ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: statusColor,
                  }}
                >
                  {driver.driverName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>

                {/* Heading indicator (optional - only if heading is available) */}
                {location.heading !== undefined && driver.status === 'active' && (
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2"
                    style={{
                      transform: `translateX(-50%) rotate(${location.heading}deg)`,
                    }}
                  >
                    <div
                      className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-transparent"
                      style={{ borderBottomColor: statusColor }}
                    />
                  </div>
                )}
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Empty state when no drivers have locations */}
        {driversWithLocations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">No Active Drivers</p>
              <p className="text-sm text-gray-600 mt-2">
                Drivers will appear on the map once they start their shifts
              </p>
            </div>
          </div>
        )}
      </Map>
    </APIProvider>
  );
}
