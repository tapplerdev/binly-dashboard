import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNoGoZones,
  getNoGoZone,
  getZoneIncidents,
  getFieldObservations,
  verifyFieldObservation,
  getShiftIncidents,
} from '@/lib/api/zones';

// Query keys
export const zoneKeys = {
  all: ['zones'] as const,
  byStatus: (status?: string) => ['zones', { status }] as const,
  detail: (id: string) => ['zones', id] as const,
  incidents: (id: string) => ['zones', id, 'incidents'] as const,
  fieldObservations: (status?: 'all' | 'pending' | 'verified') => ['field-observations', { status }] as const,
  shiftIncidents: (shiftId: string) => ['shifts', shiftId, 'incidents'] as const,
};

/**
 * Fetch all no-go zones with caching
 *
 * Cache strategy:
 * - staleTime: 2 minutes (zones don't change frequently)
 * - gcTime: 10 minutes
 * - refetchOnWindowFocus: true
 */
export function useNoGoZones(status?: string) {
  return useQuery({
    queryKey: status ? zoneKeys.byStatus(status) : zoneKeys.all,
    queryFn: () => getNoGoZones(status),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch a single zone by ID
 */
export function useNoGoZone(id: string) {
  return useQuery({
    queryKey: zoneKeys.detail(id),
    queryFn: () => getNoGoZone(id),
    enabled: !!id,
  });
}

/**
 * Fetch incidents for a specific zone
 */
export function useZoneIncidents(zoneId: string) {
  return useQuery({
    queryKey: zoneKeys.incidents(zoneId),
    queryFn: () => getZoneIncidents(zoneId),
    enabled: !!zoneId,
  });
}

/**
 * Fetch field observations for manager review
 */
export function useFieldObservations(status?: 'all' | 'pending' | 'verified') {
  return useQuery({
    queryKey: zoneKeys.fieldObservations(status),
    queryFn: () => getFieldObservations(status),
  });
}

/**
 * Fetch incidents for a specific shift
 */
export function useShiftIncidents(shiftId: string) {
  return useQuery({
    queryKey: zoneKeys.shiftIncidents(shiftId),
    queryFn: () => getShiftIncidents(shiftId),
    enabled: !!shiftId,
  });
}

/**
 * Verify a field observation
 */
export function useVerifyFieldObservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyFieldObservation,
    onSuccess: () => {
      // Invalidate field observations to refetch
      queryClient.invalidateQueries({ queryKey: ['field-observations'] });
    },
  });
}
