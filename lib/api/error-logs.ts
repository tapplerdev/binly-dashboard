import { getAuthHeaders } from './config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface AppErrorLog {
  id: string;
  driver_id?: string;
  driver_name?: string;
  shift_id?: string;
  task_id?: string;
  created_at_iso: string;
  log_timestamp_iso: string;
  context: string;
  error_type: string;
  error_message: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  platform: 'ios' | 'android';
  app_version?: string;
  os_version?: string;
  device_info?: string;
  last_gps_latitude?: number;
  last_gps_longitude?: number;
  stack_trace?: string;
  metadata?: string; // JSON string
  is_resolved: boolean;
  resolved_at_iso?: string;
  resolved_by_user_id?: string;
  resolved_by_user_name?: string;
  notes?: string;
}

export interface AppErrorStats {
  last_24h: number;
  last_7d: number;
  last_30d: number;
  critical_unresolved: number;
  error_unresolved: number;
  navigation_errors: number;
  total_unresolved: number;
}

export interface GetErrorLogsParams {
  driver_id?: string;
  shift_id?: string;
  context?: string;
  severity?: string;
  platform?: string;
  is_resolved?: boolean;
  limit?: number;
}

/**
 * Get all app error logs with optional filtering
 */
export async function getAppErrorLogs(params?: GetErrorLogsParams): Promise<AppErrorLog[]> {
  const queryParams = new URLSearchParams();

  if (params?.driver_id) queryParams.append('driver_id', params.driver_id);
  if (params?.shift_id) queryParams.append('shift_id', params.shift_id);
  if (params?.context) queryParams.append('context', params.context);
  if (params?.severity) queryParams.append('severity', params.severity);
  if (params?.platform) queryParams.append('platform', params.platform);
  if (params?.is_resolved !== undefined) queryParams.append('is_resolved', String(params.is_resolved));
  if (params?.limit) queryParams.append('limit', String(params.limit));

  const response = await fetch(
    `${API_BASE_URL}/manager/logs/app-errors?${queryParams.toString()}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch error logs: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get error log statistics
 */
export async function getAppErrorStats(): Promise<AppErrorStats> {
  const response = await fetch(
    `${API_BASE_URL}/manager/logs/app-error-stats`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch error stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Resolve an error log
 */
export async function resolveAppErrorLog(
  errorLogId: string,
  notes?: string
): Promise<{ status: string; id: string }> {
  const response = await fetch(
    `${API_BASE_URL}/manager/logs/app-errors/${errorLogId}/resolve`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to resolve error log: ${response.statusText}`);
  }

  return response.json();
}
