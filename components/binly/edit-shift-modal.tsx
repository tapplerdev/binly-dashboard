'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Check, SkipForward, Circle, Navigation, MapPin, Package, ArrowRightLeft, Warehouse, Wrench, Loader2, ChevronDown, Trash2, ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getShiftTasks, removeTasksFromShift, addTasksToShift, createShiftWithTasks, cancelShift } from '@/lib/api/shifts';
import { BinSelectionMap } from './bin-selection-map';
import { MoveRequestSelectionMap } from './move-request-selection-map';
import { PlacementLocationSelectionMap } from './placement-location-selection-map';
import { useBins } from '@/lib/hooks/use-bins';
import { usePotentialLocations } from '@/lib/hooks/use-potential-locations';
import { MoveRequest, getMoveRequests } from '@/lib/api/move-requests';
import { useModalClose } from '@/components/binly/modal-wrapper';

interface EditShiftModalProps {
  shift: {
    id: string;
    driver_id: string;
    driver_name: string;
    status: string;
    truck_bin_capacity?: number;
  };
  onClose: () => void;
  drivers: Array<{ id: string; name: string }>;
  shiftsForDate: Array<any>;
}

interface StagedMove {
  targetDriverId: string;
  targetDriverName: string;
  targetShiftId: string | null;
  targetShiftStatus: string | null;
  taskIds: string[];
  tasks: any[];
  additionalTasks: any[]; // extra tasks to add to target
}

interface StagedReassign {
  targetDriverId: string;
  targetDriverName: string;
  targetShiftId: string | null;
  targetShiftTasks: any[];
  mode: 'direct' | 'merge' | 'replace'; // direct = no existing shift, merge = add to existing, replace = cancel existing
}

