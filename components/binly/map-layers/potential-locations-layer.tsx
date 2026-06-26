'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { usePotentialLocations } from '@/lib/hooks/use-potential-locations';
import { PotentialLocationPin } from '@/components/ui/potential-location-pin';

interface PotentialLocationsLayerProps {
  /** Override locations instead of fetching */
  locations?: any[];
  /** Click handler */
  onLocationClick?: (location: any) => void;
}

/**
 * Renders potential location markers — orange pins matching live-map-view.tsx.
 * Must be a child of <GoogleMap>.
 */
export function PotentialLocationsLayer({ locations: propLocations, onLocationClick }: PotentialLocationsLayerProps) {
  const { data: hookLocations } = usePotentialLocations('active');
  const locations = propLocations || hookLocations || [];

  const mappable = locations.filter(
    (l: any) => l.latitude != null && l.longitude != null
  );

  return (
    <>
      {mappable.map((location: any) => (
        <AdvancedMarker
          key={location.id}
          position={{ lat: location.latitude, lng: location.longitude }}
          zIndex={9}
          onClick={() => onLocationClick?.(location)}
        >
          <div
            className="cursor-pointer transition-all duration-300 hover:scale-110 animate-scale-in"
            title={`Potential Location: ${location.street || ''}, ${location.city || ''}`}
          >
            <PotentialLocationPin size={40} />
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}
