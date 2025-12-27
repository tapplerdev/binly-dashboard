import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Global input styling for consistent form inputs across the app
 * Uses thin focus borders (ring-1) for a cleaner look
 */
export function inputStyles(additionalClasses?: string) {
  return cn(
    'w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400',
    'focus:outline-none focus:border-[#5E9646] focus:ring-2 focus:ring-[#5E9646]/20',
    'transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
    additionalClasses
  );
}
