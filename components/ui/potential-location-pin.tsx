/**
 * Orange Pin for Potential Locations
 * Wraps MapMarkerPin with orange + plus defaults.
 */
import { MapMarkerPin } from './map-marker-pin';

interface PotentialLocationPinProps {
  size?: number;
  color?: string;
  className?: string;
}

export function PotentialLocationPin({
  size = 48,
  className,
}: PotentialLocationPinProps) {
  return <MapMarkerPin size={size} color="orange" icon="plus" className={className} />;
}
