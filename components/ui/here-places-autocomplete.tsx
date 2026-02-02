'use client';

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { hereAutosuggest, hereLookup, HereSuggestion, HerePlaceDetails } from '@/lib/services/geocoding.service';

interface HerePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: HerePlaceDetails) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  isAutoFilled?: boolean;
  isLoading?: boolean;
  error?: boolean;
  userLocation?: { lat: number; lng: number }; // Optional: for better suggestions
}

export function HerePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  disabled = false,
  className,
  placeholder = '123 Main Street',
  isAutoFilled = false,
  isLoading = false,
  error = false,
  userLocation,
}: HerePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<HereSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const justSelectedRef = useRef(false); // Track if we just selected a place
  const lastSelectedValueRef = useRef<string>(''); // Track the last selected value
  const userHasTypedRef = useRef(false); // Track if user has actually typed

  // Update dropdown position when input position changes or on scroll
  useEffect(() => {
    if (!isOpen || !inputRef.current) return;

    const updatePosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    // Initial position
    updatePosition();

    // Update on scroll (for modals/scrollable containers)
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Fetch suggestions from HERE Maps
  useEffect(() => {
    // Don't fetch if user hasn't typed yet (e.g., pre-populated value)
    if (!userHasTypedRef.current) {
      return;
    }

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

    if (!value || value.length < 3 || disabled) {
      if (value && value.length < 3) {
        console.log('⏳ Waiting for 3+ characters...');
      }
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    console.log('🔍 Fetching HERE suggestions for:', value);
    setIsFetching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await hereAutosuggest(value, userLocation);
        console.log('📍 HERE API response:', results.length, 'results');

        if (results.length > 0) {
          setSuggestions(results);
          setIsOpen(true);
          setSelectedIndex(-1);
          console.log('✅ Showing', results.length, 'suggestions');
        } else {
          console.warn('❌ No predictions');
          setSuggestions([]);
          setIsOpen(false);
        }
      } catch (error) {
        console.error('❌ HERE autosuggest error:', error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsFetching(false);
      }
    }, 500); // Debounce - Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [value, disabled, isAutoFilled, userLocation]);

  // Handle place selection
  const selectPlace = async (hereId: string, title: string) => {
    console.log('📍 Fetching place details for:', hereId);
    setIsFetching(true);

    try {
      const placeDetails = await hereLookup(hereId);

      if (placeDetails) {
        justSelectedRef.current = true; // Prevent dropdown from reopening
        lastSelectedValueRef.current = placeDetails.formattedAddress || title;
        userHasTypedRef.current = false; // Reset typing state after selection
        onPlaceSelect(placeDetails);
        setIsOpen(false);
        setSuggestions([]);
        console.log('✅ Place selected:', placeDetails);
      } else {
        console.error('❌ Failed to get place details');
      }
    } catch (error) {
      console.error('❌ Place selection error:', error);
    } finally {
      setIsFetching(false);
    }
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
          const suggestion = suggestions[selectedIndex];
          selectPlace(suggestion.id, suggestion.title);
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
            userHasTypedRef.current = true; // Mark that user has typed
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
            {suggestions.map((suggestion, index) => {
              // Extract main text and secondary text from HERE suggestion
              const mainText = suggestion.title;
              const secondaryText = suggestion.address?.label || '';

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => selectPlace(suggestion.id, suggestion.title)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-100 last:border-b-0',
                    selectedIndex === index && 'bg-blue-50'
                  )}
                >
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {mainText}
                    </div>
                    {secondaryText && (
                      <div className="text-xs text-gray-500 truncate">
                        {secondaryText}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
