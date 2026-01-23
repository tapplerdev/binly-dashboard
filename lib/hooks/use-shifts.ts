import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getShifts, assignRoute, clearAllShifts } from '@/lib/api/shifts';
import { Shift } from '@/lib/types/shift';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
import { useAuthStore } from '@/lib/auth/store';

// Query keys
export const shiftKeys = {
  all: ['shifts'] as const,
  detail: (id: string) => ['shifts', id] as const,
};

/**
 * Fetch all shifts with caching, auto-refetch, and WebSocket real-time updates
 */
export function useShifts() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
  const wsUrl = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`;

  // WebSocket connection for real-time shift updates
  useWebSocket({
    url: wsUrl,
    onMessage: (message: WebSocketMessage) => {
      switch (message.type) {
        case 'shift_update':
          // Driver started, paused, resumed, or ended their shift
          console.log('📡 WebSocket: Shift updated, refreshing shifts list');
          queryClient.invalidateQueries({ queryKey: shiftKeys.all });
          break;

        case 'driver_shift_change':
          // Driver shift state changed (started, ended, assigned)
          console.log('📡 WebSocket: Driver shift changed, refreshing shifts list');
          queryClient.invalidateQueries({ queryKey: shiftKeys.all });
          break;

        case 'route_assigned':
          // Manager assigned a route to a driver
          console.log('📡 WebSocket: Route assigned, refreshing shifts list');
          queryClient.invalidateQueries({ queryKey: shiftKeys.all });
          break;

        case 'shift_deleted':
          // Shift was deleted/cleared
          console.log('📡 WebSocket: Shift deleted, refreshing shifts list');
          queryClient.invalidateQueries({ queryKey: shiftKeys.all });
          break;
      }
    },
  });

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
