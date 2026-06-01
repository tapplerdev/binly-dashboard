/**
 * Red Pin for No-Go Zones
 * Wraps MapMarkerPin with red + X defaults.
 */
import { MapMarkerPin } from './map-marker-pin';

interface NoGoZonePinProps {
  size?: number;
  className?: string;
}

export function NoGoZonePin({ size = 40, className }: NoGoZonePinProps) {
  return <MapMarkerPin size={size} color="red" icon="x" className={className} />;
}
