'use client';

import { useState } from 'react';
import { useShiftHistoryTasks } from '@/lib/hooks/use-shift-history-tasks';
import { ShiftHistoryEntry } from '@/lib/api/shifts';
import { ShiftHistoryTask } from '@/lib/api/shifts';
import {
  X, Package, MapPin, ArrowRightLeft, Warehouse, SkipForward,
  CheckCircle2, XCircle, Clock, ChevronRight, Hash, Loader2,
  AlertTriangle, MoveRight, ArrowRight, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';

type FilterType = 'all' | 'collections' | 'placements' | 'moves' | 'timeline' | 'removed';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getSkipReason(taskData: string | null): string | null {
  if (!taskData) return null;
  try {
    const parsed = JSON.parse(taskData);
    return parsed.skip_reason ?? parsed.reason ?? null;
  } catch {
    return null;
  }
}

// ── Task type config ────────────────────────────────────────────────────────

const TASK_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; borderColor: string }> = {
  collection:    { label: 'Collection',    icon: Package,        color: 'text-blue-600',   borderColor: 'border-l-blue-500' },
  placement:     { label: 'Placement',     icon: MapPin,         color: 'text-orange-500', borderColor: 'border-l-orange-500' },
  pickup:        { label: 'Move Pickup',   icon: ArrowRightLeft, color: 'text-purple-600', borderColor: 'border-l-purple-500' },
  dropoff:       { label: 'Move Dropoff',  icon: MoveRight,      color: 'text-violet-600', borderColor: 'border-l-violet-500' },
  warehouse_stop:{ label: 'Warehouse',     icon: Warehouse,      color: 'text-teal-600',   borderColor: 'border-l-teal-500' },
};

// ── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({ task, index }: { task: ShiftHistoryTask; index: number }) {
  const cfg = TASK_CONFIG[task.task_type] ?? TASK_CONFIG.collection;
  const Icon = cfg.icon;
  const completed = task.is_completed === 1 && !task.skipped;
  const skipped = task.skipped;
  const skipReason = getSkipReason(task.task_data);

  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 ${cfg.borderColor} bg-white overflow-hidden hover:shadow-sm transition-shadow`}>
      {/* Header row */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100`}>
        <span className="text-xs font-bold text-gray-400 w-6">{index + 1}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <span className={`text-sm font-semibold text-gray-900 flex-1`}>{cfg.label}</span>
        {/* Status - show WHO did it */}
        {skipped ? (
          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
              <SkipForward className="w-3 h-3" /> Skipped by driver
            </div>
            {task.completed_at && (
              <div className="text-xs text-gray-400 mt-1">{formatTime(task.completed_at)}</div>
            )}
          </div>
        ) : completed ? (
          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              <CheckCircle2 className="w-3 h-3" /> Completed by driver
            </div>
            {task.completed_at && (
              <div className="text-xs text-gray-400 mt-1">{formatTime(task.completed_at)}</div>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            <XCircle className="w-3 h-3" /> Incomplete
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white space-y-2 text-xs text-gray-600">
        {/* ── Collection ─────────────────────────────────── */}
        {task.task_type === 'collection' && (
          <>
            <Row label="Bin #" value={task.bin_number != null ? `#${task.bin_number}` : '—'} />
            <Row label="Address" value={task.bin_street ? `${task.bin_street}${task.bin_city ? ', ' + task.bin_city : ''}` : (task.address ?? '—')} />
            {task.updated_fill_percentage != null && (
              <Row label="Fill recorded" value={`${task.updated_fill_percentage}%`} />
            )}
          </>
        )}

        {/* ── Placement ──────────────────────────────────── */}
        {task.task_type === 'placement' && (
          <>
            <Row label="Location" value={task.placement_address ?? task.address ?? '—'} />
            {task.placement_created_bin_number != null ? (
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-gray-400 font-medium">Converted to</span>
                <span className="flex items-center gap-1 font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <Hash className="w-3 h-3" /> Bin #{task.placement_created_bin_number}
                </span>
              </div>
            ) : task.new_bin_number != null && !skipped ? (
              <Row label="Intended bin #" value={`#${task.new_bin_number} (conversion may have failed)`} />
            ) : null}
          </>
        )}

        {/* ── Move Pickup / Dropoff ───────────────────────── */}
        {(task.task_type === 'pickup' || task.task_type === 'dropoff') && (
          <>
            <Row label="Bin #" value={task.bin_number != null ? `#${task.bin_number}` : '—'} />
            {task.task_type === 'pickup' && (
              <Row label="Pickup address" value={task.address ?? '—'} />
            )}
            {task.task_type === 'dropoff' && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 font-medium">Route</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-700 truncate max-w-[140px]">{task.address ?? '—'}</span>
                  <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate max-w-[140px]">{task.destination_address ?? '—'}</span>
                </div>
              </div>
            )}
            {task.move_type && (
              <Row label="Move type" value={task.move_type} />
            )}
          </>
        )}

        {/* ── Warehouse ───────────────────────────────────── */}
        {task.task_type === 'warehouse_stop' && (
          <>
            <Row label="Action" value={task.warehouse_action ?? '—'} />
            {task.bins_to_load != null && (
              <Row label="Bins to load" value={String(task.bins_to_load)} />
            )}
          </>
        )}

        {/* Skip reason */}
        {skipped && skipReason && (
          <div className="flex items-start gap-1.5 pt-1 text-amber-700">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span><span className="font-medium">Skip reason:</span> {skipReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 font-medium w-24 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}

// ── Timeline View ──────────────────────────────────────────────────────────

function TimelineView({ shift, tasks }: { shift: ShiftHistoryEntry; tasks: ShiftHistoryTask[] }) {
  // Create timeline events
  const events = [];

  // Add shift start event
  if (shift.start_time) {
    events.push({
      type: 'shift_start',
      time: shift.start_time,
      label: 'Shift started',
      color: 'blue'
    });
  }

  // Add task completion/skip events
  tasks.forEach(task => {
    if (task.is_completed === 1 && task.completed_at) {
      const taskLabel = task.task_type === 'collection' ? `Bin #${task.bin_number}` :
                        task.task_type === 'placement' ? `Placement at ${task.address?.substring(0, 30)}` :
                        task.task_type === 'pickup' ? `Pickup Bin #${task.bin_number}` :
                        task.task_type === 'dropoff' ? `Dropoff Bin #${task.bin_number}` :
                        'Warehouse stop';

      events.push({
        type: task.skipped ? 'task_skipped' : 'task_completed',
        time: task.completed_at,
        label: task.skipped ? `Driver skipped ${taskLabel}` : `Driver completed ${taskLabel}`,
        subtitle: task.skipped ? getSkipReason(task.task_data) : task.address,
        color: task.skipped ? 'orange' : 'green'
      });
    }

    // Add task removal events
    if (task.is_deleted && task.deleted_at) {
      const taskLabel = task.task_type === 'collection' ? `Bin #${task.bin_number}` :
                        task.task_type === 'placement' ? `Placement` :
                        `Move`;

      events.push({
        type: 'task_removed',
        time: task.deleted_at,
        label: `Manager removed ${taskLabel}`,
        subtitle: task.deletion_reason || 'Removed by manager',
        color: 'red'
      });
    }
  });

  // Add shift end event with completion stats
  if (shift.end_time) {
    const endReasonLabel = END_REASON_LABEL[shift.end_reason]?.label || shift.end_reason;

    // Calculate completion stats
    const activeTasks = tasks.filter(t => !t.is_deleted);
    const completedTasks = activeTasks.filter(t => t.is_completed === 1 && !t.skipped).length;
    const skippedTasks = activeTasks.filter(t => t.skipped).length;
    const totalTasks = activeTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    events.push({
      type: 'shift_end',
      time: shift.end_time,
      label: `Shift ended (${endReasonLabel})`,
      color: 'gray',
      stats: {
        completed: completedTasks,
        skipped: skippedTasks,
        total: totalTasks,
        completionRate: completionRate
      }
    });
  }

  // Sort by time (most recent first)
  events.sort((a, b) => b.time - a.time);

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  };

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-gray-200" />

      {events.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No activity recorded</p>
        </div>
      ) : (
        <div className="space-y-6 pl-14">
          {events.map((event, index) => {
            const eventTime = new Date(event.time * 1000);
            const formattedTime = eventTime.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

            return (
              <div key={index} className="relative">
                {/* Timeline Dot */}
                <div className={`absolute -left-[40px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${colorClasses[event.color as keyof typeof colorClasses]}`} />

                {/* Event Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{event.label}</p>
                      {event.subtitle && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.subtitle}</p>
                      )}

                      {/* Show completion stats for shift_end event */}
                      {event.type === 'shift_end' && (event as any).stats && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <div className="text-2xl font-bold text-gray-900">
                                {(event as any).stats.completionRate}%
                              </div>
                              <span className="text-xs text-gray-500">completed</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {(event as any).stats.completed}/{(event as any).stats.total} tasks
                              {(event as any).stats.skipped > 0 && (
                                <span className="text-gray-500"> · {(event as any).stats.skipped} skipped</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <p className="text-xs text-gray-500 whitespace-nowrap">{formattedTime}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Removed Tasks View ─────────────────────────────────────────────────────

function RemovedTasksView({ deletedTasks }: { deletedTasks: ShiftHistoryTask[] }) {
  if (deletedTasks.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
        <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No tasks were removed from this shift</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deletedTasks
        .sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0))
        .map((task, index) => {
          const cfg = TASK_CONFIG[task.task_type] ?? TASK_CONFIG.collection;
          const Icon = cfg.icon;
          const deletedTime = task.deleted_at
            ? new Date(task.deleted_at * 1000).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })
            : null;

          const taskLabel = task.task_type === 'collection' ? `Bin #${task.bin_number}` :
                           task.task_type === 'placement' ? 'Placement' :
                           task.task_type === 'pickup' ? `Move Pickup Bin #${task.bin_number}` :
                           task.task_type === 'dropoff' ? `Move Dropoff Bin #${task.bin_number}` :
                           'Warehouse Stop';

          return (
            <div
              key={task.id}
              className={`rounded-lg border border-gray-200 border-l-4 ${cfg.borderColor} bg-gray-50 overflow-hidden`}
            >
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 line-through">
                      {taskLabel}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {task.address}
                    </p>
                    {deletedTime && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                        <Trash2 className="w-3 h-3" />
                        <span>Removed by manager {deletedTime}</span>
                      </div>
                    )}
                    {task.deletion_reason && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "{task.deletion_reason}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────

interface Props {
  shift: ShiftHistoryEntry;
  onClose: () => void;
}

const END_REASON_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  completed:           { label: 'Completed',    color: 'text-green-700',  bg: 'bg-green-100' },
  manual_end:          { label: 'Driver Ended', color: 'text-blue-700',   bg: 'bg-blue-100' },
  manager_ended:       { label: 'Mgr Ended',    color: 'text-amber-700',  bg: 'bg-amber-100' },
  manager_cancelled:   { label: 'Cancelled',    color: 'text-red-700',    bg: 'bg-red-100' },
  driver_disconnected: { label: 'Disconnected', color: 'text-orange-700', bg: 'bg-orange-100' },
  system_timeout:      { label: 'Timed Out',    color: 'text-gray-700',   bg: 'bg-gray-100' },
};

export function ShiftHistoryDetailDrawer({ shift, onClose }: Props) {
  const { data: tasks, isLoading } = useShiftHistoryTasks(shift.id);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showRemovedExpanded, setShowRemovedExpanded] = useState(false);
  const reason = END_REASON_LABEL[shift.end_reason] ?? { label: shift.end_reason, color: 'text-gray-700', bg: 'bg-gray-100' };

  // Separate active and deleted tasks
  const activeTasks = tasks?.filter(t => !t.is_deleted) ?? [];
  const deletedTasks = tasks?.filter(t => t.is_deleted) ?? [];

  // Group tasks for summary and filtering
  const collections  = activeTasks.filter(t => t.task_type === 'collection');
  const placements   = activeTasks.filter(t => t.task_type === 'placement');
  const pickups      = activeTasks.filter(t => t.task_type === 'pickup');
  const dropoffs     = activeTasks.filter(t => t.task_type === 'dropoff');
  const moves        = [...pickups, ...dropoffs].sort((a, b) => a.sequence_order - b.sequence_order);
  const warehouses   = activeTasks.filter(t => t.task_type === 'warehouse_stop');

  // Get filtered tasks based on active filter
  const getFilteredTasks = () => {
    switch (activeFilter) {
      case 'collections': return collections;
      case 'placements': return placements;
      case 'moves': return moves;
      case 'timeline': return [];  // Timeline is a special view
      case 'removed': return deletedTasks;
      case 'all':
      default: return activeTasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  return (
    <>
      {/* Backdrop with fade animation */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer with slide animation */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-base">{shift.driver_name || 'Unknown Driver'}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${reason.bg} ${reason.color}`}>
                {reason.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(shift.ended_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(shift.start_time! * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' → '}
              {new Date(shift.end_time! * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 flex-wrap px-5 py-3 border-b border-gray-100 shrink-0 bg-gray-50">
          <Pill label="Completion" value={`${Math.round(shift.completion_rate)}%`} color="text-gray-900" />
          <Pill label="Collections" value={String(shift.collections_completed)} color="text-blue-600" />
          {shift.placements_completed > 0 && <Pill label="Placements" value={String(shift.placements_completed)} color="text-orange-500" />}
          {shift.move_requests_completed > 0 && <Pill label="Moves" value={String(shift.move_requests_completed)} color="text-purple-600" />}
          {shift.total_skipped > 0 && <Pill label="Skipped" value={String(shift.total_skipped)} color="text-gray-500" />}
          {shift.incidents_reported > 0 && <Pill label="Incidents" value={String(shift.incidents_reported)} color="text-red-500" />}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 shrink-0">
          <div className="flex gap-1 px-5 overflow-x-auto scrollbar-hide">
            <TabButton
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
              count={activeTasks.length}
            >
              All
            </TabButton>
            <TabButton
              active={activeFilter === 'collections'}
              onClick={() => setActiveFilter('collections')}
              count={collections.length}
            >
              Collections
            </TabButton>
            {placements.length > 0 && (
              <TabButton
                active={activeFilter === 'placements'}
                onClick={() => setActiveFilter('placements')}
                count={placements.length}
              >
                Placements
              </TabButton>
            )}
            {moves.length > 0 && (
              <TabButton
                active={activeFilter === 'moves'}
                onClick={() => setActiveFilter('moves')}
                count={moves.length}
              >
                Move Requests
              </TabButton>
            )}
            <TabButton
              active={activeFilter === 'timeline'}
              onClick={() => setActiveFilter('timeline')}
            >
              Timeline
            </TabButton>
            {deletedTasks.length > 0 && (
              <TabButton
                active={activeFilter === 'removed'}
                onClick={() => setActiveFilter('removed')}
                count={deletedTasks.length}
              >
                Removed
              </TabButton>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading tasks...
            </div>
          ) : activeFilter === 'timeline' ? (
            <TimelineView shift={shift} tasks={tasks ?? []} />
          ) : activeFilter === 'removed' ? (
            <RemovedTasksView deletedTasks={deletedTasks} />
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <Package className="w-10 h-10 text-gray-200" />
              <p className="text-sm">No tasks in this category</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks
                .sort((a, b) => a.sequence_order - b.sequence_order)
                .map((task, i) => (
                  <TaskCard key={task.id} task={task} index={i} />
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`ml-1.5 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}
