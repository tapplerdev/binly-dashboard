'use client';

import { useState } from 'react';
import {
  Bell,
  Clock,
  Radar,
  Save,
  ChevronLeft,
  ChevronRight,
  Truck,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useNotificationLog,
} from '@/lib/hooks/use-notification-settings';
import type { NotificationSettings } from '@/lib/api/notification-settings';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

const NOTIFICATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'bin_drift_alert', label: 'Drift Alerts' },
  { value: 'digest_overdue_moves', label: 'Overdue Moves' },
  { value: 'digest_upcoming_moves', label: 'Upcoming Moves' },
  { value: 'digest_warehouse_bins', label: 'Warehouse Bins' },
];

function getTypeBadge(type: string) {
  switch (type) {
    case 'bin_drift_alert':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Drift Alert</Badge>;
    case 'digest_overdue_moves':
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Overdue</Badge>;
    case 'digest_upcoming_moves':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Upcoming</Badge>;
    case 'digest_warehouse_bins':
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Warehouse</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{type}</Badge>;
  }
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20',
        checked ? 'bg-[#4880FF]' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function NotificationSettingsTab() {
  const { data: settings, isLoading } = useNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();
  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);

  const current = localSettings || settings;

  if (isLoading || !current) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Initialize local state from server data on first render
  if (!localSettings && settings) {
    setLocalSettings({ ...settings });
  }

  const update = (key: keyof NotificationSettings, value: boolean | number) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!localSettings) return;
    updateMutation.mutate(localSettings);
  };

  const isDirty = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      {/* Drift Alerts */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <Radar className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base">Drift Alerts</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Alert when a bin moves away from its assigned location
                </p>
              </div>
            </div>
            <Toggle
              checked={current.drift_alerts_enabled}
              onChange={(val) => update('drift_alerts_enabled', val)}
            />
          </div>
        </CardHeader>
        {current.drift_alerts_enabled && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-12">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Check Interval (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={current.drift_check_interval_minutes}
                  onChange={(e) =>
                    update('drift_check_interval_minutes', parseInt(e.target.value) || 5)
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-gray-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Threshold (meters)
                </label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={current.drift_threshold_meters}
                  onChange={(e) =>
                    update('drift_threshold_meters', parseInt(e.target.value) || 500)
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-gray-300"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Morning Digest */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Morning Digest</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Daily summary of overdue moves and warehouse status
                </p>
              </div>
            </div>
            <Toggle
              checked={current.morning_digest_enabled}
              onChange={(val) => update('morning_digest_enabled', val)}
            />
          </div>
        </CardHeader>
        {current.morning_digest_enabled && (
          <CardContent className="pt-0">
            <div className="pl-12">
              <label className="text-sm font-medium text-gray-700">Send At</label>
              <select
                value={current.morning_digest_hour}
                onChange={(e) => update('morning_digest_hour', parseInt(e.target.value))}
                className="mt-1 block w-full sm:w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-gray-300"
              >
                {HOUR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Afternoon Digest */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-base">Afternoon Digest</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Afternoon update on move requests and warehouse bins
                </p>
              </div>
            </div>
            <Toggle
              checked={current.afternoon_digest_enabled}
              onChange={(val) => update('afternoon_digest_enabled', val)}
            />
          </div>
        </CardHeader>
        {current.afternoon_digest_enabled && (
          <CardContent className="pt-0">
            <div className="pl-12">
              <label className="text-sm font-medium text-gray-700">Send At</label>
              <select
                value={current.afternoon_digest_hour}
                onChange={(e) => update('afternoon_digest_hour', parseInt(e.target.value))}
                className="mt-1 block w-full sm:w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-gray-300"
              >
                {HOUR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Shift Notifications */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">Shift Notifications</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Alerts for shift start, pause, end events
                </p>
              </div>
            </div>
            <Toggle
              checked={current.shift_notifications_enabled}
              onChange={(val) => update('shift_notifications_enabled', val)}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Move Request Notifications */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Move Request Notifications</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Alerts for new and updated move requests
                </p>
              </div>
            </div>
            <Toggle
              checked={current.move_request_notifications_enabled}
              onChange={(val) => update('move_request_notifications_enabled', val)}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {updateMutation.isSuccess && (
        <p className="text-sm text-green-600 text-right">Settings saved successfully.</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-red-600 text-right">
          Failed to save: {(updateMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

function NotificationHistoryTab() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const { data, isLoading } = useNotificationLog(page, typeFilter || undefined);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by type:</label>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-gray-300"
        >
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Title
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Body
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Recipients
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : !data?.notifications.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    No notifications sent yet
                  </td>
                </tr>
              ) : (
                data.notifications.map((notif) => (
                  <tr
                    key={notif.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">{getTypeBadge(notif.type)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {notif.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell max-w-xs truncate">
                      {notif.body}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {notif.recipients_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">
                      {new Date(notif.created_at * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({data?.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Control Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage notification preferences and view notification history
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'settings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notification Settings
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Notification History
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' ? <NotificationSettingsTab /> : <NotificationHistoryTab />}
    </div>
  );
}
