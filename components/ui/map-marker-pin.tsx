/**
 * Unified Map Marker Pin Component
 *
 * Standard teardrop pin used across all map-based location pickers.
 * Color and icon change based on context:
 *   - Orange + plus: potential location
 *   - Red + X: no-go zone / incident
 *   - Green + plus: new bin placement
 *   - Blue + dot: move destination
 */

type PinIcon = 'plus' | 'x' | 'dot' | 'pin';

interface MapMarkerPinProps {
  size?: number;
  color?: 'orange' | 'red' | 'green' | 'blue';
  icon?: PinIcon;
  className?: string;
}

const COLORS: Record<string, string> = {
  orange: '#FF9500',
  red: '#DC2626',
  green: '#16A34A',
  blue: '#3B82F6',
};

function renderIcon(icon: PinIcon) {
  switch (icon) {
    case 'plus':
      return (
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="24" y1="13" x2="24" y2="23" />
          <line x1="19" y1="18" x2="29" y2="18" />
        </g>
      );
    case 'x':
      return (
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="19" y1="13" x2="29" y2="23" />
          <line x1="29" y1="13" x2="19" y2="23" />
        </g>
      );
    case 'dot':
      return <circle cx="24" cy="18" r="4" fill="white" />;
    case 'pin':
      return (
        <g stroke="white" strokeWidth="2" strokeLinecap="round" fill="none">
          <circle cx="24" cy="16" r="4" />
          <line x1="24" y1="20" x2="24" y2="24" />
        </g>
      );
  }
}

export function MapMarkerPin({
  size = 44,
  color = 'orange',
  icon = 'plus',
  className,
}: MapMarkerPinProps) {
  const fill = COLORS[color];

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        <circle cx="24" cy="18" r="14" fill={fill} stroke="white" strokeWidth="2.5" />
        <path d="M 24 32 L 17 32 L 24 45 L 31 32 Z" fill={fill} />
        {renderIcon(icon)}
      </svg>
    </div>
  );
}
