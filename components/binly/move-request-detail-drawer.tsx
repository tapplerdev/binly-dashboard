'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MoveRequest } from '@/lib/types/bin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMoveRequestUrgency, getMoveRequestBadgeColor } from '@/lib/types/bin';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  X as XIcon,
  Package,
  MapPin,
  Calendar,
  User,
  Truck,
  Edit,
  Trash2,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface MoveRequestDetailDrawerProps {
  moveRequest: MoveRequest;
  onClose: () => void;
  onEdit?: (move: MoveRequest) => void;
  onAssign?: (move: MoveRequest) => void;
  onClearAssignment?: (move: MoveRequest) => void;
  onCancel?: (move: MoveRequest) => void;
}

export function MoveRequestDetailDrawer({
  moveRequest,
  onClose,
  onEdit,
  onAssign,
  onClearAssignment,
  onCancel,
}: MoveRequestDetailDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const urgency = getMoveRequestUrgency(moveRequest.scheduled_date);
  const urgencyColors = getMoveRequestBadgeColor(moveRequest.scheduled_date);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const urgencyLabels = {
    overdue: '⚠️ Overdue',
    urgent: '🔴 Urgent',
    soon: 'Move Soon',
    scheduled: 'Scheduled',
  };

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-orange-500 text-white' },
    assigned: { label: 'Assigned', color: 'bg-blue-600 text-white' },
    in_progress: { label: 'In Progress', color: 'bg-purple-600 text-white' },
    completed: { label: 'Completed', color: 'bg-green-600 text-white' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-500 text-white' },
  };

  const isPending = moveRequest.status === 'pending';
  const isAssigned = !!moveRequest.assigned_shift_id || !!moveRequest.assigned_user_id;
  const isRelocation = moveRequest.move_type === 'relocation';

  return typeof window !== 'undefined' ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/30 z-40",
          isClosing ? "animate-fade-out" : "animate-fade-in"
        )}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto",
        isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-gray-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                Bin #{moveRequest.bin_number}
              </h2>
            </div>
            <Badge className={cn('font-semibold', statusConfig[moveRequest.status].color)}>
              {statusConfig[moveRequest.status].label}
            </Badge>
            <Badge className={cn('font-semibold', urgencyColors)}>
              {urgencyLabels[urgency]}
            </Badge>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className={cn("p-6 space-y-6", isPending ? "pb-32" : "pb-12")}>
          {/* Move Request Details Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Move Request Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
                <p className="text-gray-900 font-semibold mt-1">
                  {format(new Date(moveRequest.scheduled_date * 1000), 'MMMM dd, yyyy')}
                </p>
                <p className="text-sm text-gray-500">
                  {format(new Date(moveRequest.scheduled_date * 1000), 'h:mm a')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Move Type</label>
                <div className="flex items-center gap-2 mt-1">
                  {isRelocation ? (
                    <>
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-gray-900 font-semibold">Relocation</span>
                    </>
                  ) : moveRequest.move_type === 'store' ? (
                    <>
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-gray-900 font-semibold">Store in Warehouse</span>
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-gray-900 font-semibold">Pickup Only</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Requested By</label>
                <p className="text-gray-900 font-medium mt-1">
                  {moveRequest.requested_by_name || 'Unknown'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Request ID</label>
                <p className="text-gray-900 font-mono text-sm mt-1">
                  {moveRequest.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          {/* Current Location Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Current Location
            </h3>
            <div>
              <p className="text-gray-900 font-semibold">{moveRequest.current_street}</p>
              <p className="text-gray-600">
                {moveRequest.city}, {moveRequest.zip}
              </p>
            </div>
          </div>

          {/* New Location Card (if relocation) */}
          {isRelocation && (moveRequest.new_street || moveRequest.new_address) && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                New Location
              </h3>
              <div>
                <p className="text-gray-900 font-semibold">
                  {moveRequest.new_street || moveRequest.new_address}
                </p>
                {moveRequest.new_city && moveRequest.new_zip && (
                  <p className="text-gray-600">
                    {moveRequest.new_city}, {moveRequest.new_zip}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Assignment Information Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Assignment Information
            </h3>

            {isAssigned ? (
              <div className="space-y-4">
                {/* Assignment Type Badge */}
                <div>
                  {moveRequest.assignment_type === 'manual' ? (
                    <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <User className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-purple-900">Manual Assignment (One-Off Task)</div>
                        <div className="text-sm text-purple-700 mt-1">
                          This move was manually assigned to a specific person. It's not part of a regular shift route.
                        </div>
                      </div>
                    </div>
                  ) : moveRequest.status === 'in_progress' ? (
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Truck className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-green-900">Active Shift Assignment</div>
                        <div className="text-sm text-green-700 mt-1">
                          This move is part of an active shift route. The driver is currently working on it.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900">Future Shift Assignment</div>
                        <div className="text-sm text-blue-700 mt-1">
                          This move is scheduled as part of an upcoming shift route.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned Person */}
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    {moveRequest.assignment_type === 'manual' ? 'Assigned To' : 'Driver'}
                  </label>
                  <p className="text-gray-900 font-semibold mt-1 flex items-center gap-2">
                    {moveRequest.driver_name || 'Unknown'}
                  </p>
                </div>

                {isPending && onClearAssignment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onClearAssignment(moveRequest)}
                    className="w-full"
                  >
                    <XIcon className="h-4 w-4 mr-2" />
                    Clear Assignment
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium mb-4">
                  {moveRequest.move_type === 'store'
                    ? 'Not yet assigned to a person'
                    : 'Not yet assigned to a driver'}
                </p>
                {isPending && onAssign && (
                  <Button
                    onClick={() => onAssign(moveRequest)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {moveRequest.move_type === 'store' ? (
                      <>
                        <User className="h-4 w-4 mr-2" />
                        Assign to Person
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4 mr-2" />
                        Assign to Shift
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Additional Information Card */}
          {(moveRequest.reason || moveRequest.notes) && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Additional Information
              </h3>

              {moveRequest.reason && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Reason</label>
                  <p className="text-gray-900 mt-1">{moveRequest.reason}</p>
                </div>
              )}

              {moveRequest.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-900 mt-1">{moveRequest.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Timestamps Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-900 font-medium">
                  {moveRequest.created_at_iso
                    ? format(new Date(moveRequest.created_at_iso), 'MMM dd, yyyy h:mm a')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated:</span>
                <span className="text-gray-900 font-medium">
                  {moveRequest.updated_at_iso
                    ? format(new Date(moveRequest.updated_at_iso), 'MMM dd, yyyy h:mm a')
                    : 'N/A'}
                </span>
              </div>
              {moveRequest.completed_at_iso && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-gray-900 font-medium">
                    {format(new Date(moveRequest.completed_at_iso), 'MMM dd, yyyy h:mm a')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {isPending && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => onEdit(moveRequest)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
            )}
            {onCancel && (
              <Button
                variant="destructive"
                onClick={() => onCancel(moveRequest)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Move
              </Button>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null;
}
