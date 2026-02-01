'use client';

import { useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

interface ShiftBin {
  id: number;
  bin_id: string;
  bin_number: string;
  latitude: number | null;
  longitude: number | null;
  sequence_order: number;
  is_completed: number;
}

interface ShiftRouteMapProps {
  bins: ShiftBin[];
  isOptimized: boolean;
}

export function ShiftRouteMap({ bins, isOptimized }: ShiftRouteMapProps) {
  const { data: warehouse } = useWarehouseLocation();
  const WAREHOUSE_LOCATION = { lat: warehouse?.latitude || 0, lng: warehouse?.longitude || 0 };
  // Filter bins with valid coordinates and sort by sequence
  const mappableBins = useMemo(() => {
    return bins
      .filter(bin => bin.latitude !== null && bin.longitude !== null)
      .sort((a, b) => a.sequence_order - b.sequence_order);
  }, [bins]);

  // Calculate map center and bounds
  const mapConfig = useMemo(() => {
    if (mappableBins.length === 0) {
      return {
        center: WAREHOUSE_LOCATION,
        zoom: 12,
      };
    }

    // Calculate bounds including warehouse and all bins
    const lats = [...mappableBins.map(b => b.latitude!), WAREHOUSE_LOCATION.lat];
    const lngs = [...mappableBins.map(b => b.longitude!), WAREHOUSE_LOCATION.lng];

    const center = {
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    };

    // Calculate appropriate zoom level based on bounds
    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...lngs) - Math.min(...lngs);
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 12;
    if (maxDiff < 0.01) zoom = 15;
    else if (maxDiff < 0.05) zoom = 13;
    else if (maxDiff < 0.1) zoom = 12;
    else zoom = 11;

    return { center, zoom };
  }, [mappableBins]);

  if (mappableBins.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
        <p className="text-sm text-gray-500">No bin coordinates available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          mapId="shift-route-map"
          defaultCenter={mapConfig.center}
          defaultZoom={mapConfig.zoom}
          disableDefaultUI={true}
          gestureHandling="none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Warehouse Marker */}
          <AdvancedMarker
            position={WAREHOUSE_LOCATION}
            zIndex={20}
            title="Warehouse"
          >
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
          </AdvancedMarker>

          {/* Bin Markers with Sequence Numbers */}
          {mappableBins.map((bin) => {
            const isCompleted = bin.is_completed === 1;
            const markerColor = isCompleted ? '#10B981' : '#4880FF';

            return (
              <AdvancedMarker
                key={bin.id}
                position={{ lat: bin.latitude!, lng: bin.longitude! }}
                zIndex={10}
                title={`Bin #${bin.bin_number}${isOptimized && bin.sequence_order > 0 ? ` - Stop ${bin.sequence_order}` : ''}`}
              >
                <div className="relative">
                  {/* Sequence Number Badge (if optimized) */}
                  {isOptimized && bin.sequence_order > 0 && (
                    <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md z-10">
                      <span className="text-xs font-bold text-white">{bin.sequence_order}</span>
                    </div>
                  )}

                  {/* Bin Marker */}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                    style={{ backgroundColor: markerColor }}
                  >
                    <span className="text-xs font-bold text-white">{bin.bin_number}</span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
