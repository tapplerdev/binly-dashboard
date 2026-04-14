import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAirTagLocations, syncAirTags, type AirTagLocationsResponse } from '@/lib/api/airtags';

export const airtagKeys = {
  all: ['airtag-locations'] as const,
};

/**
 * Fetch all AirTag locations from the FindMy bridge service
 *
 * Cache strategy:
 * - staleTime: 60s (bridge syncs every 15 min, data is relatively stable)
 * - refetchInterval: 5 min (poll bridge periodically for fresh data)
 * - refetchOnWindowFocus: true (refetch when user returns to tab)
 */
export function useAirTags() {
  return useQuery({
    queryKey: airtagKeys.all,
    queryFn: getAirTagLocations,
    staleTime: 30 * 1000,
    refetchInterval: 3 * 60 * 1000,
    select: (data: AirTagLocationsResponse) => data.data,
  });
}

/**
 * Trigger an immediate AirTag location sync.
 * On success, invalidates the location cache so fresh data is fetched.
 */
export function useSyncAirTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncAirTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airtagKeys.all });
    },
  });
}
