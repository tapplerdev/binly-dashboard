'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';

/**
 * Renders warehouse marker — blue house icon matching live-map-view.tsx exactly.
 * Must be a child of <GoogleMap>.
 */
export function WarehouseMarkerLayer() {
  const { data: warehouse } = useWarehouseLocation();

  if (!warehouse?.latitude || !warehouse?.longitude) return null;

  return (
    <AdvancedMarker
      position={{ lat: warehouse.latitude, lng: warehouse.longitude }}
      zIndex={20}
      title={warehouse.address || 'Warehouse - Base of Operations'}
    >
      <div className="relative">
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
  );
}
