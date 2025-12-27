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
    'block w-full px-5 py-3.5 bg-white border border-solid border-neutral-200 rounded-xl text-sm placeholder-gray-400',
    'shadow-sm focus:outline-none focus:ring-1 focus:ring-[#5E9646] focus:border-[#5E9646] focus:shadow-md',
    'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    additionalClasses
  );
}
