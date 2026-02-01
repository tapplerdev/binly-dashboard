import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWarehouseLocation, updateWarehouseLocation } from '@/lib/api/config';
import { WarehouseLocation } from '@/lib/types/config';

// Query keys
export const warehouseKeys = {
  location: ['warehouse', 'location'] as const,
};

/**
 * Fetch warehouse location with caching and auto-refetch
 *
 * Cache strategy:
 * - staleTime: 5 minutes (warehouse location changes infrequently)
 * - gcTime: 10 minutes (keep in cache for 10 minutes)
 * - refetchOnWindowFocus: true (refetch when user returns to tab)
 */
export function useWarehouseLocation() {
  return useQuery({
    queryKey: warehouseKeys.location,
    queryFn: getWarehouseLocation,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Update warehouse location mutation
 * Automatically invalidates and refetches warehouse location on success
 *
 * Usage:
 * ```tsx
 * const updateWarehouse = useUpdateWarehouseLocation();
 * updateWarehouse.mutate({
 *   latitude: 37.3009357,
 *   longitude: -121.9493848,
 *   address: "1185 Campbell Ave, San Jose, CA 95126, United States"
 * });
 * ```
 */
export function useUpdateWarehouseLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWarehouseLocation,
    onSuccess: () => {
      // Invalidate warehouse location query to trigger refetch
      queryClient.invalidateQueries({ queryKey: warehouseKeys.location });
    },
  });
}
