import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, assignRoute, clearAllShifts } from '@/lib/api/shifts';
import { Shift } from '@/lib/types/shift';

// Query keys
export const shiftKeys = {
  all: ['shifts'] as const,
  detail: (id: string) => ['shifts', id] as const,
};

/**
 * Fetch all shifts with caching and auto-refetch
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
export function useAssignRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignRoute,
    onMutate: async (newShift) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: shiftKeys.all });

      // Snapshot previous value
      const previousShifts = queryClient.getQueryData<Shift[]>(shiftKeys.all);

      // Optimistically update to the new value
      if (previousShifts) {
        const optimisticShift: Shift = {
          id: `temp-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          startTime: '08:00',
          endTime: '16:00',
          driverId: newShift.driver_id,
          driverName: 'Loading...',
          route: newShift.route_id,
          binCount: newShift.bin_ids.length,
          status: 'scheduled',
        };

        queryClient.setQueryData<Shift[]>(
          shiftKeys.all,
          [...previousShifts, optimisticShift]
        );
      }

      return { previousShifts };
    },
    onError: (err, newShift, context) => {
      // Rollback on error
      if (context?.previousShifts) {
        queryClient.setQueryData(shiftKeys.all, context.previousShifts);
      }
    },
    onSuccess: () => {
      // Refetch to get real data from server
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

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
