'use client';

import { Clock } from 'lucide-react';
import { RouteTask, getTaskLabel, getTaskSubtitle } from '@/lib/types/route-task';
import { ShiftEdit } from '@/lib/api/shifts';

/**
 * A shift's activity, newest first: the edit log from the backend (created,
 * tasks added and removed, driver reassigned — with who and why) merged with
 * the driver's progress (shift started, tasks completed or skipped).
 */

// Reason codes the backend writes, in words. Anything not listed is a
// manager's own text and is shown as typed.
const REASONS: Record<string, string> = {
  'assigned to shift': 'Move request assigned to this shift',
  move_request_cancelled: 'Move request cancelled',
  move_reassigned: 'Move request moved to another shift',
  move_reassigned_to_user: 'Move request reassigned to another driver',
  move_assignment_cleared: 'Move request unassigned',
  move_edited: 'Move request edited',
  superseded_by_manual_bin_edit: 'Bin edited by hand',
  potential_location_deleted: 'Potential location deleted',
  potential_location_converted_to_bin: 'Potential location became a bin',
  completed_before_reassign: 'Already done when the shift was reassigned',
  shift_ended_before_completion: 'Shift ended before it was finished',
  duplicate_dropoff_cleanup: 'Duplicate drop-off cleaned up',
};

// What the dashboard itself sends when the manager gave no reason. It says
// nothing the "by <name>" line does not, so it is not shown.
const BOILERPLATE = new Set(['Removed by manager']);

export function describeEditReason(reason?: string | null): string | undefined {
  if (!reason || BOILERPLATE.has(reason)) return undefined;
  return REASONS[reason] ?? reason;
}

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'teal' | 'amber';

const DOT: Record<Tone, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
};

interface Item {
  time: number; // unix seconds
  order: number; // insertion order, to keep same-second events in sequence
  label: string;
  subtitle?: string;
  detail?: string;
  tone: Tone;
}

function byLine(e: ShiftEdit): string {
  if (e.actor_name) return `by ${e.actor_name}`;
  return e.actor_id ? 'by a former user' : 'by the system';
}

// The event's own fields, for a task the dashboard no longer has a row for.
function fallbackLabel(e: ShiftEdit): string {
  const bin = e.bin_number ? `Bin #${e.bin_number}` : undefined;
  switch (e.task_type) {
    case 'collection':
      return bin ?? 'Collection';
    case 'pickup':
      return bin ? `Pickup ${bin}` : 'Pickup';
    case 'dropoff':
      return bin ? `Dropoff ${bin}` : 'Dropoff';
    case 'placement':
      if (e.move_request_id) return bin ? `Redeployment · ${bin}` : 'Redeployment';
      return 'Placement';
    case 'service':
      return 'Service stop';
    default:
      return 'Task';
  }
}

