/**
 * Route Task Types
 * Matching backend RouteTask model for shift task management
 */

export type TaskType =
  | 'collection'
  | 'placement'
  | 'pickup'
  | 'dropoff'
  | 'warehouse_stop';

export interface RouteTask {
  // Core fields
  id: string;
  shift_id: string;
  sequence_order: number;
  task_type: TaskType;
  latitude: number;
  longitude: number;
  address: string | null;

  // Collection task fields
  bin_id?: string | null;
  bin_number?: number | null;
  fill_percentage?: number | null;

  // Placement task fields
  potential_location_id?: string | null;
  new_bin_number?: string | null;

  // Move request task fields
  move_request_id?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  destination_address?: string | null;
  move_type?: string | null;

  // Warehouse stop fields
  warehouse_action?: 'load' | 'unload' | 'both' | null;
  bins_to_load?: number | null;

  // Route tracking
  route_id?: string | null;

  // Completion tracking
  is_completed: number;
  completed_at?: number | null;
  skipped: boolean;
  updated_fill_percentage?: number | null;

  // Metadata
  task_data?: any;
  created_at: number;
  updated_at?: number | null;
}

/**
 * Get display label for a task based on its type
 */
export function getTaskLabel(task: RouteTask): string {
  console.log('🔍 [TASK LABEL] Getting label for task:', {
    id: task.id,
    type: task.task_type,
    bin_number: task.bin_number,
    new_bin_number: task.new_bin_number,
    full_task: JSON.stringify(task, null, 2)
  });

  switch (task.task_type) {
    case 'collection':
      const collectionLabel = `Bin #${task.bin_number || '?'}`;
      console.log('🔍 [TASK LABEL] Collection label:', collectionLabel, 'from bin_number:', task.bin_number);
      return collectionLabel;

    case 'placement':
      const placementLabel = task.new_bin_number
        ? `Place New Bin #${task.new_bin_number}`
        : 'Place New Bin';
      console.log('🔍 [TASK LABEL] Placement label:', placementLabel);
      return placementLabel;

    case 'pickup':
      const pickupLabel = `Pickup Bin #${task.bin_number || '?'}`;
      console.log('🔍 [TASK LABEL] Pickup label:', pickupLabel);
      return pickupLabel;

    case 'dropoff':
      const dest = task.destination_address || task.address; // Fallback for old data
      const dropoffLabel = `Dropoff to ${dest || 'New Location'}`;
      console.log('🔍 [TASK LABEL] Dropoff label:', dropoffLabel);
      return dropoffLabel;

    case 'warehouse_stop':
      const action = task.warehouse_action === 'both' ? 'Load/Unload' :
                     task.warehouse_action === 'load' ? 'Load' :
                     task.warehouse_action === 'unload' ? 'Unload' : 'Stop';
      const binsText = task.bins_to_load ? ` ${task.bins_to_load} bins` : '';
      const warehouseLabel = `Warehouse - ${action}${binsText}`;
      console.log('🔍 [TASK LABEL] Warehouse label:', warehouseLabel);
      return warehouseLabel;

    default:
      console.log('🔍 [TASK LABEL] Unknown task type:', task.task_type);
      return 'Unknown Task';
  }
}

/**
 * Get display subtitle/address for a task
 */
export function getTaskSubtitle(task: RouteTask): string {
  switch (task.task_type) {
    case 'collection':
    case 'pickup':
    case 'placement':
      return task.address || 'No address';

    case 'dropoff':
      return task.destination_address || task.address || 'No address'; // Fallback for old data

    case 'warehouse_stop':
      return task.address || 'Warehouse Location';

    default:
      return '';
  }
}

/**
 * Get icon name for a task type (Lucide icon names)
 */
export function getTaskIconName(taskType: TaskType): string {
  switch (taskType) {
    case 'collection':
      return 'Trash2';
    case 'placement':
      return 'MapPin';
    case 'pickup':
      return 'ArrowUp';
    case 'dropoff':
      return 'ArrowDown';
    case 'warehouse_stop':
      return 'Warehouse';
    default:
      return 'Circle';
  }
}

/**
 * Get color class for a task type
 */
export function getTaskColor(taskType: TaskType): string {
  switch (taskType) {
    case 'collection':
      return 'text-green-600';
    case 'placement':
      return 'text-orange-600';
    case 'pickup':
      return 'text-purple-600';
    case 'dropoff':
      return 'text-purple-600';
    case 'warehouse_stop':
      return 'text-gray-700';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get background color class for a task type
 */
export function getTaskBgColor(taskType: TaskType): string {
  switch (taskType) {
    case 'collection':
      return 'bg-green-100';
    case 'placement':
      return 'bg-orange-100';
    case 'pickup':
      return 'bg-purple-100';
    case 'dropoff':
      return 'bg-purple-100';
    case 'warehouse_stop':
      return 'bg-gray-100';
    default:
      return 'bg-gray-50';
  }
}
