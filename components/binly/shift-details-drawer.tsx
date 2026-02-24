'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Package, Weight, TrendingUp, Check, Circle, Trash2, ArrowUp, ArrowDown, Warehouse, SkipForward, AlertTriangle, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel } from '@/lib/types/shift';
import { getShiftById, getShiftTasks, cancelShift, removeTasksFromShift, getShiftTasksWithHistory } from '@/lib/api/shifts';
import { RouteTask, getTaskLabel, getTaskSubtitle, getTaskColor, getTaskBgColor } from '@/lib/types/route-task';
import { ShiftRouteMap } from './shift-route-map';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
import { useAuthStore } from '@/lib/auth/store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';

interface ShiftBin {
  id: number;
  bin_id: string;
  bin_number: string;
  current_street: string;
  city: string;
  zip: string;
  sequence_order: number;
  is_completed: number;
  completed_at: number | null;
  updated_fill_percentage: number | null;
  fill_percentage: number;
  latitude: number | null;
  longitude: number | null;
}

interface ShiftDetailsDrawerProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftDetailsDrawer({ shift, onClose }: ShiftDetailsDrawerProps) {
  console.log('🔍 [SHIFT DRAWER] Received shift prop:', {
    id: shift.id,
    driverName: shift.driverName,
    status: shift.status,
    has_optimization_metadata: !!shift.optimization_metadata,
    optimization_metadata: shift.optimization_metadata,
    total_distance_miles: shift.total_distance_miles,
    estimated_completion_time: shift.estimated_completion_time,
    full_shift: shift,
  });

