/**
 * Notification Settings API Client
 * Manages notification preferences and notification history log
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

export interface NotificationSettings {
  drift_alerts_enabled: boolean;
  drift_check_interval_minutes: number;
  drift_threshold_meters: number;
  morning_digest_enabled: boolean;
  morning_digest_hour: number;
  morning_digest_minute: number;
  afternoon_digest_enabled: boolean;
  afternoon_digest_hour: number;
  afternoon_digest_minute: number;
  shift_notifications_enabled: boolean;
  move_request_notifications_enabled: boolean;
  timezone: string;
  overdue_move_alerts_enabled: boolean;
  overdue_move_check_interval_minutes: number;
  due_soon_alerts_enabled: boolean;
  due_soon_hours_before: number;
  daily_move_report_enabled: boolean;
  daily_move_report_hour: number;
  daily_move_report_minute: number;
  daily_bin_check_enabled: boolean;
  daily_bin_check_hour: number;
  daily_bin_check_minute: number;
  daily_battery_report_enabled: boolean;
  daily_battery_report_hour: number;
  daily_battery_report_minute: number;
}

export interface NotificationLogEntry {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  recipients_count: number;
  created_at: number;
}

export interface NotificationLogResponse {
  notifications: NotificationLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await fetch(`${API_URL}/api/manager/notification-settings`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notification settings');
  }

  return response.json();
}

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<{ status: string; settings: NotificationSettings }> {
  const response = await fetch(`${API_URL}/api/manager/notification-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update notification settings');
  }

  return response.json();
}

export interface DigestResult {
  already_sent: boolean;
  window: string;
  overdue_count: number;
  urgent_count: number;
  soon_count: number;
  warehouse_count: number;
  critical_bins?: number;
  overdue_bins?: number;
  tokens_sent: number;
}

export async function triggerDigest(
  window: 'morning' | 'afternoon' | 'daily_move_report' | 'daily_bin_check_report' | 'daily_battery_report',
  force: boolean = false
): Promise<DigestResult> {
  const params = new URLSearchParams({ window });
  if (force) params.set('force', 'true');

  const response = await fetch(
    `${API_URL}/api/manager/daily-digest?${params}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to trigger digest');
  }

  return response.json();
}

export async function getNotificationLog(
  page: number = 1,
  limit: number = 20,
  type?: string
): Promise<NotificationLogResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (type) params.set('type', type);

  const response = await fetch(
    `${API_URL}/api/manager/notification-log?${params}`,
    {
      headers: getAuthHeaders(),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch notification log');
  }

  return response.json();
}
