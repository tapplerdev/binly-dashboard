'use client';

import { useState } from 'react';
import { Plus, Info, X, Loader2 } from 'lucide-react';
import { ShiftTaskCard } from './shift-task-card';
import { cancelShift } from '@/lib/api/shifts';
import { useQueryClient } from '@tanstack/react-query';

interface DriverColumnProps {
  driver: { id: string; name: string; email?: string };
  shift: {
    id: string;
    status: string;
    total_bins: number;
    completed_bins: number;
    optimization_metadata?: {
      total_distance_miles?: number;
      total_duration_formatted?: string;
    } | null;
  } | null;
  tasks: Array<any>;
  isToday: boolean;
  onCreateShift: () => void;
  onSelectShift: () => void;
  onEditShift: () => void;
  onReoptimize?: (shiftId: string) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':    return { label: 'Active',    cls: 'bg-green-100 text-green-700' };
    case 'paused':    return { label: 'Paused',    cls: 'bg-amber-100 text-amber-700' };
    case 'ready':     return { label: 'Ready',     cls: 'bg-blue-100 text-blue-700' };
    case 'ended':     return { label: 'Completed', cls: 'bg-gray-100 text-gray-600' };
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-red-100 text-red-700' };
    default:          return { label: status,       cls: 'bg-gray-100 text-gray-600' };
  }
}

export function DriverColumn({ driver, shift, tasks, isToday, onCreateShift, onSelectShift, onEditShift, onReoptimize }: DriverColumnProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const queryClient = useQueryClient();

  const taskCount = tasks.filter((t: any) => t.task_type !== 'warehouse_stop').length;
  const completedCount = tasks.filter((t: any) => t.is_completed === 1 && t.task_type !== 'warehouse_stop').length;
  const completionPct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  const hasShift = shift !== null && taskCount > 0;
  const statusBadge = hasShift ? getStatusBadge(shift!.status) : null;
  const currentTaskIndex = tasks.findIndex((t: any) => t.is_completed === 0 && !t.skipped);
  const initials = driver.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const canEdit = isToday && hasShift && (shift!.status === 'active' || shift!.status === 'ready');

  const handleCancelShift = async () => {
    if (!shift) return;
    setIsCancelling(true);
    try {
      await cancelShift(shift.id);
      queryClient.invalidateQueries({ queryKey: ['board-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
    } catch (e) {
      console.error('Failed to cancel shift:', e);
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <div className="flex flex-col w-full md:w-[380px] shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Column header — click opens drawer */}
      <div
        className="px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => hasShift ? onSelectShift() : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
            {initials}
          </div>
          <span className="font-semibold text-sm text-gray-800 flex-1">{driver.name}</span>
          {statusBadge && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          )}
          {!hasShift && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-dashed border-gray-300">
              No Shift
            </span>
          )}
          {hasShift && <Info className="w-4 h-4 text-gray-400" />}
        </div>

        {hasShift && (
          <div className="mt-1.5">
            <p className="text-xs text-gray-400">
              {taskCount} task{taskCount !== 1 ? 's' : ''}
              {shift!.optimization_metadata?.total_duration_formatted && ` · ${shift!.optimization_metadata.total_duration_formatted}`}
              {shift!.optimization_metadata?.total_distance_miles && ` · ${shift!.optimization_metadata.total_distance_miles.toFixed(1)} mi`}
            </p>
            {shift!.status === 'active' && (
              <div className="mt-1.5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{completedCount} of {taskCount} tasks</span>
                  <span>{completionPct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: '480px' }}>
        {hasShift ? (
          tasks.length > 0 ? (
            tasks.map((task: any, i: number) => (
              <ShiftTaskCard
                key={task.id || i}
                task={task}
                isCurrentTask={i === currentTaskIndex && shift!.status === 'active'}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              No tasks loaded
            </div>
          )
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateShift(); }}
            disabled={!isToday}
            className="flex flex-col items-center justify-center h-48 w-full rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-8 h-8 text-gray-300 mb-2" />
            <span className="text-sm text-gray-400 font-medium">Assign Shift</span>
          </button>
        )}
      </div>

      {/* Column footer */}
      {hasShift && canEdit && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onEditShift(); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(true); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Cancel Shift</h3>
              <button onClick={() => setShowCancelConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Cancel {driver.name}'s shift with {taskCount} task{taskCount !== 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelShift}
                disabled={isCancelling}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
