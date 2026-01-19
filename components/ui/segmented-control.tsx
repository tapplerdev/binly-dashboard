'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SegmentedControlOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  // Update slider position when value changes
  useEffect(() => {
    const updateSlider = () => {
      const button = buttonRefs.current[value];
      if (button) {
        setSliderStyle({
          left: button.offsetLeft,
          width: button.offsetWidth,
        });
      }
    };

    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
      updateSlider();
    });
  }, [value]);

  return (
    <div
      className={cn(
        'relative inline-flex items-center bg-gray-100 rounded-lg p-1',
        className
      )}
    >
      {/* Sliding background */}
      <div
        className="absolute bg-white rounded-md shadow-sm transition-all duration-200 ease-in-out"
        style={{
          left: `${sliderStyle.left}px`,
          width: `${sliderStyle.width}px`,
          top: '4px',
          bottom: '4px',
        }}
      />

      {/* Buttons */}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            buttonRefs.current[option.value] = el;
          }}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'relative z-10 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            value === option.value
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
