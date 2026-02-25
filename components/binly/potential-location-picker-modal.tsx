'use client';

import React, { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { BinWithPriority, getBinMarkerColor } from '@/lib/types/bin';
import { NearbyPotentialLocation } from '@/lib/api/potential-locations';
import { cn } from '@/lib/utils';

interface PotentialLocationPickerModalProps {
  bin: BinWithPriority;
  potentialLocations: NearbyPotentialLocation[];
  selectedLocationId?: string;
  onSelect: (location: NearbyPotentialLocation) => void;
  onClose: () => void;
}

export function PotentialLocationPickerModal({
  bin,
  potentialLocations,
  selectedLocationId,
  onSelect,
  onClose,
}: PotentialLocationPickerModalProps) {
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  const binLat = bin.current_latitude ?? bin.latitude;
  const binLng = bin.current_longitude ?? bin.longitude;

  if (!binLat || !binLng) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold"
              style={{
                backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
              }}
            >
              {bin.bin_number}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Select Deployment Location for Bin #{bin.bin_number}
              </h2>
              <p className="text-sm text-gray-600">
                Click any orange marker to select a potential location
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              mapId="potential-location-picker-map"
              defaultCenter={{ lat: binLat, lng: binLng }}
              defaultZoom={13}
              minZoom={3}
              maxZoom={20}
              gestureHandling="greedy"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              mapTypeId="hybrid"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Bin Marker */}
              <AdvancedMarker position={{ lat: binLat, lng: binLng }} zIndex={100}>
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full border-3 border-white shadow-xl flex items-center justify-center text-white text-sm font-bold"
                    style={{
                      backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                    }}
                  >
                    {bin.bin_number}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-semibold">
                    Current Location
                  </div>
                </div>
              </AdvancedMarker>

              {/* Potential Location Markers */}
              {potentialLocations.map((location) => {
                if (!location.latitude || !location.longitude) return null;

                const isSelected = selectedLocationId === location.id;
                const isHovered = hoveredLocationId === location.id;

                return (
                  <AdvancedMarker
                    key={location.id}
                    position={{ lat: location.latitude, lng: location.longitude }}
                    zIndex={isSelected ? 90 : isHovered ? 85 : 80}
                    onClick={() => onSelect(location)}
                  >
                    <div
                      className="relative cursor-pointer group"
                      onMouseEnter={() => setHoveredLocationId(location.id)}
                      onMouseLeave={() => setHoveredLocationId(null)}
                    >
                      {/* Marker */}
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full border-3 shadow-xl flex items-center justify-center transition-all',
                          isSelected
                            ? 'bg-green-500 border-white scale-125'
                            : isHovered
                            ? 'bg-orange-500 border-white scale-110'
                            : 'bg-orange-400 border-white'
                        )}
                      >
                        <MapPin className="w-5 h-5 text-white fill-white" />
                      </div>

                      {/* Label */}
                      <div
                        className={cn(
                          'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium shadow-lg transition-all',
                          isSelected
                            ? 'bg-green-600 text-white scale-100 opacity-100'
                            : isHovered
                            ? 'bg-orange-500 text-white scale-100 opacity-100'
                            : 'bg-gray-800 text-white scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                        )}
                      >
                        <div className="font-semibold">{location.street}</div>
                        <div className="text-xs opacity-90">
                          {location.city} • {Math.round(location.distance_meters)}m away
                        </div>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}
            </Map>
          </APIProvider>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-sm">
            <div className="font-semibold text-gray-900 mb-3">Map Legend</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-400 border-2 border-white shadow-md flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-gray-700">Potential locations</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-md flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-gray-700">Selected location</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status) }}
                >
                  {bin.bin_number}
                </div>
                <span className="text-gray-700">Bin #{bin.bin_number}</span>
              </div>
            </div>
          </div>

          {/* Location Count */}
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
            <span className="text-sm font-medium text-gray-700">
              {potentialLocations.length} potential location{potentialLocations.length !== 1 ? 's' : ''} available
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
