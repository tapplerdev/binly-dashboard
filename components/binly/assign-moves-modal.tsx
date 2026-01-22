'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignMoveToShift, bulkAssignMoves } from '@/lib/api/move-requests';
import { getShifts, getShiftDetailsByDriverId } from '@/lib/api/shifts';
import { MoveRequest } from '@/lib/types/bin';
import { Shift } from '@/lib/types/shift';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  Truck,
  MapPin,
  Calendar,
  User,
  Clock,
  Navigation,
  GripVertical,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AssignMovesModalProps {
  moveRequests: MoveRequest[]; // Can be single or multiple
  onClose: () => void;
  onSuccess?: () => void;
}

export function AssignMovesModal({ moveRequests, onClose, onSuccess }: AssignMovesModalProps) {
  const queryClient = useQueryClient();
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [insertPosition, setInsertPosition] = useState<'start' | 'end'>('end');
  const [insertAfterBinId, setInsertAfterBinId] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Fetch shifts from real API
  const { data: shifts, isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['shifts'],
    queryFn: getShifts,
  });

  // Determine shift mode (future vs active)
  const selectedShift = useMemo(() => {
    return shifts?.find((s) => s.id === selectedShiftId);
  }, [shifts, selectedShiftId]);

  const shiftMode = useMemo(() => {
    if (!selectedShift) return null;

    if (selectedShift.status === 'active') {
      return 'active';
    } else if (selectedShift.status === 'scheduled') {
      return 'future';
    }
    return null;
  }, [selectedShift]);

  // Fetch shift details (bins) when a shift is selected
  const { data: shiftDetails, isLoading: shiftDetailsLoading } = useQuery({
    queryKey: ['shift-details', selectedShift?.driverId],
    queryFn: () => {
      if (!selectedShift) return null;
      return getShiftDetailsByDriverId(selectedShift.driverId);
    },
    enabled: !!selectedShift && shiftMode === 'active',
  });

  // Get remaining bins for active shift
  const remainingBins = useMemo(() => {
    if (shiftMode !== 'active' || !shiftDetails?.bins) return [];
    return shiftDetails.bins.filter((bin) => bin.is_completed === 0);
  }, [shiftMode, shiftDetails]);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedShiftId) throw new Error('No shift selected');

      if (moveRequests.length === 1) {
        // Single assignment
        await assignMoveToShift({
          move_request_id: moveRequests[0].id,
          shift_id: selectedShiftId,
          insert_after_bin_id: shiftMode === 'active' ? insertAfterBinId : undefined,
          insert_position: shiftMode === 'future' ? insertPosition : undefined,
        });
      } else {
        // Bulk assignment
        await bulkAssignMoves({
          move_request_ids: moveRequests.map((m) => m.id),
          shift_id: selectedShiftId,
          insert_after_bin_id: shiftMode === 'active' ? insertAfterBinId : undefined,
          insert_position: shiftMode === 'future' ? insertPosition : undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      alert(
        `Successfully assigned ${moveRequests.length} move${moveRequests.length > 1 ? 's' : ''} to shift`
      );
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to assign moves:', error);
      alert('Failed to assign moves. Please try again.');
    },
  });

  const handleAssign = () => {
    if (!selectedShiftId) {
      alert('Please select a shift');
      return;
    }

    if (shiftMode === 'active' && !insertAfterBinId) {
      alert('Please select where to insert the move(s) in the active route');
      return;
    }

    assignMutation.mutate();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4 ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col ${
            isClosing ? 'animate-scale-out' : 'animate-scale-in'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Assign Move{moveRequests.length > 1 ? 's' : ''} to Shift
                </h2>
                <p className="text-sm text-gray-600">
                  Add {moveRequests.length} move request{moveRequests.length > 1 ? 's' : ''} to a driver's shift route
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This will add the move{moveRequests.length > 1 ? 's' : ''} to either an active shift (currently in progress) or a future scheduled shift
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Move Requests Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Move Requests to Assign:
              </h3>
              <div className="space-y-2">
                {moveRequests.map((move) => (
                  <Card key={move.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">Bin #{move.bin_number}</span>
                        <span className="text-sm text-gray-600">
                          {move.current_street}, {move.city}
                        </span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {move.move_type === 'relocation' ? 'Relocation' : move.move_type === 'store' ? 'Store' : 'Pickup'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Select Shift */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Shift Route:</h3>
              <p className="text-xs text-gray-500 mb-3">
                Choose a shift to add this move to the driver's route
              </p>
              {shiftsLoading ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-300 animate-pulse mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading shifts...</p>
                </div>
              ) : shifts && shifts.length > 0 ? (
                <div className="space-y-2">
                  {shifts.map((shift) => {
                    const mode = shift.status === 'active' ? 'active' : 'future';
                    const isSelected = selectedShiftId === shift.id;

                    return (
                      <button
                        key={shift.id}
                        onClick={() => setSelectedShiftId(shift.id)}
                        className={cn(
                          'w-full text-left p-4 rounded-xl border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-gray-600" />
                              <span className="font-semibold text-gray-900">
                                {shift.driverName}
                              </span>
                              <Badge
                                className={cn(
                                  'text-xs',
                                  mode === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                                )}
                              >
                                {mode === 'active' ? '🚚 Active Now' : '📅 Scheduled'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {shift.date} • {shift.startTime}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                              {mode === 'active'
                                ? `Driver is on route - ${shift.binsCollected || 0} completed, ${shift.binCount - (shift.binsCollected || 0)} remaining`
                                : `Future shift - ${shift.binCount} bins planned`}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No available shifts found</p>
                </div>
              )}
            </div>

            {/* Mode-Specific Options */}
            {selectedShift && shiftMode === 'future' && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Route Position:
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Choose where to place this move in the future shift route
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setInsertPosition('start')}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      insertPosition === 'start'
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="font-semibold text-gray-900 mb-1">🏁 First Stop</div>
                    <div className="text-sm text-gray-600">
                      Driver will handle this first
                    </div>
                  </button>
                  <button
                    onClick={() => setInsertPosition('end')}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      insertPosition === 'end'
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="font-semibold text-gray-900 mb-1">🎯 Last Stop</div>
                    <div className="text-sm text-gray-600">
                      Driver will handle this last
                    </div>
                  </button>
                </div>
              </div>
            )}

            {selectedShift && shiftMode === 'active' && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Insert Into Active Route:
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  This driver is currently on their route. Choose where to add this move after one of their remaining stops.
                </p>
                <div className="space-y-2 bg-gray-50 rounded-xl p-4">
                  {shiftDetailsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading route bins...</p>
                    </div>
                  ) : remainingBins.length > 0 ? (
                    <div className="space-y-2">
                      {remainingBins.map((bin, index) => (
                        <button
                          key={bin.bin_id}
                          onClick={() => setInsertAfterBinId(bin.bin_id)}
                          className={cn(
                            'w-full text-left p-3 rounded-lg border-2 transition-all',
                            insertAfterBinId === bin.bin_id
                              ? 'border-primary bg-white'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                                {bin.sequence_order}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  Bin #{bin.bin_number}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {bin.current_street}
                                </div>
                              </div>
                            </div>
                            <Navigation className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">
                        No remaining bins in this shift
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedShiftId || assignMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Truck className="w-4 h-4 mr-2" />
                {assignMutation.isPending
                  ? 'Assigning...'
                  : `Assign to ${selectedShift?.driverName || 'Shift'}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
