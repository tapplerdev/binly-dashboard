import { useQuery } from '@tanstack/react-query';
import { getDrivers } from '@/lib/api/drivers';

// Query keys
export const driverKeys = {
  all: ['drivers'] as const,
  available: ['drivers', 'available'] as const,
};

/**
 * Fetch all drivers with caching
 */
export function useDrivers() {
  return useQuery({
    queryKey: driverKeys.all,
    queryFn: getDrivers,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Fetch only available drivers (not on shift)
 */
export function useAvailableDrivers() {
  return useQuery({
    queryKey: driverKeys.available,
    queryFn: async () => {
      const drivers = await getDrivers();
      return drivers.filter(d => d.status === 'available');
    },
    staleTime: 30000,
  });
}
