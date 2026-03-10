import { useQuery } from '@tanstack/react-query';
import { getAirTagLocations, type AirTagLocationsResponse } from '@/lib/api/airtags';

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
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    select: (data: AirTagLocationsResponse) => data.data,
  });
}
