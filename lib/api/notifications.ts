/**
 * User Notifications API Client
 * Per-user notification inbox, read status, and preferences
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;
    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface UserNotification {
  id: string;
  user_id: string;
  notification_log_id?: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  delivery_status: 'pending' | 'delivered' | 'failed';
  read_at: number | null;
  created_at: number;
}

export interface NotificationsResponse {
  notifications: UserNotification[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationPreferences {
  user_id: string;
  drift_alerts: boolean;
  digests: boolean;
  shift_events: boolean;
  move_requests: boolean;
  overdue_move_alerts: boolean;
  due_soon_alerts: boolean;
  bin_check_reports: boolean;
  battery_alerts: boolean;
}

export async function getNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_URL}/api/notifications?${params}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
  const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch unread count');
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
}

export async function markAllNotificationsRead(): Promise<{ marked_count: number }> {
  const res = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to mark all as read');
  return res.json();
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${API_URL}/api/notifications/preferences`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

export async function updateNotificationPreferences(
  prefs: Omit<NotificationPreferences, 'user_id'>
): Promise<{ status: string; preferences: NotificationPreferences }> {
  const res = await fetch(`${API_URL}/api/notifications/preferences`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}