// Consecutive task events from one request — same kind, same second, same
// actor, same reason — collapse into one entry, so cancelling a move or
// clearing a reassigned shift's finished work reads as one change.
function groupBursts(edits: ShiftEdit[]): ShiftEdit[][] {
  const groups: ShiftEdit[][] = [];
  for (const e of edits) {
    const last = groups[groups.length - 1];
    const head = last?.[0];
    const burst =
      head &&
      (e.event_type === 'task_added' || e.event_type === 'task_removed') &&
      e.event_type === head.event_type &&
      e.created_at === head.created_at &&
      (e.actor_id ?? '') === (head.actor_id ?? '') &&
      (e.reason ?? '') === (head.reason ?? '');
    if (burst) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

export function buildTimeline(
  startedAt: number | null | undefined,
  tasks: RouteTask[],
  edits: ShiftEdit[],
): Item[] {
  const items: Item[] = [];
  const push = (item: Omit<Item, 'order'>) => items.push({ ...item, order: items.length });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const labelOf = (e: ShiftEdit) => {
    const t = e.task_id ? byId.get(e.task_id) : undefined;
    return t ? getTaskLabel(t) : fallbackLabel(e);
  };

  // The edit log: who changed the shift, and why.
  for (const group of groupBursts(edits)) {
    const e = group[0];
    const who = byLine(e);
    const why = describeEditReason(e.reason);
    switch (e.event_type) {
      case 'created':
        push({
          time: e.created_at,
          label: 'Shift created',
          subtitle: [e.bin_count != null ? `${e.bin_count} ${e.bin_count === 1 ? 'bin' : 'bins'}` : undefined, who]
            .filter(Boolean)
            .join(' · '),
          tone: 'indigo',
        });
        break;
      case 'driver_reassigned':
        push({
          time: e.created_at,
          label: `Reassigned from ${e.from_driver_name ?? 'a former driver'} to ${e.to_driver_name ?? 'a former driver'}`,
          subtitle: who,
          tone: 'amber',
        });
        break;
      case 'task_added':
      case 'task_removed': {
        const verb = e.event_type === 'task_added' ? 'Added' : 'Removed';
        const single = group.length === 1;
        const shown = group.slice(0, 4).map(labelOf);
        const more = group.length - shown.length;
        push({
          time: e.created_at,
          label: single ? `${verb} ${labelOf(e)}` : `${verb} ${group.length} tasks`,
          subtitle: [who, why].filter(Boolean).join(' · '),
          detail: single ? undefined : shown.join(', ') + (more > 0 ? `, and ${more} more` : ''),
          tone: e.event_type === 'task_added' ? 'teal' : 'red',
        });
        break;
      }
    }
  }

  // Removals from before the edit log existed, read from the task rows —
  // unless the log already has them. Left out, as the log leaves them out:
  // warehouse stops and re-optimization churn (every reroute retires and
  // re-inserts each task), which are mechanics, not edits.
  const logged = new Set(edits.filter((e) => e.event_type === 'task_removed').map((e) => e.task_id));
  for (const t of tasks) {
    if (!t.is_deleted || !t.deleted_at || logged.has(t.id)) continue;
    if (t.task_type === 'warehouse_stop' || t.deletion_reason === 'shift_reoptimized') continue;
    push({
      time: t.deleted_at,
      label: `Removed ${getTaskLabel(t)}`,
      subtitle: describeEditReason(t.deletion_reason) ?? 'Removed by a manager',
      tone: 'red',
    });
  }

  // The driver's progress.
  if (startedAt) push({ time: startedAt, label: 'Shift started', tone: 'blue' });
  for (const t of tasks) {
    if (t.is_completed !== 1 || !t.completed_at) continue;
    push({
      time: t.completed_at,
      label: `${t.skipped ? 'Skipped' : 'Completed'} ${getTaskLabel(t)}`,
      subtitle: getTaskSubtitle(t),
      tone: t.skipped ? 'orange' : 'green',
    });
  }

  // Newest first; within one second, the later event first.
  return items.sort((a, b) => b.time - a.time || b.order - a.order);
}

interface ShiftActivityTimelineProps {
  /** Unix seconds; absent until the driver starts. */
  startedAt?: number | null;
  /** Every task on the shift, removed ones included. */
  tasks: RouteTask[];
  edits: ShiftEdit[];
  loading: boolean;
}

export function ShiftActivityTimeline({ startedAt, tasks, edits, loading }: ShiftActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const items = buildTimeline(startedAt, tasks, edits);
  if (items.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-4 pl-8">
        {items.map((item) => (
          <div key={item.order} className="relative">
            <div className={`absolute -left-8 w-4 h-4 rounded-full border-2 border-white ${DOT[item.tone]}`} />
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{item.label}</p>
                  {item.subtitle && <p className="text-sm text-gray-500 mt-0.5">{item.subtitle}</p>}
                  {item.detail && <p className="text-xs text-gray-400 mt-1">{item.detail}</p>}
                </div>
                <p className="flex-shrink-0 text-xs text-gray-500">
                  {new Date(item.time * 1000).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