  const [isClosing, setIsClosing] = useState(false);
  const [tasks, setTasks] = useState<RouteTask[]>([]);
  const [allTasks, setAllTasks] = useState<RouteTask[]>([]); // Includes deleted tasks
  const [bins, setBins] = useState<ShiftBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isRemovingTasks, setIsRemovingTasks] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showInProgressWarning, setShowInProgressWarning] = useState(false);
  const [inProgressTaskToRemove, setInProgressTaskToRemove] = useState<RouteTask | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline'>('tasks');
  const [showRemovedTasks, setShowRemovedTasks] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const { token } = useAuthStore();

  // Function to load shift details
  const loadShiftDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 [SHIFT DETAILS] Starting to load shift details for shift ID:', shift.id);

      // Try to fetch tasks first (new system)
      console.log('🔍 [SHIFT DETAILS] Fetching tasks from API...');
      const tasksData = await getShiftTasks(shift.id);
      console.log('🔍 [SHIFT DETAILS] Raw tasks response:', JSON.stringify(tasksData, null, 2));
      console.log('🔍 [SHIFT DETAILS] Tasks array length:', tasksData?.length || 0);
      console.log('🔍 [SHIFT DETAILS] Tasks array is array?', Array.isArray(tasksData));

      // Also fetch all tasks including deleted ones for history/audit
      const allTasksData = await getShiftTasksWithHistory(shift.id);
      console.log('📜 [SHIFT DETAILS] All tasks (with history):', allTasksData.length);
      setAllTasks(allTasksData);

      if (tasksData && tasksData.length > 0) {
        // New task-based system
        console.log('✅ [SHIFT DETAILS] Using task-based system with', tasksData.length, 'tasks');
        console.log('🔍 [SHIFT DETAILS] First task sample:', JSON.stringify(tasksData[0], null, 2));
        setTasks(tasksData);
      } else {
        // Fallback to old bins system
        console.log('⚠️  [SHIFT DETAILS] No tasks found, falling back to bins system');
        const details = await getShiftById(shift.id);
        console.log('🔍 [SHIFT DETAILS] Shift details response:', JSON.stringify(details, null, 2));
        console.log('🔍 [SHIFT DETAILS] Bins array:', details.bins?.length || 0);
        setBins(details.bins || []);
      }
    } catch (error) {
      console.error('❌ [SHIFT DETAILS] Failed to load shift details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch shift details on mount
  useEffect(() => {
    loadShiftDetails();
  }, [shift.id]);

  // WebSocket connection for real-time shift updates
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
  const wsUrl = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`;

  useWebSocket({
    url: wsUrl,
    onMessage: (message: WebSocketMessage) => {
      if (message.type === 'shift_update' && message.data?.shift_id === shift.id) {
        // Shift was updated (e.g., driver started shift and route was optimized)
        console.log('📡 WebSocket: Shift updated, reloading tasks...');
        loadShiftDetails();
      }

      if (message.type === 'task_removed' && message.data?.shift_id === shift.id) {
        // Tasks were removed from shift by manager
        console.log('📡 WebSocket: Tasks removed from shift, reloading...');
        loadShiftDetails();
      }

      if (message.type === 'route_reoptimized' && message.data?.shift_id === shift.id) {
        // Route was re-optimized after task removal
        console.log('📡 WebSocket: Route re-optimized, reloading tasks...');
        loadShiftDetails();
      }
    },
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const handleCancelShift = async () => {
    // Confirmation dialog
    if (!confirm(`Are you sure you want to cancel this shift for ${shift.driverName}? This will stop navigation and notify the driver.`)) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelShift(shift.id);
      console.log('✅ Shift cancelled successfully');

      // Close drawer and let parent handle refresh
      handleClose();

      // Optional: Trigger a page refresh or refetch shifts
      // The parent component should handle this via WebSocket or polling
      window.location.reload();
    } catch (error) {
      console.error('❌ Failed to cancel shift:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel shift';
      setCancelError(errorMessage);
      setIsCancelling(false);
    }
  };

  // Handle removing selected tasks from shift
  const handleRemoveTasks = async () => {
    if (selectedTaskIds.size === 0) {
      return;
    }

    // Show confirmation modal
    setShowRemoveConfirm(true);
  };

  // Confirm and execute task removal
  const confirmRemoveTasks = async () => {
    setShowRemoveConfirm(false);
    setIsRemovingTasks(true);
    setRemoveError(null);

    const taskCount = selectedTaskIds.size;
    const taskWord = taskCount === 1 ? 'task' : 'tasks';

    try {
      const taskIdsArray = Array.from(selectedTaskIds);
      const result = await removeTasksFromShift(shift.id, taskIdsArray, 'Removed by manager');

      console.log('✅ Tasks removed successfully:', result);

      // Clear selection
      setSelectedTaskIds(new Set());

      // Reload shift details
      await loadShiftDetails();

      // Show success toast
      setToastMessage(`${result.removed_count} ${taskWord} removed successfully`);
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('❌ Failed to remove tasks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove tasks';
      setRemoveError(errorMessage);
    } finally {
      setIsRemovingTasks(false);
    }
  };

  // Toggle task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTaskIds);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const statusColor = getShiftStatusColor(shift.status);
  const statusLabel = getShiftStatusLabel(shift.status);
  const isActive = shift.status === 'active';
  const isCompleted = shift.status === 'completed';
  const canRemoveTasks = shift.status === 'active' || shift.status === 'ready';

  // Support both task-based and bin-based systems
  const usingTasks = tasks.length > 0;
  const totalItems = usingTasks ? tasks.length : bins.length;
  const completedItems = usingTasks
    ? tasks.filter(t => t.is_completed === 1).length
    : bins.filter(b => b.is_completed === 1).length;

  const collectedCount = completedItems;
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const totalWeight = 145; // Mock for now - backend doesn't track weight yet

  return (
    <>
      {/* Overlay */}
      <div className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">Shift Details</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-green-600 text-white' : statusColor
              }`}>
                {statusLabel}
              </span>
              {shift.optimization_metadata && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Optimized
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{shift.startTime} - {shift.endTime}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{shift.route}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-fast"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Driver Info */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Driver</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                {shift.driverName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="font-medium text-gray-900">{shift.driverName}</p>
                {shift.truckId && (
                  <p className="text-sm text-gray-500">Truck #{shift.truckId}</p>
                )}
              </div>
            </div>
          </div>

          {/* Optimization Metrics */}
          {(() => {
            console.log('🔍 [SHIFT DRAWER RENDER] Checking optimization_metadata:', {
              exists: !!shift.optimization_metadata,
              value: shift.optimization_metadata,
            });
            return null;
          })()}
          {shift.optimization_metadata && (
            <div className="p-6 border-b border-gray-100 bg-blue-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Route Optimization</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Est. Duration</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {shift.optimization_metadata.total_duration_formatted ||
                     `${Math.floor(shift.optimization_metadata.total_duration_seconds / 3600)}h ${Math.floor((shift.optimization_metadata.total_duration_seconds % 3600) / 60)}m`}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Est. Distance</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {shift.total_distance_miles
                      ? shift.total_distance_miles.toFixed(1)
                      : (shift.optimization_metadata.total_distance_km * 0.621371).toFixed(1)} mi
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Est. Complete</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {shift.estimated_completion_time
                      ? new Date(shift.estimated_completion_time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : new Date(shift.optimization_metadata.estimated_completion).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress Metrics */}
          {(isActive || isCompleted) && (
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress</h3>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Collection Progress</span>
                  <span className="text-sm font-semibold text-primary">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Collected</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {shift.binsCollected || collectedCount}/{shift.binCount}
                  </p>
                </div>

                {totalWeight > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Weight className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Total Weight</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{totalWeight} kg</p>
                  </div>
                )}

                {isActive && shift.estimatedCompletion && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Est. Complete</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(shift.estimatedCompletion).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {isCompleted && shift.duration && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Duration</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{shift.duration}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optimization Status Message for Scheduled Shifts */}
          {shift.status === 'scheduled' && !shift.optimization_metadata && (
            <div className="p-6 border-b border-gray-100 bg-blue-50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Route Optimization Pending</h4>
                  <p className="text-sm text-blue-700">
                    This route will be automatically optimized when the driver starts their shift, taking into account real-time traffic conditions for the most efficient route.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Route Map */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Route Map</h3>
            {loading ? (
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : usingTasks ? (
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <p className="text-sm text-gray-500">Task-based route map coming soon</p>
              </div>
            ) : (
              <ShiftRouteMap
                bins={bins}
                isOptimized={!!shift.optimization_metadata}
              />
            )}
          </div>

          {/* Bulk Remove Toolbar (only for active/ready shifts with tasks selected) */}
          {canRemoveTasks && usingTasks && selectedTaskIds.size > 0 && (
            <div className="sticky top-0 z-10 bg-orange-50 border-b border-orange-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-fast"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleRemoveTasks}
                    disabled={isRemovingTasks}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-fast disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isRemovingTasks ? 'Removing...' : 'Remove from Shift'}
                  </button>
                </div>
              </div>
              {removeError && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {removeError}
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          {usingTasks && (
            <div className="border-b border-gray-200">
              <div className="flex gap-1 px-6">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'tasks'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Tasks
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>
          )}

          {/* Task/Bin List */}
          <div className="p-6">
            {activeTab === 'tasks' && (
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                {usingTasks ? `Tasks (${shift.binCount})` : `Bins (${shift.binCount})`}
                {shift.optimization_metadata && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">- Optimized Order</span>
                )}
              </h3>
            )}
            {activeTab === 'tasks' && loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTab === 'tasks' && usingTasks ? (
              // New task-based rendering
              tasks.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No tasks assigned to this shift</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    console.log('🔍 [SHIFT DETAILS RENDER] About to render', tasks.length, 'tasks');
                    console.log('🔍 [SHIFT DETAILS RENDER] Tasks data:', JSON.stringify(tasks, null, 2));
                    return null;
                  })()}
                  {(() => {
                    // Find first uncompleted task index (this is the in-progress task)
                    const sortedTasks = tasks.sort((a, b) => a.sequence_order - b.sequence_order);
                    const firstUncompletedIndex = sortedTasks.findIndex(
                      t => t.is_completed === 0 && !t.skipped && !t.is_deleted
                    );

                    return sortedTasks.map((task, index) => {
                    console.log('🔍 [SHIFT DETAILS RENDER] Rendering task:', task.id, 'Type:', task.task_type);
                    console.log('🔍 [SHIFT DETAILS RENDER] Task label:', getTaskLabel(task));
                    console.log('🔍 [SHIFT DETAILS RENDER] Task subtitle:', getTaskSubtitle(task));

                    const isCompleted = task.is_completed === 1;
                    const isSkipped = task.skipped === true;
                    // Only show "in-progress" for active shifts (not scheduled/ready)
                    const isInProgress = shift.status === 'active' && index === firstUncompletedIndex && !isCompleted && !isSkipped;
                    const completedTime = task.completed_at
                      ? new Date(task.completed_at * 1000).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })
                      : null;

                    // Get task type icon
                    const TaskIcon =
                      task.task_type === 'collection' ? Trash2 :
                      task.task_type === 'placement' ? MapPin :
                      task.task_type === 'pickup' ? ArrowUp :
                      task.task_type === 'dropoff' ? ArrowDown :
                      task.task_type === 'warehouse_stop' ? Warehouse :
                      Circle;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-fast ${
                          isSkipped
                            ? 'bg-yellow-50 border-l-4 border-yellow-500 opacity-75'
                            : isCompleted
                            ? 'bg-green-50 border-l-4 border-green-500 opacity-75'
                            : isInProgress
                            ? 'bg-blue-50 border-l-4 border-blue-600 shadow-lg ring-2 ring-blue-100'
                            : 'bg-white border-l-4 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox (only for active/ready shifts and incomplete tasks) */}
                        {canRemoveTasks && !isCompleted && !isSkipped && (
                          <div className="flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => toggleTaskSelection(task.id)}
                              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                            />
                          </div>
                        )}

                        {/* Sequence Number Badge */}
                        <div className="flex-shrink-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{task.sequence_order}</span>
                          </div>
                        </div>

                        {/* Task Type Icon */}
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTaskBgColor(task.task_type)}`}>
                            <TaskIcon className={`w-4 h-4 ${getTaskColor(task.task_type)}`} />
                          </div>
                        </div>

                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isSkipped ? (
                            <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                              <SkipForward className="w-4 h-4 text-white" />
                            </div>
                          ) : isCompleted ? (
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : isInProgress ? (
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                              <Navigation className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <Circle className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`font-medium ${isCompleted || isSkipped ? 'text-gray-600' : isInProgress ? 'text-blue-900 font-semibold' : 'text-gray-900'}`}>
                              {getTaskLabel(task)}
                            </p>
                            {isInProgress && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium whitespace-nowrap">
                                Current Stop
                              </span>
                            )}
                            {isSkipped && completedTime && (
                              <span className="text-xs text-yellow-700 italic">Skipped @ {completedTime}</span>
                            )}
                            {!isSkipped && isCompleted && completedTime && (
                              <span className="text-xs text-green-600">Completed @ {completedTime}</span>
                            )}
                            {isInProgress && (
                              <span className="text-xs text-blue-700 font-medium">Driver en route</span>
                            )}
                          </div>
                          <p className={`text-sm truncate ${isCompleted || isSkipped ? 'text-gray-400' : 'text-gray-600'}`}>
                            {getTaskSubtitle(task)}
                          </p>
                        </div>

                        {/* Fill Percentage (only for collection tasks) */}
                        {task.task_type === 'collection' && !isSkipped && (
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {task.updated_fill_percentage ?? task.fill_percentage}% Fill
                            </p>
                          </div>
                        )}

                        {/* Individual Remove Button (only for active/ready shifts and incomplete tasks) */}
                        {canRemoveTasks && !isCompleted && !isSkipped && (
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => {
                                if (isInProgress) {
                                  // Show warning for in-progress tasks
                                  setInProgressTaskToRemove(task);
                                  setShowInProgressWarning(true);
                                } else {
                                  // Direct confirmation for pending tasks
                                  setSelectedTaskIds(new Set([task.id]));
                                  setShowRemoveConfirm(true);
                                }
                              }}
                              className={`p-2 rounded-lg transition-fast ${
                                isInProgress
                                  ? 'text-red-500 hover:text-red-700 hover:bg-red-100'
                                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              }`}
                              title={isInProgress ? "Driver is navigating to this task" : "Remove task from shift"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                  })()}

                  {/* Removed Tasks Collapsible Section */}
                  {(() => {
                    const deletedTasks = allTasks.filter(t => t.is_deleted === true);
                    if (deletedTasks.length === 0) return null;

                    return (
                      <div className="mt-6">
                        <button
                          onClick={() => setShowRemovedTasks(!showRemovedTasks)}
                          className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-fast"
                        >
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-700">
                              Removed Tasks ({deletedTasks.length})
                            </span>
                          </div>
                          {showRemovedTasks ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        {showRemovedTasks && (
                          <div className="mt-3 space-y-2 pl-4">
                            {deletedTasks
                              .sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0))
                              .map((task) => {
                                const deletedTime = task.deleted_at
                                  ? new Date(task.deleted_at * 1000).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })
                                  : null;

                                return (
                                  <div
                                    key={task.id}
                                    className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-700 line-through">
                                          {getTaskLabel(task)}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                          {getTaskSubtitle(task)}
                                        </p>
                                        {deletedTime && (
                                          <p className="text-xs text-gray-600 mt-2">
                                            Removed {deletedTime}
                                            {task.deleted_by && ` by manager`}
                                          </p>
                                        )}
                                        {task.deletion_reason && (
                                          <p className="text-xs text-gray-500 mt-1 italic">
                                            "{task.deletion_reason}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )
            ) : activeTab === 'tasks' && !usingTasks ? (
              // Old bin-based rendering (fallback)
              bins.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No bins assigned to this shift</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bins
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((bin) => {
                    const isCompleted = bin.is_completed === 1;
                    const collectedTime = bin.completed_at
                      ? new Date(bin.completed_at * 1000).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })
                      : null;

                    return (
                      <div
                        key={bin.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-fast ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {/* Sequence Number Badge (only show if optimized and sequence > 0) */}
                        {shift.optimization_metadata && bin.sequence_order > 0 && (
                          <div className="flex-shrink-0">
                            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-xs font-bold text-white">{bin.sequence_order}</span>
                            </div>
                          </div>
                        )}

                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <Circle className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Bin Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-gray-900">Bin #{bin.bin_number}</p>
                            {isCompleted && collectedTime && (
                              <span className="text-xs text-green-600">@ {collectedTime}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {bin.current_street}, {bin.city} {bin.zip}
                          </p>
                        </div>

                        {/* Fill Percentage */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {bin.updated_fill_percentage ?? bin.fill_percentage}% Fill
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeTab === 'timeline' ? (
              // Timeline View
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity Timeline</h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                    {(() => {
                      // Create timeline events from all tasks
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

                      // Add task completion events
                      allTasks.forEach(task => {
                        if (task.is_completed === 1 && task.completed_at) {
                          events.push({
                            type: task.skipped ? 'task_skipped' : 'task_completed',
                            time: task.completed_at,
                            label: task.skipped ? `Skipped ${getTaskLabel(task)}` : `Completed ${getTaskLabel(task)}`,
                            subtitle: getTaskSubtitle(task),
                            color: task.skipped ? 'orange' : 'green'
                          });
                        }

                        // Add task removal events
                        if (task.is_deleted && task.deleted_at) {
                          events.push({
                            type: 'task_removed',
                            time: task.deleted_at,
                            label: `Removed ${getTaskLabel(task)}`,
                            subtitle: task.deletion_reason || 'Removed by manager',
                            color: 'red'
                          });
                        }
                      });

                      // Add shift end event
                      if (shift.end_time) {
                        events.push({
                          type: 'shift_end',
                          time: shift.end_time,
                          label: 'Shift ended',
                          color: 'gray'
                        });
                      }

                      // Sort events by time (most recent first)
                      events.sort((a, b) => b.time - a.time);

                      return events.length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-600">No activity yet</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pl-8">
                          {events.map((event, index) => {
                            const eventTime = new Date(event.time * 1000);
                            const formattedTime = eventTime.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });

                            const colorClasses = {
                              blue: 'bg-blue-500',
                              green: 'bg-green-500',
                              orange: 'bg-orange-500',
                              red: 'bg-red-500',
                              gray: 'bg-gray-500'
                            };

                            return (
                              <div key={index} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-8 w-4 h-4 rounded-full border-2 border-white ${colorClasses[event.color as keyof typeof colorClasses]}`} />

                                {/* Event Card */}
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{event.label}</p>
                                      {event.subtitle && (
                                        <p className="text-sm text-gray-500 mt-0.5">{event.subtitle}</p>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0">
                                      <p className="text-xs text-gray-500">{formattedTime}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Actions Footer */}
        {shift.status === 'scheduled' && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            {cancelError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{cancelError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-fast">
                Edit Shift
              </button>
              <button
                onClick={handleCancelShift}
                disabled={isCancelling}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Shift'}
              </button>
            </div>
          </div>
        )}

        {shift.status === 'active' && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            {cancelError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{cancelError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast">
                Contact Driver
              </button>
              <button
                onClick={handleCancelShift}
                disabled={isCancelling}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Shift'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-Progress Task Warning Dialog */}
      <Dialog open={showInProgressWarning} onOpenChange={setShowInProgressWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-blue-600" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                Driver is currently navigating to this task
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-sm text-gray-600 space-y-3">
            {inProgressTaskToRemove && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-medium text-blue-900">{getTaskLabel(inProgressTaskToRemove)}</p>
                <p className="text-sm text-blue-700 mt-1">{getTaskSubtitle(inProgressTaskToRemove)}</p>
              </div>
            )}
            <p>
              The driver is currently en route to this location. Removing this task will:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Immediately update the driver's navigation</li>
              <li>Skip this stop in their route</li>
              <li>Re-optimize the route to the next task</li>
              <li>Notify the driver in real-time</li>
            </ul>
            <p className="font-medium text-gray-900">
              Are you sure you want to proceed?
            </p>
          </DialogDescription>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowInProgressWarning(false);
                setInProgressTaskToRemove(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (inProgressTaskToRemove) {
                  setSelectedTaskIds(new Set([inProgressTaskToRemove.id]));
                  setShowInProgressWarning(false);
                  setShowRemoveConfirm(true);
                  setInProgressTaskToRemove(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, remove task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Tasks Confirmation Dialog */}
      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent className="sm:max-w-md transition-all duration-300 ease-out">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                Remove {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'task' : 'tasks'} from this shift?
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-sm text-gray-600 space-y-2 pt-4">
            <p>
              <strong>What happens:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {selectedTaskIds.size === 1 ? 'This task is' : 'These tasks are'} removed from this shift
              </li>
              <li>
                {selectedTaskIds.size === 1 ? 'The bin/location/request stays' : 'The bins/locations/requests stay'} in the system
                and {selectedTaskIds.size === 1 ? 'becomes' : 'become'} available for future shifts
              </li>
              <li>
                The driver is notified in real-time
              </li>
              <li>
                The route is automatically re-optimized
              </li>
            </ul>
          </DialogDescription>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRemoveConfirm(false)}
              disabled={isRemovingTasks}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmRemoveTasks}
              disabled={isRemovingTasks}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRemovingTasks ? 'Removing...' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success/Error Toast */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
