import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/api/notifications';

export const notificationKeys = {
  all: ['user-notifications'] as const,
  list: (page: number) => ['user-notifications', 'list', page] as const,
  unreadCount: ['user-notifications', 'unread-count'] as const,
  preferences: ['user-notification-preferences'] as const,
};

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: () => getNotifications(page),
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (newPrefs) => {
      await qc.cancelQueries({ queryKey: notificationKeys.preferences });
      const prev = qc.getQueryData<NotificationPreferences>(notificationKeys.preferences);
      qc.setQueryData(notificationKeys.preferences, { ...prev, ...newPrefs });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.preferences, ctx.prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.preferences }),
  });
}
