'use client';

import {
  MoveRequestHistoryEvent,
  MoveRequestHistoryMetadata,
  getHistoryActionIcon,
  getHistoryActionColor
} from '@/lib/types/bin';
import { format } from 'date-fns';
import {
  Plus,
  UserPlus,
  RefreshCw,
  UserMinus,
  Edit,
  CheckCircle,
  XCircle,
  History,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveRequestHistoryTimelineProps {
  events: MoveRequestHistoryEvent[];
  isLoading?: boolean;
}

const iconComponents = {
  Plus,
  UserPlus,
  RefreshCw,
  UserMinus,
  Edit,
  CheckCircle,
  XCircle,
};

export function MoveRequestHistoryTimeline({
  events,
  isLoading,
}: MoveRequestHistoryTimelineProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <History className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Request History
        </h3>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <History className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Request History
        </h3>
        <p className="text-sm text-gray-500 text-center py-4">
          No history available for this move request
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
        <History className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        Request History
      </h3>

      <div className="space-y-4 relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {events.map((event, index) => {
          const iconName = getHistoryActionIcon(event.action_type);
          const IconComponent = iconComponents[iconName as keyof typeof iconComponents];
          const colorClasses = getHistoryActionColor(event.action_type);
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="flex gap-3 relative">
              {/* Icon */}
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-white',
                  colorClasses
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {event.action_type_label}
                    </p>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {event.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      By {event.actor_name}
                    </p>
                  </div>
                  <time className="text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(event.created_at_iso), 'MMM dd, h:mm a')}
                  </time>
                </div>

                {/* Additional details for reassignments */}
                {event.action_type === 'reassigned' &&
                  event.previous_assigned_user_name &&
                  event.new_assigned_user_name && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-500">From:</span>{' '}
                      <span className="font-medium">
                        {event.previous_assigned_user_name}
                      </span>
                      {' → '}
                      <span className="text-gray-500">To:</span>{' '}
                      <span className="font-medium">
                        {event.new_assigned_user_name}
                      </span>
                    </div>
                  )}

                {/* Additional details for assignments */}
                {event.action_type === 'assigned' &&
                  event.new_assigned_user_name && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-500">Assigned to:</span>{' '}
                      <span className="font-medium">
                        {event.new_assigned_user_name}
                      </span>
                    </div>
                  )}

                {/* Notes if present */}
                {event.notes && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2 italic">
                    {event.notes}
                  </div>
                )}

                {/* Metadata changes for "updated" events */}
                {event.action_type === 'updated' && event.metadata && (() => {
                  try {
                    const metadata: MoveRequestHistoryMetadata = JSON.parse(event.metadata);

                    if (metadata.changes && metadata.changes.length > 0) {
                      return (
                        <div className="mt-2 space-y-1.5">
                          {metadata.changes.map((change, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-2"
                            >
                              <div className="font-medium text-blue-900 mb-1">
                                {change.label}
                              </div>
                              <div className="flex items-center gap-2 text-gray-700">
                                <span className="text-gray-500">
                                  {change.old_formatted || change.old || '(empty)'}
                                </span>
                                <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                <span className="font-medium text-blue-900">
                                  {change.new_formatted || change.new || '(empty)'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {
                    console.error('Failed to parse metadata:', e);
                  }
                  return null;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
