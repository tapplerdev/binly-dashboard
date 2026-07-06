import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, clearAllShifts } from '@/lib/api/shifts';
import { Shift } from '@/lib/types/shift';

// Query keys
export const shiftKeys = {
  all: ['shifts'] as const,
  detail: (id: string) => ['shifts', id] as const,
};

/**
 * Fetch all shifts with caching and auto-refetch.
 * Real-time updates are handled by GlobalCentrifugoSync (company:events channel).
 */
export function useShifts() {
  return useQuery({
    queryKey: shiftKeys.all,
    queryFn: getShifts,
  });
}

/**
 * Assign a route to a driver (create shift) with optimistic updates
 */
/**
 * Clear all shifts (for testing)
 */
export function useClearAllShifts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllShifts,
    onSuccess: () => {
      // Clear the cache
      queryClient.setQueryData<Shift[]>(shiftKeys.all, []);
    },
  });
}