const TASK_ICONS: Record<string, { icon: typeof MapPin; color: string; bg: string; label: string }> = {
  collection:     { icon: MapPin,         color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Collection' },
  placement:      { icon: Package,        color: 'text-orange-600', bg: 'bg-orange-50', label: 'Placement' },
  pickup:         { icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Pick Up' },
  dropoff:        { icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Drop Off' },
  warehouse_stop: { icon: Warehouse,      color: 'text-gray-600',   bg: 'bg-gray-100',  label: 'Warehouse' },
  service:        { icon: Wrench,         color: 'text-green-600',  bg: 'bg-green-50',  label: 'Service' },
};

function getTaskLabel(task: any): string {
  if (task.task_type === 'warehouse_stop') return 'Warehouse';
  if (task.task_type === 'service') return task.task_label || 'Service Stop';
  if (task.task_type === 'placement') return 'Placement';
  if (task.task_type === 'pickup') return task.bin_number ? `Pick Up — Bin #${task.bin_number}` : 'Pick Up';
  if (task.task_type === 'dropoff') return task.bin_number ? `Drop Off — Bin #${task.bin_number}` : 'Drop Off';
  if (task.bin_number) return `Bin #${task.bin_number}`;
  return task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1);
}

function getTaskSubtext(task: any): string | null {
  if (task.task_type === 'pickup') {
    const from = task.address || '';
    const to = task.destination_address || '';
    if (from && to && from !== to) return `${from} → ${to}`;
    if (from) return `From: ${from}`;
    return null;
  }
  if (task.task_type === 'dropoff') return task.destination_address || task.address || null;
  if (task.address) return task.address;
  return null;
}

function getMoveRequestTag(task: any, allTasks: any[]): string | null {
  if (!task.move_request_id || (task.task_type !== 'pickup' && task.task_type !== 'dropoff')) return null;
  const pair = allTasks.find((t: any) => t.move_request_id === task.move_request_id && t.id !== task.id);
  if (!pair) return null;
  return `Move #${task.move_request_id.slice(0, 6)}`;
}

function TaskRow({ task, isSelected, isSelectable, isInProgress, isDone, isSkipped, isPendingRemove, isPendingMove, onToggle, allTasks }: {
  task: any; isSelected: boolean; isSelectable: boolean; isInProgress: boolean; isDone: boolean; isSkipped: boolean; isPendingRemove: boolean; isPendingMove: boolean; onToggle: () => void; allTasks?: any[];
}) {
  const iconConfig = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
  const Icon = iconConfig.icon;
  const subtext = getTaskSubtext(task);
  const moveTag = allTasks ? getMoveRequestTag(task, allTasks) : null;
  const dimmed = isPendingRemove || isPendingMove;
  return (
    <div
      onClick={() => isSelectable && !dimmed && onToggle()}
      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
        isPendingRemove ? 'opacity-40 bg-red-50 border-l-4 border-red-400' :
        isPendingMove ? 'opacity-40 bg-amber-50 border-l-4 border-amber-400' :
        isSelected ? 'bg-blue-50 border-l-4 border-blue-500 ring-1 ring-blue-200 cursor-pointer' :
        isSkipped ? 'bg-yellow-50 border-l-4 border-yellow-500 opacity-75' :
        isDone ? 'bg-green-50 border-l-4 border-green-500 opacity-75' :
        isInProgress ? 'bg-blue-50 border-l-4 border-blue-600 ring-1 ring-blue-100' :
        'bg-white border-l-4 border-gray-300 hover:bg-gray-50 cursor-pointer'
      }`}
    >
      {isSelectable && !dimmed && (
        <input type="checkbox" checked={isSelected} onChange={onToggle} onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0" />
      )}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${iconConfig.color}`} />
      </div>
      {/* Status icon */}
      <div className="shrink-0">
        {isPendingRemove ? (
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><Trash2 className="w-3 h-3 text-white" /></div>
        ) : isPendingMove ? (
          <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center"><ArrowRight className="w-3 h-3 text-white" /></div>
        ) : isSkipped ? (
          <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center"><SkipForward className="w-3 h-3 text-white" /></div>
        ) : isDone ? (
          <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
        ) : isInProgress ? (
          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center animate-pulse"><Navigation className="w-3 h-3 text-white" /></div>
        ) : (
          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center"><Circle className="w-2.5 h-2.5 text-gray-400" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium truncate ${dimmed || isDone || isSkipped ? 'text-gray-500' : 'text-gray-800'}`}>
            {getTaskLabel(task)}
          </span>
          {moveTag && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium shrink-0">{moveTag}</span>}
        </div>
        {subtext && <div className={`text-[11px] truncate ${isDone || isSkipped ? 'text-gray-400' : 'text-gray-500'}`}>{subtext}</div>}
      </div>
    </div>
  );
}

export function EditShiftModal({ shift, onClose, drivers, shiftsForDate }: EditShiftModalProps) {
  const { isClosing, handleClose } = useModalClose(onClose);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [showBinPicker, setShowBinPicker] = useState(false);
  const [showMoveRequestPicker, setShowMoveRequestPicker] = useState(false);
  const [showPlacementPicker, setShowPlacementPicker] = useState(false);
  const [showTargetBinPicker, setShowTargetBinPicker] = useState(false);
  const [showTargetMoveRequestPicker, setShowTargetMoveRequestPicker] = useState(false);
  const [showTargetPlacementPicker, setShowTargetPlacementPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staged changes (local only — no API calls until submit)
  const [pendingAdds, setPendingAdds] = useState<any[]>([]);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set());
  const [stagedMove, setStagedMove] = useState<StagedMove | null>(null);
  const [targetDriverTasks, setTargetDriverTasks] = useState<any[]>([]);
  const [loadingTargetTasks, setLoadingTargetTasks] = useState(false);

  // Reassign entire shift
  const [stagedReassign, setStagedReassign] = useState<StagedReassign | null>(null);
  const [showReassignChoice, setShowReassignChoice] = useState<{ driverId: string; driverName: string; shiftId: string; tasks: any[] } | null>(null);

  // Summary / submit
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const { data: allBins = [] } = useBins();
  const { data: potentialLocations = [] } = usePotentialLocations('active');
  const { data: moveRequests = [] } = useQuery<MoveRequest[]>({
    queryKey: ['move-requests', 'pending-unassigned'],
    queryFn: () => getMoveRequests({ status: 'pending', assigned: 'unassigned' }),
    staleTime: 30_000,
  });

  const assignedBinIds = new Set<string>();
  for (const t of tasks) { if (t.bin_id) assignedBinIds.add(t.bin_id); }
  for (const t of pendingAdds) { if (t.bin_id) assignedBinIds.add(t.bin_id); }

  const targetAssignedBinIds = new Set<string>();
  for (const t of targetDriverTasks) { if (t.bin_id) targetAssignedBinIds.add(t.bin_id); }
  if (stagedMove) { for (const t of stagedMove.tasks) { if (t.bin_id) targetAssignedBinIds.add(t.bin_id); } }
  if (stagedMove) { for (const t of stagedMove.additionalTasks) { if (t.bin_id) targetAssignedBinIds.add(t.bin_id); } }

  const loadTasks = useCallback(async () => {
    try {
      const data = await getShiftTasks(shift.id);
      const filtered = (data || []).filter((t: any) => !t.is_deleted && t.task_type !== 'warehouse_stop');
      setTasks(filtered.sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)));
    } catch { setError('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [shift.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const invalidateBoard = () => {
    queryClient.invalidateQueries({ queryKey: ['board-shifts'] });
    queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
  };

  const firstIncompleteIdx = tasks.findIndex((t: any) => t.is_completed === 0 && !t.skipped);
  const hasChanges = pendingAdds.length > 0 || pendingRemoveIds.size > 0 || stagedMove !== null || stagedReassign !== null;

  // Toggle task selection
  const toggleTask = (taskId: string) => {
    const next = new Set(selectedIds);
    const task = tasks.find((t: any) => t.id === taskId);
    if (task && (task.task_type === 'pickup' || task.task_type === 'dropoff') && task.move_request_id) {
      const pair = tasks.find((t: any) => t.move_request_id === task.move_request_id && t.id !== taskId);
      if (pair) {
        if (next.has(taskId)) { next.delete(taskId); next.delete(pair.id); }
        else { next.add(taskId); next.add(pair.id); }
        setSelectedIds(next);
        return;
      }
    }
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setSelectedIds(next);
  };

  const selectAllIncomplete = () => {
    setSelectedIds(new Set(tasks.filter((t: any) => t.is_completed === 0 && !t.skipped && !pendingRemoveIds.has(t.id)).map((t: any) => t.id)));
  };

  // Stage removal (local only)
  const stageRemove = () => {
    const next = new Set(pendingRemoveIds);
    selectedIds.forEach(id => next.add(id));
    setPendingRemoveIds(next);
    setSelectedIds(new Set());
  };

  // Stage move to another driver (local only)
  const stageMoveTo = async (targetDriverId: string) => {
    const targetDriver = drivers.find(d => d.id === targetDriverId);
    const targetShift = shiftsForDate.find((s: any) => s.driver_id === targetDriverId);
    const selectedTasks = tasks.filter((t: any) => selectedIds.has(t.id));

    setStagedMove({
      targetDriverId,
      targetDriverName: targetDriver?.name || 'Unknown',
      targetShiftId: targetShift?.id || null,
      targetShiftStatus: targetShift?.status || null,
      taskIds: Array.from(selectedIds),
      tasks: selectedTasks,
      additionalTasks: [],
    });
    setShowMoveDropdown(false);
    setSelectedIds(new Set());

    // Load target driver's tasks for preview
    if (targetShift) {
      setLoadingTargetTasks(true);
      try {
        const data = await getShiftTasks(targetShift.id);
        setTargetDriverTasks((data || []).filter((t: any) => !t.is_deleted && t.task_type !== 'warehouse_stop'));
      } catch { setTargetDriverTasks([]); }
      finally { setLoadingTargetTasks(false); }
    } else {
      setTargetDriverTasks([]);
    }
  };

  // Add tasks to source shift (staged locally)
  const handleAddBins = (newBinIds: string[]) => {
    setShowBinPicker(false);
    const newTasks = newBinIds.map(id => {
      const bin = allBins.find(b => b.id === id);
      return { task_type: 'collection', bin_id: id, bin_number: bin?.bin_number, address: bin ? `${bin.current_street}, ${bin.city}` : '' };
    });
    setPendingAdds(prev => [...prev, ...newTasks]);
  };

  const handleAddPlacements = (locationIds: string[]) => {
    setShowPlacementPicker(false);
    const newTasks = locationIds.map(id => {
      const loc = potentialLocations.find(l => l.id === id);
      return { task_type: 'placement', potential_location_id: id, address: loc?.address || loc?.street || '' };
    });
    setPendingAdds(prev => [...prev, ...newTasks]);
  };

  const handleAddMoveRequests = (ids: string[]) => {
    setShowMoveRequestPicker(false);
    const newTasks: any[] = [];
    ids.forEach(id => {
      const mr = moveRequests.find(r => r.id === id);
      newTasks.push({ task_type: 'pickup', move_request_id: id, bin_number: mr?.bin_number, address: mr?.original_address || '' });
      newTasks.push({ task_type: 'dropoff', move_request_id: id, bin_number: mr?.bin_number, address: mr?.new_address || '' });
    });
    setPendingAdds(prev => [...prev, ...newTasks]);
  };

  // Add tasks to target driver (staged in move)
  const handleAddBinsToTarget = (newBinIds: string[]) => {
    setShowTargetBinPicker(false);
    const newTasks = newBinIds.map(id => {
      const bin = allBins.find(b => b.id === id);
      return { task_type: 'collection', bin_id: id, bin_number: bin?.bin_number, address: bin ? `${bin.current_street}, ${bin.city}` : '' };
    });
    setStagedMove(prev => prev ? { ...prev, additionalTasks: [...prev.additionalTasks, ...newTasks] } : null);
  };

  const handleAddPlacementsToTarget = (locationIds: string[]) => {
    setShowTargetPlacementPicker(false);
    const newTasks = locationIds.map(id => {
      const loc = potentialLocations.find(l => l.id === id);
      return { task_type: 'placement', potential_location_id: id, address: loc?.address || loc?.street || '' };
    });
    setStagedMove(prev => prev ? { ...prev, additionalTasks: [...prev.additionalTasks, ...newTasks] } : null);
  };

  const handleAddMoveRequestsToTarget = (ids: string[]) => {
    setShowTargetMoveRequestPicker(false);
    const newTasks: any[] = [];
    ids.forEach(id => {
      const mr = moveRequests.find(r => r.id === id);
      newTasks.push({ task_type: 'pickup', move_request_id: id, bin_number: mr?.bin_number, address: mr?.original_address || '' });
      newTasks.push({ task_type: 'dropoff', move_request_id: id, bin_number: mr?.bin_number, address: mr?.new_address || '' });
    });
    setStagedMove(prev => prev ? { ...prev, additionalTasks: [...prev.additionalTasks, ...newTasks] } : null);
  };

  // Handle reassign click — check if target has shift, show options or stage directly
  const handleReassignClick = async (targetDriverId: string) => {
    // Block reassignment if no real tasks remain (only warehouse stops)
    const realIncompleteTasks = tasks.filter(t => t.is_completed === 0 && !t.skipped && t.task_type !== 'warehouse_stop');
    if (realIncompleteTasks.length === 0) {
      setError('No tasks to reassign — all tasks are completed or only a warehouse stop remains.');
      return;
    }

    const targetDriver = drivers.find(d => d.id === targetDriverId);
    const targetShift = shiftsForDate.find((s: any) => s.driver_id === targetDriverId && s.status !== 'ended' && s.status !== 'cancelled');
    const targetDriverName = targetDriver?.name || 'Unknown';

    if (!targetShift) {
      // No existing shift — stage as direct reassign, go straight to summary
      setStagedReassign({ targetDriverId, targetDriverName, targetShiftId: null, targetShiftTasks: [], mode: 'direct' });
      setShowSummary(true);
      return;
    }

    // Target has an existing shift — load their tasks and show merge/replace choice
    try {
      const data = await getShiftTasks(targetShift.id);
      const filtered = (data || []).filter((t: any) => !t.is_deleted && t.task_type !== 'warehouse_stop');
      setShowReassignChoice({ driverId: targetDriverId, driverName: targetDriverName, shiftId: targetShift.id, tasks: filtered });
    } catch {
      setShowReassignChoice({ driverId: targetDriverId, driverName: targetDriverName, shiftId: targetShift.id, tasks: [] });
    }
  };

  const handleReassignMerge = () => {
    if (!showReassignChoice) return;
    setStagedReassign({
      targetDriverId: showReassignChoice.driverId,
      targetDriverName: showReassignChoice.driverName,
      targetShiftId: showReassignChoice.shiftId,
      targetShiftTasks: showReassignChoice.tasks,
      mode: 'merge',
    });
    setShowReassignChoice(null);
    setShowSummary(true);
  };

  const handleReassignReplace = () => {
    if (!showReassignChoice) return;
    setStagedReassign({
      targetDriverId: showReassignChoice.driverId,
      targetDriverName: showReassignChoice.driverName,
      targetShiftId: showReassignChoice.shiftId,
      targetShiftTasks: showReassignChoice.tasks,
      mode: 'replace',
    });
    setShowReassignChoice(null);
    setShowSummary(true);
  };

  // Submit all changes at once
  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Remove tasks from source shift
      const allRemoveIds = new Set(pendingRemoveIds);
      if (stagedMove) stagedMove.taskIds.forEach(id => allRemoveIds.add(id));

      if (allRemoveIds.size > 0) {
        await removeTasksFromShift(shift.id, Array.from(allRemoveIds), 'Modified via Edit Shift');
      }

      // 2. Add tasks to source shift
      if (pendingAdds.length > 0) {
        const descriptors = pendingAdds.map(t => {
          const d: any = { task_type: t.task_type };
          if (t.bin_id) d.bin_id = t.bin_id;
          if (t.potential_location_id) d.potential_location_id = t.potential_location_id;
          if (t.move_request_id) d.move_request_id = t.move_request_id;
          return d;
        });
        await addTasksToShift(shift.id, descriptors);
      }

      // 3. Move tasks to target driver
      if (stagedMove) {
        const moveDescriptors = stagedMove.tasks.map((t: any) => {
          const d: any = { task_type: t.task_type };
          if (t.bin_id) d.bin_id = t.bin_id;
          if (t.potential_location_id) d.potential_location_id = t.potential_location_id;
          if (t.move_request_id) d.move_request_id = t.move_request_id;
          return d;
        });
        const allTargetDescriptors = [...moveDescriptors, ...stagedMove.additionalTasks.map(t => {
          const d: any = { task_type: t.task_type };
          if (t.bin_id) d.bin_id = t.bin_id;
          if (t.potential_location_id) d.potential_location_id = t.potential_location_id;
          if (t.move_request_id) d.move_request_id = t.move_request_id;
          return d;
        })];

        if (stagedMove.targetShiftId) {
          await addTasksToShift(stagedMove.targetShiftId, allTargetDescriptors);
        } else {
          await createShiftWithTasks(stagedMove.targetDriverId, allTargetDescriptors);
        }
      }

      // 4. Reassign entire shift
      if (stagedReassign) {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const token = localStorage.getItem('binly-auth-storage');
        const authToken = token ? JSON.parse(token)?.state?.token : null;
        const patchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) patchHeaders['Authorization'] = `Bearer ${authToken}`;

        if (stagedReassign.mode === 'direct' || stagedReassign.mode === 'replace') {
          // Replace: cancel target's existing shift (if any), then PATCH driver_id
          if (stagedReassign.mode === 'replace' && stagedReassign.targetShiftId) {
            await cancelShift(stagedReassign.targetShiftId);
          }
          await fetch(`${API_URL}/api/manager/shifts/${shift.id}`, {
            method: 'PATCH', headers: patchHeaders,
            body: JSON.stringify({ driver_id: stagedReassign.targetDriverId, reoptimize: true }),
          });
        } else if (stagedReassign.mode === 'merge') {
          // Merge: remove all tasks from source, add to target (dedup handled by backend)
          const incompleteTasks = tasks.filter(t => t.is_completed === 0 && !t.skipped);
          const taskDescriptors = incompleteTasks.map((t: any) => {
            const d: any = { task_type: t.task_type };
            if (t.bin_id) d.bin_id = t.bin_id;
            if (t.potential_location_id) d.potential_location_id = t.potential_location_id;
            if (t.move_request_id) d.move_request_id = t.move_request_id;
            return d;
          });
          // Remove from source (will auto-cancel if all removed)
          await removeTasksFromShift(shift.id, incompleteTasks.map((t: any) => t.id), 'Merged into another shift');
          // Add to target (backend dedup skips duplicates)
          if (stagedReassign.targetShiftId) {
            await addTasksToShift(stagedReassign.targetShiftId, taskDescriptors);
          }
        }
      }

      invalidateBoard();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit changes');
      setShowSummary(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherDrivers = drivers.filter(d => d.id !== shift.driver_id);

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className={`bg-white rounded-2xl w-full max-w-4xl h-[85vh] mx-4 flex flex-col shadow-2xl ${isClosing ? 'animate-scale-out animate-fade-out' : 'animate-scale-in animate-fade-in'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {stagedMove ? `Move Tasks — ${shift.driver_name} → ${stagedMove.targetDriverName}` : `Edit Shift — ${shift.driver_name}`}
              </h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                shift.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {shift.status === 'active' ? 'Active' : 'Ready'}
              </span>
            </div>
            <button onClick={() => { if (stagedMove) { setStagedMove(null); setTargetDriverTasks([]); } else handleClose(); }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sliding content area */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <div className={`flex h-full transition-transform duration-300 ease-in-out ${showSummary ? '-translate-x-full' : 'translate-x-0'}`} style={{ minHeight: 0 }}>

          {/* Page 1: Two-panel edit */}
          <div className="min-w-full h-full flex" style={{ minHeight: 0 }}>
            {/* Left Panel */}
            <div className="w-1/2 border-r border-gray-200 flex flex-col" style={{ minHeight: 0 }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{shift.driver_name}'s Tasks ({tasks.length})</h3>
                {!stagedMove && (
                  <div className="flex items-center gap-1">
                    <button onClick={selectAllIncomplete} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Select All</button>
                    {selectedIds.size > 0 && <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Clear</button>}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {loading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : tasks.length === 0 && pendingAdds.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No tasks</div>
                ) : (
                  <>
                    {tasks.map((task: any, idx: number) => (
                      <TaskRow key={task.id} task={task} allTasks={tasks}
                        isSelected={selectedIds.has(task.id)}
                        isSelectable={task.is_completed === 0 && !task.skipped}
                        isInProgress={shift.status === 'active' && idx === firstIncompleteIdx}
                        isDone={task.is_completed === 1} isSkipped={!!task.skipped}
                        isPendingRemove={pendingRemoveIds.has(task.id)}
                        isPendingMove={!!stagedMove && stagedMove.taskIds.includes(task.id)}
                        onToggle={() => toggleTask(task.id)} />
                    ))}
                    {/* Pending adds shown as green dashed cards */}
                    {pendingAdds.map((task, i) => {
                      const iconConfig = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
                      const Icon = iconConfig.icon;
                      return (
                        <div key={`add-${i}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 border-dashed border-green-300 bg-green-50">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
                            <Icon className={`w-3 h-3 ${iconConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-green-800 truncate">{getTaskLabel(task)}</div>
                            {task.address && <div className="text-xs text-green-600 truncate">{task.address}</div>}
                          </div>
                          <button onClick={() => setPendingAdds(prev => prev.filter((_, j) => j !== i))} className="text-green-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Selection action bar */}
              {!stagedMove && selectedIds.size > 0 && (
                <div className="px-3 py-2.5 border-t border-gray-200 bg-blue-50">
                  <div className="text-xs font-semibold text-blue-700 mb-2">{selectedIds.size} selected</div>
                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                      <button onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50">
                        <ArrowRight className="w-3 h-3" /> Move to... <ChevronDown className="w-3 h-3" />
                      </button>
                      {showMoveDropdown && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-[200px] overflow-y-auto z-10">
                          {otherDrivers.map(d => {
                            const dShift = shiftsForDate.find((s: any) => s.driver_id === d.id);
                            return (
                              <button key={d.id} onClick={() => stageMoveTo(d.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm">
                                <span className="flex-1 font-medium text-gray-800">{d.name}</span>
                                {dShift ? <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{dShift.status}</span>
                                  : <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">+ New</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={stageRemove}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div className="w-1/2 flex flex-col relative" style={{ minHeight: 0 }}>
              {/* Merge/Replace choice overlay */}
              {showReassignChoice && (
                <div className="absolute inset-0 z-10 bg-white/95 flex items-center justify-center p-6">
                  <div className="w-full max-w-sm space-y-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {showReassignChoice.driverName} already has a shift
                    </div>
                    <div className="text-xs text-gray-500">
                      {showReassignChoice.tasks.length} task{showReassignChoice.tasks.length !== 1 ? 's' : ''} on their current shift
                    </div>
                    <button onClick={handleReassignMerge}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:bg-green-50 transition-colors">
                      <div className="text-sm font-semibold text-gray-800">Merge</div>
                      <div className="text-xs text-gray-500 mt-0.5">Add {shift.driver_name}'s {tasks.filter(t => t.is_completed === 0 && !t.skipped).length} tasks to {showReassignChoice.driverName}'s shift. Duplicates will be skipped.</div>
                    </button>
                    <button onClick={handleReassignReplace}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:border-red-400 hover:bg-red-50 transition-colors">
                      <div className="text-sm font-semibold text-gray-800">Replace</div>
                      <div className="text-xs text-gray-500 mt-0.5">Cancel {showReassignChoice.driverName}'s current shift and give them {shift.driver_name}'s shift instead.</div>
                    </button>
                    <button onClick={() => setShowReassignChoice(null)}
                      className="w-full text-center px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {stagedMove ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {stagedMove.targetDriverName}'s Shift
                      {!stagedMove.targetShiftId && <span className="ml-1 text-xs text-blue-600 font-normal">(new)</span>}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {loadingTargetTasks ? (
                      <div className="flex items-center justify-center h-20 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : (
                      <>
                        {targetDriverTasks.length > 0 && (
                          <>
                            <div className="text-xs text-gray-400 font-medium px-1 mb-1">Existing ({targetDriverTasks.length})</div>
                            {targetDriverTasks.map((task: any) => {
                              const ic = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
                              const Icon = ic.icon;
                              return (
                                <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 opacity-70">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${ic.bg}`}><Icon className={`w-3 h-3 ${ic.color}`} /></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-600 truncate">{getTaskLabel(task)}</div>
                                    {getTaskSubtext(task) && <div className="text-xs text-gray-400 truncate">{getTaskSubtext(task)}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                        <div className="text-xs text-green-600 font-medium px-1 mb-1 mt-3"><Plus className="w-3 h-3 inline mr-1" />Incoming ({stagedMove.tasks.length})</div>
                        {stagedMove.tasks.map((task: any) => {
                          const ic = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
                          const Icon = ic.icon;
                          return (
                            <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-dashed border-green-300 bg-green-50">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${ic.bg}`}><Icon className={`w-3 h-3 ${ic.color}`} /></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-green-800 truncate">{getTaskLabel(task)}</div>
                                {getTaskSubtext(task) && <div className="text-xs text-green-600 truncate">{getTaskSubtext(task)}</div>}
                              </div>
                              <span className="text-[10px] text-green-500 shrink-0">← {shift.driver_name}</span>
                            </div>
                          );
                        })}
                        {stagedMove.additionalTasks.length > 0 && (
                          <>
                            <div className="text-xs text-blue-600 font-medium px-1 mb-1 mt-3"><Plus className="w-3 h-3 inline mr-1" />Also adding ({stagedMove.additionalTasks.length})</div>
                            {stagedMove.additionalTasks.map((task: any, i: number) => {
                              const ic = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
                              const Icon = ic.icon;
                              return (
                                <div key={`ta-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${ic.bg}`}><Icon className={`w-3 h-3 ${ic.color}`} /></div>
                                  <div className="flex-1 min-w-0"><div className="text-sm font-medium text-blue-800 truncate">{getTaskLabel(task)}</div></div>
                                  <button onClick={() => setStagedMove(prev => prev ? { ...prev, additionalTasks: prev.additionalTasks.filter((_, j) => j !== i) } : null)} className="text-blue-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400 mb-2">Add more to {stagedMove.targetDriverName}</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => setShowTargetBinPicker(true)} className="flex items-center justify-center gap-1 px-2 py-2 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 text-xs font-medium text-gray-600"><MapPin className="w-3 h-3 text-blue-600" /> Collection</button>
                        <button onClick={() => setShowTargetPlacementPicker(true)} className="flex items-center justify-center gap-1 px-2 py-2 border border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50/50 text-xs font-medium text-gray-600"><Package className="w-3 h-3 text-orange-600" /> Placement</button>
                        <button onClick={() => setShowTargetMoveRequestPicker(true)} className="flex items-center justify-center gap-1 px-2 py-2 border border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 text-xs font-medium text-gray-600"><ArrowRightLeft className="w-3 h-3 text-purple-600" /> Move Req</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Add Tasks</h3></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setShowBinPicker(true)} className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 text-sm font-medium text-gray-700"><MapPin className="w-4 h-4 text-blue-600" /> Collection</button>
                      <button onClick={() => setShowPlacementPicker(true)} className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50/50 text-sm font-medium text-gray-700"><Package className="w-4 h-4 text-orange-600" /> Placement</button>
                      <button onClick={() => setShowMoveRequestPicker(true)} className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 text-sm font-medium text-gray-700"><ArrowRightLeft className="w-4 h-4 text-purple-600" /> Move Request</button>
                    </div>
                    <p className="text-xs text-gray-400 text-center pt-2">Route will be re-optimized automatically.</p>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Reassign Entire Shift</div>
                      <div className="space-y-1">
                        {otherDrivers.map(d => {
                          const dShift = shiftsForDate.find((s: any) => s.driver_id === d.id && s.status !== 'ended' && s.status !== 'cancelled');
                          return (
                            <button key={d.id} onClick={() => handleReassignClick(d.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm">
                              <span className="flex-1 font-medium text-gray-800">{d.name}</span>
                              {dShift ? <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Has shift</span>
                                : <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Available</span>}
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          </div> {/* end Page 1 */}

          {/* Page 2: Summary */}
          <div className="min-w-full h-full overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Changes</h3>

            {pendingRemoveIds.size > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Remove from {shift.driver_name}</div>
                {tasks.filter(t => pendingRemoveIds.has(t.id)).map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-red-50 border border-red-100 mb-1">
                    <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="font-medium">{getTaskLabel(t)}</span>
                    {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                  </div>
                ))}
              </div>
            )}

            {pendingAdds.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Add to {shift.driver_name}</div>
                {pendingAdds.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-green-50 border border-green-100 mb-1">
                    <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="font-medium">{getTaskLabel(t)}</span>
                    {t.address && <span className="text-xs text-gray-400 truncate">— {t.address}</span>}
                  </div>
                ))}
              </div>
            )}

            {stagedMove && (
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Move to {stagedMove.targetDriverName} {!stagedMove.targetShiftId && '(new shift)'}
                </div>
                {stagedMove.tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-100 mb-1">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium">{getTaskLabel(t)}</span>
                    {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                  </div>
                ))}
                {stagedMove.additionalTasks.length > 0 && (
                  <>
                    <div className="text-xs text-blue-500 mt-2 mb-1">+ Also adding:</div>
                    {stagedMove.additionalTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-100 mb-1">
                        <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-medium">{getTaskLabel(t)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {stagedReassign && stagedReassign.mode === 'merge' && (
              <>
                <div>
                  <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Remove from {shift.driver_name}</div>
                  {tasks.filter(t => t.is_completed === 0 && !t.skipped).map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-red-50 border border-red-100 mb-1">
                      <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="font-medium">{getTaskLabel(t)}</span>
                      {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 mt-1 ml-1">{shift.driver_name}'s shift will be cancelled</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Add to {stagedReassign.targetDriverName}'s shift ({stagedReassign.targetShiftTasks.length} existing tasks)</div>
                  {tasks.filter(t => t.is_completed === 0 && !t.skipped).map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-green-50 border border-green-100 mb-1">
                      <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="font-medium">{getTaskLabel(t)}</span>
                      {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 mt-1 ml-1">Duplicates will be skipped automatically</div>
                </div>
              </>
            )}

            {stagedReassign && stagedReassign.mode === 'replace' && (
              <>
                <div>
                  <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Cancel {stagedReassign.targetDriverName}'s shift</div>
                  {stagedReassign.targetShiftTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-red-50 border border-red-100 mb-1">
                      <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="font-medium">{getTaskLabel(t)}</span>
                      {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Reassign {shift.driver_name}'s shift to {stagedReassign.targetDriverName}</div>
                  {tasks.filter(t => t.is_completed === 0 && !t.skipped).map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-100 mb-1">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium">{getTaskLabel(t)}</span>
                      {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {stagedReassign && stagedReassign.mode === 'direct' && (
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Reassign {shift.driver_name}'s shift to {stagedReassign.targetDriverName}</div>
                {tasks.filter(t => t.is_completed === 0 && !t.skipped).map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-100 mb-1">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium">{getTaskLabel(t)}</span>
                    {getTaskSubtext(t) && <span className="text-xs text-gray-400 truncate">— {getTaskSubtext(t)}</span>}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 pt-2">Routes will be re-optimized automatically after changes are applied.</p>
          </div> {/* end Page 2 */}

          </div> {/* end sliding wrapper */}
          </div> {/* end content area */}

          {/* Bottom bar */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
            <div className="flex items-center justify-between">
              {showSummary ? (
                <>
                  <button onClick={() => { setShowSummary(false); setStagedReassign(null); }}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Edit
                  </button>
                  <button onClick={handleSubmitAll} disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {isSubmitting ? 'Applying...' : 'Confirm & Apply'}
                  </button>
                </>
              ) : stagedMove ? (
                <>
                  <button onClick={() => { setStagedMove(null); setTargetDriverTasks([]); }}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button onClick={() => setShowSummary(true)} disabled={!hasChanges}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                    Review & Submit
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-400">
                    {hasChanges && <span className="text-amber-600 font-medium">{pendingAdds.length + pendingRemoveIds.size + (stagedMove ? stagedMove.tasks.length : 0)} pending changes</span>}
                    {!hasChanges && `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <button onClick={() => setShowSummary(true)}
                        className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg">
                        Review & Submit
                      </button>
                    )}
                    <button onClick={handleClose} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                      {hasChanges ? 'Discard' : 'Close'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBinPicker && <BinSelectionMap onClose={() => setShowBinPicker(false)} onConfirm={handleAddBins} alreadyAddedBinIds={Array.from(assignedBinIds)} />}
      {showPlacementPicker && <PlacementLocationSelectionMap onClose={() => setShowPlacementPicker(false)} onConfirm={handleAddPlacements} potentialLocations={potentialLocations} />}
      {showMoveRequestPicker && <MoveRequestSelectionMap onClose={() => setShowMoveRequestPicker(false)} onConfirm={handleAddMoveRequests} moveRequests={moveRequests} />}
      {showTargetBinPicker && <BinSelectionMap onClose={() => setShowTargetBinPicker(false)} onConfirm={(ids) => handleAddBinsToTarget(ids)} alreadyAddedBinIds={Array.from(targetAssignedBinIds)} />}
      {showTargetPlacementPicker && <PlacementLocationSelectionMap onClose={() => setShowTargetPlacementPicker(false)} onConfirm={handleAddPlacementsToTarget} potentialLocations={potentialLocations} />}
      {showTargetMoveRequestPicker && <MoveRequestSelectionMap onClose={() => setShowTargetMoveRequestPicker(false)} onConfirm={handleAddMoveRequestsToTarget} moveRequests={moveRequests} />}
    </>
  );
}
