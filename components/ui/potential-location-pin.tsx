/**
 * Orange Pin Icon Component
 *
 * Renders a map pin/teardrop marker with a plus sign in the center.
 * Matches the design from the Ropacal mobile app for potential locations.
 *
 * Design specs:
 * - Color: #FF9500 (iOS orange)
 * - Shape: Classic pin/teardrop (circle top + pointed bottom)
 * - Icon: White plus sign (+) centered
 * - Border: White stroke around circle
 */

interface PotentialLocationPinProps {
  /** Size in pixels (width and height). Default: 48 */
  size?: number;
  /** Custom color override. Default: #FF9500 (iOS orange) */
  color?: string;
  /** Optional className for styling wrapper div */
  className?: string;
}

export function PotentialLocationPin({
  size = 48,
  color = '#FF9500',
  className,
}: PotentialLocationPinProps) {
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
      >
        {/* Circle (top part of pin) */}
        <circle
          cx="24"
          cy="18"
          r="14"
          fill={color}
          stroke="white"
          strokeWidth="2.5"
        />

        {/* Teardrop/point (bottom part of pin) */}
        <path
          d="M 24 32 L 17 32 L 24 45 L 31 32 Z"
          fill={color}
        />

        {/* Plus sign icon (centered in circle) */}
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round">
          {/* Vertical line */}
          <line x1="24" y1="13" x2="24" y2="23" />
          {/* Horizontal line */}
          <line x1="19" y1="18" x2="29" y2="18" />
        </g>
      </svg>
    </div>
  );
}
