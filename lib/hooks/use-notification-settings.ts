import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationSettings,
  updateNotificationSettings,
  getNotificationLog,
  triggerDigest,
  type NotificationSettings,
} from '@/lib/api/notification-settings';

export const notificationSettingsKeys = {
  settings: ['notification-settings'] as const,
  log: (page: number, type?: string) => ['notification-log', page, type] as const,
};

/**
 * Fetch current notification settings
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationSettingsKeys.settings,
    queryFn: getNotificationSettings,
    staleTime: 60 * 1000,
  });
}

/**
 * Update notification settings
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotificationSettings,
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: notificationSettingsKeys.settings });
      const previous = queryClient.getQueryData<NotificationSettings>(notificationSettingsKeys.settings);
      queryClient.setQueryData(notificationSettingsKeys.settings, newSettings);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationSettingsKeys.settings, context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationSettingsKeys.settings });
    },
  });
}

/**
 * Trigger a digest manually (with force to bypass dedup)
 */
export function useTriggerDigest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ window, force }: { window: 'morning' | 'afternoon'; force?: boolean }) =>
      triggerDigest(window, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-log'] });
    },
  });
}

/**
 * Fetch paginated notification history log
 */
export function useNotificationLog(page: number = 1, type?: string) {
  return useQuery({
    queryKey: notificationSettingsKeys.log(page, type),
    queryFn: () => getNotificationLog(page, 20, type),
    staleTime: 30 * 1000,
  });
}
