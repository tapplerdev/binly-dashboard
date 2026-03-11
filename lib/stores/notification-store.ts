import { create } from 'zustand';
import type { UserNotification } from '@/lib/api/notifications';

interface NotificationState {
  notifications: UserNotification[];
  unreadCount: number;
  isHydrated: boolean;

  /** Called once on mount from API data */
  hydrate: (notifications: UserNotification[], unreadCount: number) => void;

  /** Called by Centrifugo when a real-time notification arrives */
  addNotification: (notif: UserNotification) => void;

  /** Optimistic local mark-read */
  markRead: (id: string) => void;

  /** Optimistic local mark-all-read */
  markAllRead: () => void;

  /** Sync unread count from API refetch */
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isHydrated: false,

  hydrate: (notifications, unreadCount) =>
    set({ notifications, unreadCount, isHydrated: true }),

  addNotification: (notif) =>
    set((state) => ({
      notifications: [notif, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read_at: Math.floor(Date.now() / 1000) } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        read_at: n.read_at || Math.floor(Date.now() / 1000),
      })),
      unreadCount: 0,
    })),

  setUnreadCount: (count) => set({ unreadCount: count }),
}));
