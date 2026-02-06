'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Package, Weight, TrendingUp, Check, Circle, Trash2, ArrowUp, ArrowDown, Warehouse, SkipForward } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel } from '@/lib/types/shift';
import { getShiftById, getShiftTasks, cancelShift } from '@/lib/api/shifts';
import { RouteTask, getTaskLabel, getTaskSubtitle, getTaskColor, getTaskBgColor } from '@/lib/types/route-task';
import { ShiftRouteMap } from './shift-route-map';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
import { useAuthStore } from '@/lib/auth/store';

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
  const [isClosing, setIsClosing] = useState(false);
  const [tasks, setTasks] = useState<RouteTask[]>([]);
  const [bins, setBins] = useState<ShiftBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { token } = useAuthStore();

  // Function to load shift details
  const loadShiftDetails = async () => {
    try {
      setLoading(true);

      // Try to fetch tasks first (new system)
      const tasksData = await getShiftTasks(shift.id);

      if (tasksData && tasksData.length > 0) {
        // New task-based system
        setTasks(tasksData);
        console.log('✅ Loaded shift with tasks:', tasksData.length);
      } else {
        // Fallback to old bins system
        const details = await getShiftById(shift.id);
        setBins(details.bins || []);
        console.log('✅ Loaded shift with bins:', details.bins?.length || 0);
      }
    } catch (error) {
      console.error('Failed to load shift details:', error);
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

  const statusColor = getShiftStatusColor(shift.status);
  const statusLabel = getShiftStatusLabel(shift.status);
  const isActive = shift.status === 'active';
  const isCompleted = shift.status === 'completed';

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
                    {Math.floor(shift.optimization_metadata.total_duration_seconds / 3600)}h {Math.floor((shift.optimization_metadata.total_duration_seconds % 3600) / 60)}m
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Est. Distance</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {shift.optimization_metadata.total_distance_km.toFixed(1)} mi
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Est. Complete</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(shift.optimization_metadata.estimated_completion).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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

          {/* Task/Bin List */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {usingTasks ? `Tasks (${shift.binCount})` : `Bins (${shift.binCount})`}
              {shift.optimization_metadata && (
                <span className="ml-2 text-xs text-gray-500 font-normal">- Optimized Order</span>
              )}
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : usingTasks ? (
              // New task-based rendering
              tasks.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No tasks assigned to this shift</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((task) => {
                    const isCompleted = task.is_completed === 1;
                    const isSkipped = task.skipped === true;
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
                            ? 'bg-orange-50 border-orange-200'
                            : isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
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
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                              <SkipForward className="w-4 h-4 text-white" />
                            </div>
                          ) : isCompleted ? (
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
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
                            <p className="font-medium text-gray-900">{getTaskLabel(task)}</p>
                            {isSkipped && completedTime && (
                              <span className="text-xs text-orange-600">@ {completedTime} (Skipped)</span>
                            )}
                            {!isSkipped && isCompleted && completedTime && (
                              <span className="text-xs text-green-600">@ {completedTime}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
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
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
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
            )}
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
    </>
  );
}
