import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoutes, createRoute, updateRoute, deleteRoute, duplicateRoute } from '@/lib/api/routes';
import { Route } from '@/lib/types/route';

// Query keys
export const routeKeys = {
  all: ['routes'] as const,
  detail: (id: string) => ['routes', id] as const,
};

/**
 * Fetch all routes with caching and auto-refetch
 */
export function useRoutes() {
  return useQuery({
    queryKey: routeKeys.all,
    queryFn: getRoutes,
  });
}

/**
 * Create a new route with optimistic updates
 */
export function useCreateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRoute,
    onMutate: async (newRoute) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: routeKeys.all });

      // Snapshot previous value
      const previousRoutes = queryClient.getQueryData<Route[]>(routeKeys.all);

      // Optimistically update to the new value
      if (previousRoutes) {
        const optimisticRoute: Route = {
          id: `temp-${Date.now()}`, // Temporary ID
          name: newRoute.name,
          description: newRoute.description,
          geographic_area: newRoute.geographic_area,
          schedule_pattern: newRoute.schedule_pattern,
          bin_ids: newRoute.bin_ids,
          bin_count: newRoute.bin_ids.length,
          estimated_duration_hours: newRoute.estimated_duration_hours || 6,
          created_at: Date.now(),
          updated_at: Date.now(),
        };

        queryClient.setQueryData<Route[]>(
          routeKeys.all,
          [...previousRoutes, optimisticRoute]
        );
      }

      return { previousRoutes };
    },
    onError: (err, newRoute, context) => {
      // Rollback on error
      if (context?.previousRoutes) {
        queryClient.setQueryData(routeKeys.all, context.previousRoutes);
      }
    },
    onSuccess: () => {
      // Refetch to get real data from server
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
}

/**
 * Update an existing route
 */
export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, data }: { routeId: string; data: Partial<Route> }) =>
      updateRoute(routeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
}

/**
 * Delete a route
 */
export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRoute,
    onMutate: async (routeId) => {
      await queryClient.cancelQueries({ queryKey: routeKeys.all });
      const previousRoutes = queryClient.getQueryData<Route[]>(routeKeys.all);

      // Optimistically remove from list
      if (previousRoutes) {
        queryClient.setQueryData<Route[]>(
          routeKeys.all,
          previousRoutes.filter((r) => r.id !== routeId)
        );
      }

      return { previousRoutes };
    },
    onError: (err, routeId, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData(routeKeys.all, context.previousRoutes);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
}

/**
 * Duplicate a route
 */
export function useDuplicateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, name }: { routeId: string; name: string }) =>
      duplicateRoute(routeId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
}
