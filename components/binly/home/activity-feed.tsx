'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { markNotificationRead } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';
import { Bell } from 'lucide-react';

// Floors like the top-nav bell so the two feeds agree on the same event.
function timeAgo(unixSeconds: number): string {
  const mins = Math.max(0, Math.floor((Date.now() / 1000 - unixSeconds) / 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Slot 5b — a small, real activity feed from the notifications inbox.
 * Ambient awareness only; decision-bearing items live in the triage board.
 */
export function ActivityFeed() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications(1);
  const notifications = (data?.notifications ?? []).slice(0, 6);

  const handleClick = async (id: string, unread: boolean) => {
    if (!unread) return;
    try {
      await markNotificationRead(id);
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    } catch {
      // best-effort; the inbox page owns full management
    }
  };

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">Recent activity</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No recent activity.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {notifications.map((n) => {
            const unread = n.read_at == null;
            return (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n.id, unread)}
                  className="w-full text-left py-2.5 flex items-start gap-2.5 group"
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0',
                      unread ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm leading-snug truncate',
                        unread ? 'font-semibold text-gray-900' : 'text-gray-600'
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 truncate">{n.body}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">
                    {timeAgo(n.created_at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
