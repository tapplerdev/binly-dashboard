'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownOption {
  value: string;
  label: string;
  /** Renders the row muted and unselectable. */
  disabled?: boolean;
  /** Muted text after the label — a status, a count, a hint. */
  hint?: string;
}

interface DropdownProps {
  /** Inline prefix inside the trigger ("Status:"). Omit when an external label already names the field. */
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /** Disables the whole control. */
  disabled?: boolean;
  /** Extra classes for the trigger button — width, in practice. */
  triggerClassName?: string;
}

export function Dropdown({
  label,
  value,
  options,
  onChange,
  className,
  placeholder = 'Select...',
  disabled = false,
  triggerClassName,
}: DropdownProps) {
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
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            handleCloseDropdown();
          } else {
            setIsOpen(true);
          }
        }}
        className={cn(
          'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg transition-colors text-sm font-medium text-gray-700 min-w-[140px]',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50',
          triggerClassName
        )}
      >
        {label && <span className="text-gray-500">{label}:</span>}
        <span className={cn(selectedOption ? 'text-gray-900' : 'text-gray-500')}>
          {selectedOption?.label || placeholder}
        </span>
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
              disabled={option.disabled}
              onClick={() => {
                // Guarded as well as disabled: a disabled row must never fire
                // onChange, and callers use it for choices that would break the
                // page if selected.
                if (option.disabled) return;
                onChange(option.value);
                handleCloseDropdown();
              }}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                index === 0 && 'rounded-t-lg',
                index === options.length - 1 && 'rounded-b-lg',
                option.disabled
                  ? 'cursor-not-allowed text-gray-400'
                  : option.value === value
                  ? 'bg-blue-50 text-primary font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {option.label}
              {option.hint && (
                <span className="ml-1.5 text-xs font-normal text-gray-400">{option.hint}</span>
              )}
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
            'absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg z-50',
            isClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'
          )}
        >
          {options.map((option, index) => (
            <label
              key={option.value}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors',
                index === 0 && 'rounded-t-lg',
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

interface DropdownOptionGroup {
  label: string;
  options: DropdownOption[];
}

interface GroupedDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  optionGroups: DropdownOptionGroup[];
  onChange: (value: string) => void;
  className?: string;
}

export function GroupedDropdown({
  label,
  placeholder = 'Select...',
  value,
  optionGroups,
  onChange,
  className,
}: GroupedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCloseDropdown = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 150);
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

  // Find selected option across all groups
  const selectedOption = optionGroups
    .flatMap((group) => group.options)
    .find((opt) => opt.value === value);

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
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          {label && <span className="text-gray-500">{label}:</span>}
          <span className={cn('text-gray-900', !selectedOption && 'text-gray-500')}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {(isOpen || isClosing) && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 w-full min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-[300px] overflow-y-auto',
            isClosing ? 'animate-slide-out-up' : 'animate-slide-in-down'
          )}
        >
          {optionGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Group Label */}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                {group.label}
              </div>
              {/* Group Options */}
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    handleCloseDropdown();
                  }}
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm transition-colors',
                    option.value === value
                      ? 'bg-blue-50 text-primary font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
