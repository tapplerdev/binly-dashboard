'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { useNoGoZones } from '@/lib/hooks/use-zones';
import { NoGoZonePin } from '@/components/ui/no-go-zone-pin';

interface ZoneMarkersLayerProps {
  /** Override zones instead of fetching */
  zones?: any[];
  /** Click handler */
  onZoneClick?: (zone: any) => void;
}

/**
 * Renders no-go zone pin markers — matches live-map-view.tsx pattern.
 * Must be a child of <GoogleMap>.
 */
export function ZoneMarkersLayer({ zones: propZones, onZoneClick }: ZoneMarkersLayerProps) {
  const { data: hookZones } = useNoGoZones('active');
  const zones = propZones || hookZones || [];

  return (
    <>
      {zones.map((zone) => (
        <AdvancedMarker
          key={zone.id}
          position={{
            lat: zone.center_latitude,
            lng: zone.center_longitude,
          }}
          zIndex={1}
          onClick={() => onZoneClick?.(zone)}
        >
          <div
            className="cursor-pointer hover:scale-110 transition-transform"
            title={`${zone.name} · Score: ${zone.conflict_score}`}
          >
            <NoGoZonePin size={36} />
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}
