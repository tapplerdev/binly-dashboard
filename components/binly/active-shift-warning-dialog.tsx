/**
 * Active Shift Warning Dialog
 *
 * Displays a warning when a manager attempts to edit/delete a resource
 * that is currently being used in one or more active driver shifts.
 *
 * Shows:
 * - Which shifts are affected
 * - Driver names
 * - Affected tasks (type, sequence, address)
 * - What will happen if they proceed
 */

import { ActiveShiftDependency } from '@/lib/api/bins';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Navigation, User, MapPin } from 'lucide-react';

export type ChangeAction =
  | 'address_change'
  | 'move_type_change'
  | 'delete'
  | 'status_change'
  | 'edit';

interface ActiveShiftWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  dependencies: ActiveShiftDependency[];
  resourceType: 'bin' | 'move request' | 'potential location';
  resourceName: string; // e.g., "Bin #42" or "123 Main St"
  changeAction: ChangeAction;
  changeDetails?: string; // e.g., "123 Main St → 456 Oak Ave"
  loading?: boolean;
}

export function ActiveShiftWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  dependencies,
  resourceType,
  resourceName,
  changeAction,
  changeDetails,
  loading = false,
}: ActiveShiftWarningDialogProps) {
  const getActionText = () => {
    switch (changeAction) {
      case 'address_change':
        return 'update the address';
      case 'move_type_change':
        return 'change the move type';
      case 'delete':
        return 'delete this resource';
      case 'status_change':
        return 'change the status';
      default:
        return 'make this change';
    }
  };

  const getImpactDescription = () => {
    switch (changeAction) {
      case 'address_change':
        return "The driver's navigation will be automatically updated with the new address.";
      case 'move_type_change':
        return "This may remove or modify tasks in the driver's route.";
      case 'delete':
        return "The associated task will be removed from the driver's route.";
      case 'status_change':
        return "This may affect the driver's route and task list.";
      default:
        return "The driver's route may be affected.";
    }
  };

  const getTaskTypeLabel = (taskType: string) => {
    switch (taskType) {
      case 'collection':
        return 'Collection';
      case 'placement':
        return 'Placement';
      case 'pickup':
        return 'Pickup';
      case 'dropoff':
        return 'Dropoff';
      case 'warehouse_stop':
        return 'Warehouse Stop';
      default:
        return taskType;
    }
  };

  const getTaskTypeBadgeColor = (taskType: string) => {
    switch (taskType) {
      case 'collection':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'placement':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pickup':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'dropoff':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'warehouse_stop':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === 'active') {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300'; // scheduled
  };

  if (dependencies.length === 0) {
    return null;
  }

  const totalAffectedTasks = dependencies.reduce(
    (sum, dep) => sum + dep.affected_tasks.length,
    0
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <AlertDialogTitle>Active Shift Impact Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            <div className="space-y-4 mt-4">
              {/* Summary */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{resourceName}</span> is currently being used in{' '}
                  <span className="font-semibold">
                    {dependencies.length} active {dependencies.length === 1 ? 'shift' : 'shifts'}
                  </span>{' '}
                  ({totalAffectedTasks} {totalAffectedTasks === 1 ? 'task' : 'tasks'}).
                </p>
                {changeDetails && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Change:</span> {changeDetails}
                  </p>
                )}
                <p className="text-sm text-gray-700 mt-2">{getImpactDescription()}</p>
              </div>

              {/* Affected Shifts */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-900">Affected Shifts:</h4>
                {dependencies.map((dep) => (
                  <div
                    key={dep.shift_id}
                    className="border border-gray-200 rounded-lg p-3 bg-white"
                  >
                    {/* Shift Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm">
                          {new Date(dep.shift_date_iso).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getStatusBadgeColor(dep.status)}`}
                        >
                          {dep.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <User className="h-3.5 w-3.5" />
                        <span>{dep.driver_name}</span>
                      </div>
                    </div>

                    {/* Affected Tasks */}
                    <div className="space-y-2">
                      {dep.affected_tasks.map((task) => (
                        <div
                          key={task.task_id}
                          className="flex items-start gap-2 text-xs bg-gray-50 rounded p-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium text-gray-500 shrink-0">
                              #{task.sequence_order}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs shrink-0 ${getTaskTypeBadgeColor(
                                task.task_type
                              )}`}
                            >
                              {getTaskTypeLabel(task.task_type)}
                            </Badge>
                            <div className="flex items-center gap-1 min-w-0">
                              <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="text-gray-700 truncate">{task.address}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirmation Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">What happens next:</span>
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                  <li>The affected driver(s) will receive a notification</li>
                  <li>Their navigation route will be automatically updated</li>
                  <li>Changes take effect immediately</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Updating...' : `Confirm and Update ${dependencies.length} ${dependencies.length === 1 ? 'Shift' : 'Shifts'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
