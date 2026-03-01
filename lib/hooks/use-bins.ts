import { useQuery } from '@tanstack/react-query';
import { getBins, getBinById, getBinChecks, getBinMoves, getBinIncidents } from '@/lib/api/bins';

// Query keys
export const binKeys = {
  all: ['bins'] as const,
  detail: (id: string) => ['bins', id] as const,
  checks: (id: string) => ['bins', id, 'checks'] as const,
  moves: (id: string) => ['bins', id, 'moves'] as const,
  incidents: (id: string) => ['bins', id, 'incidents'] as const,
};

/**
 * Fetch all bins with caching and auto-refetch
 *
 * Cache strategy:
 * - staleTime: 30s (data considered fresh for 30 seconds)
 * - gcTime: 5 minutes (cache kept for 5 minutes)
 * - refetchOnWindowFocus: true (refetch when user returns to tab)
 * - refetchInterval: 60s (auto-refetch every minute for real-time updates)
 */
export function useBins() {
  return useQuery({
    queryKey: binKeys.all,
    queryFn: getBins,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute for fill level updates
  });
}

/**
 * Fetch a single bin by ID
 */
export function useBin(id: string) {
  return useQuery({
    queryKey: binKeys.detail(id),
    queryFn: () => getBinById(id),
    enabled: !!id, // Only run query if id is provided
  });
}

/**
 * Fetch check history for a bin
 */
export function useBinChecks(binId: string) {
  return useQuery({
    queryKey: binKeys.checks(binId),
    queryFn: () => getBinChecks(binId),
    enabled: !!binId,
  });
}

/**
 * Fetch move history for a bin
 */
export function useBinMoves(binId: string) {
  return useQuery({
    queryKey: binKeys.moves(binId),
    queryFn: () => getBinMoves(binId),
    enabled: !!binId,
  });
}

/**
 * Fetch zone incidents for a bin
 */
export function useBinIncidents(binId: string) {
  return useQuery({
    queryKey: binKeys.incidents(binId),
    queryFn: () => getBinIncidents(binId),
    enabled: !!binId,
  });
}
