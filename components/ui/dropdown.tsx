'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function Dropdown({ label, value, options, onChange, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCloseDropdown = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 150); // Match animation duration
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) {
          handleCloseDropdown();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            handleCloseDropdown();
          } else {
            setIsOpen(true);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 min-w-[140px]"
      >
        {label && <span className="text-gray-500">{label}:</span>}
        <span className="text-gray-900">{selectedOption?.label || 'Select...'}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform ml-auto',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {(isOpen || isClosing) && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 w-full min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden',
            isClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'
          )}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                handleCloseDropdown();
              }}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                index === 0 && 'rounded-t-lg',
                index === options.length - 1 && 'rounded-b-lg',
                option.value === value
                  ? 'bg-blue-50 text-primary font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MultiSelectDropdownProps {
  label: string;
  selectedValues: string[];
  options: DropdownOption[];
  onChange: (values: string[]) => void;
  className?: string;
}

export function MultiSelectDropdown({
  label,
  selectedValues,
  options,
  onChange,
  className,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCloseDropdown = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 150); // Match animation duration
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) {
          handleCloseDropdown();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const displayText =
    selectedValues.length === 0
      ? 'All'
      : selectedValues.length === 1
      ? options.find((opt) => opt.value === selectedValues[0])?.label
      : `${selectedValues.length} selected`;

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            handleCloseDropdown();
          } else {
            setIsOpen(true);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 min-w-[160px]"
      >
        {label && <span className="text-gray-500">{label}:</span>}
        <span className="text-gray-900">{displayText}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform ml-auto',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {(isOpen || isClosing) && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden',
            isClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'
          )}
        >
          {options.map((option, index) => (
            <label
              key={option.value}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors',
                index === 0 && 'rounded-t-lg',
                index === options.length - 1 && 'rounded-b-lg'
              )}
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
