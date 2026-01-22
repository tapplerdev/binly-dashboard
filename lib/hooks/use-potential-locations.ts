import { useQuery } from '@tanstack/react-query';
import {
  getPotentialLocations,
  getPotentialLocationById,
  PotentialLocationStatus,
} from '@/lib/api/potential-locations';

// Query keys
export const potentialLocationKeys = {
  all: ['potential-locations'] as const,
  lists: () => [...potentialLocationKeys.all, 'list'] as const,
  list: (status: PotentialLocationStatus) =>
    [...potentialLocationKeys.lists(), status] as const,
  detail: (id: string) => [...potentialLocationKeys.all, id] as const,
};

/**
 * Fetch all potential locations with caching and auto-refetch
 *
 * Cache strategy:
 * - staleTime: 30s (data considered fresh for 30 seconds)
 * - gcTime: 5 minutes (cache kept for 5 minutes)
 * - refetchOnWindowFocus: true (refetch when user returns to tab)
 * - refetchInterval: 60s (auto-refetch every minute for real-time updates)
 *
 * @param status - Filter by status: 'active' (not converted) or 'converted'
 */
export function usePotentialLocations(status: PotentialLocationStatus = 'active') {
  return useQuery({
    queryKey: potentialLocationKeys.list(status),
    queryFn: () => getPotentialLocations(status),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute for real-time updates
  });
}

/**
 * Fetch a single potential location by ID
 */
export function usePotentialLocation(id: string) {
  return useQuery({
    queryKey: potentialLocationKeys.detail(id),
    queryFn: () => getPotentialLocationById(id),
    enabled: !!id, // Only run query if id is provided
  });
}
