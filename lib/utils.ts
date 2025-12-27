import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Global input styling for consistent form inputs across the app
 * Standard login form sizing with clean borders
 */
export function inputStyles(additionalClasses?: string) {
  return cn(
    'w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400',
    'focus:outline-none focus:border-[#5E9646] focus:ring-1 focus:ring-[#5E9646]',
    'transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
    additionalClasses
  );
}
