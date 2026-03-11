import { create } from 'zustand';

export interface DriftAlert {
  id: string;
  bin_number: number;
  bin_id: string;
  bin_status: string;
  expected_lat: number;
  expected_lng: number;
  actual_lat: number;
  actual_lng: number;
  distance_meters: number;
  expected_address: string;
  actual_address: string;
  detected_at: string;
  title: string;
  body: string;
  read: boolean;
}

interface NotificationState {
  alerts: DriftAlert[];
  unreadCount: number;
  addAlert: (alert: DriftAlert) => void;
  markAllRead: () => void;
  clearAlerts: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50), // keep last 50
      unreadCount: state.unreadCount + 1,
    })),

  markAllRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
    })),

  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
}));
