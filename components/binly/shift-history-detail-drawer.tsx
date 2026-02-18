'use client';

import { useShiftHistoryTasks } from '@/lib/hooks/use-shift-history-tasks';
import { ShiftHistoryEntry } from '@/lib/api/shifts';
import { ShiftHistoryTask } from '@/lib/api/shifts';
import {
  X, Package, MapPin, ArrowRightLeft, Warehouse, SkipForward,
  CheckCircle2, XCircle, Clock, ChevronRight, Hash, Loader2,
  AlertTriangle, MoveRight, ArrowRight,
} from 'lucide-react';

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

const TASK_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  collection:    { label: 'Collection',    icon: Package,        color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  placement:     { label: 'Placement',     icon: MapPin,         color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  pickup:        { label: 'Move Pickup',   icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  dropoff:       { label: 'Move Dropoff',  icon: MoveRight,      color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  warehouse_stop:{ label: 'Warehouse',     icon: Warehouse,      color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200' },
};

// ── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({ task, index }: { task: ShiftHistoryTask; index: number }) {
  const cfg = TASK_CONFIG[task.task_type] ?? TASK_CONFIG.collection;
  const Icon = cfg.icon;
  const completed = task.is_completed === 1 && !task.skipped;
  const skipped = task.skipped;
  const skipReason = getSkipReason(task.task_data);

  return (
    <div className={`rounded-xl border ${cfg.border} ${skipped ? 'opacity-60' : ''} overflow-hidden`}>
      {/* Header row */}
      <div className={`flex items-center gap-3 px-4 py-3 ${cfg.bg}`}>
        <span className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-white border ${cfg.border}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <span className={`text-sm font-semibold ${cfg.color} flex-1`}>{cfg.label}</span>
        {/* Status badge */}
        {skipped ? (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            <SkipForward className="w-3 h-3" /> Skipped
          </span>
        ) : completed ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Incomplete
          </span>
        )}
        {task.completed_at && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />{formatTime(task.completed_at)}
          </span>
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
  const reason = END_REASON_LABEL[shift.end_reason] ?? { label: shift.end_reason, color: 'text-gray-700', bg: 'bg-gray-100' };

  // Group tasks for summary
  const collections  = tasks?.filter(t => t.task_type === 'collection') ?? [];
  const placements   = tasks?.filter(t => t.task_type === 'placement') ?? [];
  const pickups      = tasks?.filter(t => t.task_type === 'pickup') ?? [];
  const dropoffs     = tasks?.filter(t => t.task_type === 'dropoff') ?? [];
  const warehouses   = tasks?.filter(t => t.task_type === 'warehouse_stop') ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
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

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading tasks...
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <Package className="w-10 h-10 text-gray-200" />
              <p className="text-sm">No task records found for this shift</p>
              <p className="text-xs text-gray-300">Tasks may have been removed when this shift ended</p>
            </div>
          ) : (
            <>
              {/* Section headers when multiple types */}
              {collections.length > 0 && renderSection('Collections', collections)}
              {placements.length > 0 && renderSection('Placements', placements)}
              {(pickups.length > 0 || dropoffs.length > 0) && renderSection('Move Requests', [...pickups, ...dropoffs].sort((a, b) => a.sequence_order - b.sequence_order))}
              {warehouses.length > 0 && renderSection('Warehouse Stops', warehouses)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function renderSection(title: string, tasks: ShiftHistoryTask[]) {
  return (
    <div key={title}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <TaskCard key={task.id} task={task} index={i} />
        ))}
      </div>
    </div>
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
