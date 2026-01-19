'use client';

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useGoogleMaps } from '@/components/binly/map-provider';
import { MapPin } from 'lucide-react';

interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  isAutoFilled?: boolean;
  isLoading?: boolean;
  error?: boolean;
}

export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  disabled = false,
  className,
  placeholder = '123 Main Street',
  isAutoFilled = false,
  isLoading = false,
  error = false,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const justSelectedRef = useRef(false); // Track if we just selected a place
  const lastSelectedValueRef = useRef<string>(''); // Track the last selected value

  // Try to get Google Maps state, with fallback
  let isLoaded = false;
  let loadError: Error | undefined;

  try {
    const mapsContext = useGoogleMaps();
    isLoaded = mapsContext.isLoaded;
    loadError = mapsContext.loadError;
  } catch (error) {
    console.error('❌ useGoogleMaps hook error:', error);
    // Fallback: check if Google Maps is available directly
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      isLoaded = true;
      console.log('✅ Using direct Google Maps detection');
    }
  }

  // Debug: Log loading state
  useEffect(() => {
    console.log('🗺️ PlacesAutocomplete mounted! Loading state:', { isLoaded, loadError });
  }, [isLoaded, loadError]);

  // Initialize services
  useEffect(() => {
    if (!isLoaded || disabled) return;

    try {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

        // PlacesService requires a DOM element, use a hidden div
        const div = document.createElement('div');
        placesServiceRef.current = new google.maps.places.PlacesService(div);

        console.log('✅ Google Places services initialized');
      } else {
        console.error('❌ Google Places API not available');
      }
    } catch (error) {
      console.error('❌ Error initializing Places services:', error);
    }
  }, [isLoaded, disabled]);

  // Update dropdown position when input position changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Fetch suggestions
  useEffect(() => {
    // Don't fetch if we just selected a place
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    // Don't fetch if the value matches the last selected value
    if (value && value === lastSelectedValueRef.current) {
      return;
    }

    // Don't fetch if the field is auto-filled (from reverse geocoding)
    if (isAutoFilled) {
      return;
    }

    if (!value || value.length < 3 || !autocompleteServiceRef.current || disabled) {
      if (value && value.length < 3) {
        console.log('⏳ Waiting for 3+ characters...');
      }
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    console.log('🔍 Fetching suggestions for:', value);
    setIsFetching(true);

    const timer = setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: value,
          types: ['address'],
          componentRestrictions: { country: 'us' },
        },
        (predictions, status) => {
          console.log('📍 Places API response:', status, predictions?.length || 0, 'results');
          setIsFetching(false);

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formatted = predictions.map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text,
            }));
            console.log('✅ Showing', formatted.length, 'suggestions');
            setSuggestions(formatted);
            setIsOpen(true);
            setSelectedIndex(-1);
          } else {
            console.warn('❌ No predictions:', status);
            setSuggestions([]);
            setIsOpen(false);
          }
        }
      );
    }, 500); // Debounce - Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [value, disabled, isAutoFilled]);

  // Handle place selection
  const selectPlace = (placeId: string) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          justSelectedRef.current = true; // Prevent dropdown from reopening
          lastSelectedValueRef.current = place.formatted_address || ''; // Store the selected value
          onPlaceSelect(place);
          setIsOpen(false);
          setSuggestions([]);
        }
      }
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectPlace(suggestions[selectedIndex].placeId);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle loading states
  if (loadError) {
    console.error('Google Maps load error:', loadError);
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className={cn('w-full px-3 py-2 border rounded-lg text-sm bg-gray-200 animate-pulse', className)}>
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  // Determine field styling
  const getFieldStyle = () => {
    if (isLoading) {
      return 'bg-gray-200 animate-pulse border-gray-300';
    }
    if (isAutoFilled) {
      return 'bg-blue-50 border-blue-200 text-blue-900';
    }
    return 'bg-gray-50 border-gray-200 text-gray-900';
  };

  return (
    <>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            console.log('📝 Input changed:', e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors',
            getFieldStyle(),
            error && 'border-red-300',
            className
          )}
          placeholder={placeholder}
          autoComplete="off"
        />

        {/* Loading indicator */}
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Custom Dropdown - Rendered via Portal */}
      {isOpen && suggestions.length > 0 && dropdownPosition && typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => selectPlace(suggestion.placeId)}
                className={cn(
                  'w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-100 last:border-b-0',
                  selectedIndex === index && 'bg-blue-50'
                )}
              >
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.mainText}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.secondaryText}
                  </div>
                </div>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
