import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAirTagLocations, syncAirTags, type AirTagLocationsResponse } from '@/lib/api/airtags';

export const airtagKeys = {
  all: ['airtag-locations'] as const,
};

/**
 * Fetch all AirTag locations from the FindMy bridge service.
 *
 * Bridge syncs with Apple every 5 min, so we poll every 5 min to match.
 * "Sync Now" invalidates the cache for an immediate refresh.
 */
export function useAirTags() {
  return useQuery({
    queryKey: airtagKeys.all,
    queryFn: getAirTagLocations,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    select: (data: AirTagLocationsResponse) => ({
      locations: data.data,
      unmatched: data.unmatched ?? [],
      lastSyncAt: data.last_sync_at,
    }),
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
