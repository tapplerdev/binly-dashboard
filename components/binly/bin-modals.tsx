'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BinWithPriority, MoveRequest } from '@/lib/types/bin';
import { getBinsWithPriority } from '@/lib/api/bins';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Calendar, Trash2, Loader2, MapPin, Search, AlertTriangle, Truck, User, ChevronDown, ChevronRight, Route } from 'lucide-react';
import { createMoveRequest, updateMoveRequest, assignMoveToShift, assignMoveToUser } from '@/lib/api/move-requests';
import { getShifts, getShiftDetailsByDriverId } from '@/lib/api/shifts';
import { getUsers, User as UserType } from '@/lib/api/users';
import { cn } from '@/lib/utils';
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
import { format } from 'date-fns';

// Schedule Move Modal
interface ScheduleMoveModalProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  moveRequest?: MoveRequest; // For editing existing move request
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScheduleMoveModal({ bin, bins, moveRequest, onClose, onSuccess }: ScheduleMoveModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!moveRequest; // Editing mode if moveRequest is provided
  const isBulk = bins && bins.length > 0;
  const isStandalone = !bin && !bins && !moveRequest; // No bin provided - show bin selector

  // Support both single bin mode and multi-select standalone mode
  const [selectedBins, setSelectedBins] = useState<BinWithPriority[]>(
    bin ? [bin] : bins || []
  );
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  const targetBins = selectedBins;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dateOption, setDateOption] = useState<'24h' | '3days' | 'week' | 'custom'>('custom');
  const [formData, setFormData] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    move_type: 'store' as 'store' | 'relocation',
    new_street: '',
    new_city: '',
    new_zip: '',
    new_latitude: null as number | null,
    new_longitude: null as number | null,
    reason: '',
    notes: '',
  });

  // Track auto-filled state for visual feedback
  const [newLocationAutoFilled, setNewLocationAutoFilled] = useState({
    street: false,
    city: false,
    zip: false,
  });

  // Assignment state
  type AssignmentMode = 'unassigned' | 'user' | 'active_shift' | 'future_shift';
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('unassigned');
  const [showAssignmentSection, setShowAssignmentSection] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [insertPosition, setInsertPosition] = useState<'start' | 'end'>('end');
  const [insertAfterBinId, setInsertAfterBinId] = useState<string>('');

  // Warning modal state
  const [showInProgressWarning, setShowInProgressWarning] = useState(false);
  const [showActiveShiftWarning, setShowActiveShiftWarning] = useState(false);
  const [warningData, setWarningData] = useState<{
    driverName?: string;
    waypointInfo?: string;
  }>({});
  const [pendingUpdateParams, setPendingUpdateParams] = useState<any>(null);

  // Fetch users for user assignment (fetch when assignment section is shown or user mode is selected)
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: assignmentMode === 'user' || showAssignmentSection,
  });

  // Fetch shifts for shift assignment
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
    enabled: assignmentMode === 'active_shift' || assignmentMode === 'future_shift',
  });

  // Fetch selected shift details (to show bins for active shifts)
  const { data: shiftDetails } = useQuery({
    queryKey: ['shift-details', selectedShiftId],
    queryFn: () => {
      const selectedShift = shifts?.find(s => s.id === selectedShiftId);
      if (!selectedShift) return null;
      return getShiftDetailsByDriverId(selectedShift.driverId);
    },
    enabled: !!selectedShiftId && (assignmentMode === 'active_shift' || assignmentMode === 'future_shift'),
  });

  // Get shift mode from selected shift
  const selectedShift = shifts?.find(s => s.id === selectedShiftId);
  const shiftMode = selectedShift?.status === 'active' ? 'active' : 'future';

  // Get remaining bins for active shift
  const remainingBins = shiftMode === 'active' && shiftDetails?.bins
    ? shiftDetails.bins.filter(b => b.is_completed === 0)
    : [];

  // Fetch all active bins for standalone mode
  const { data: allBins, isLoading: binsLoading } = useQuery({
    queryKey: ['bins', 'active'],
    queryFn: () => getBinsWithPriority({ status: 'active', limit: 1000 }),
    enabled: isStandalone,
  });

  // PRE-POPULATE FORM WHEN EDITING
  useEffect(() => {
    if (isEditing && moveRequest) {
      console.log('[EDIT MODE] Pre-populating form with moveRequest:', moveRequest);

      // Convert scheduled_date (Unix timestamp) to date string
      const scheduledDate = new Date(moveRequest.scheduled_date * 1000);
      const dateString = scheduledDate.toISOString().split('T')[0];

      // Pre-fill basic fields
      setFormData({
        scheduled_date: dateString,
        move_type: (moveRequest.move_type as 'store' | 'relocation') || 'store',
        new_street: moveRequest.new_street || '',
        new_city: moveRequest.new_city || '',
        new_zip: moveRequest.new_zip || '',
        new_latitude: moveRequest.new_latitude || null,
        new_longitude: moveRequest.new_longitude || null,
        reason: moveRequest.reason || '',
        notes: moveRequest.notes || '',
      });

      // Pre-fill assignment state
      if (moveRequest.assigned_user_id) {
        // Assigned to person (manual one-off)
        setAssignmentMode('user');
        setSelectedUserId(moveRequest.assigned_user_id);
        setShowAssignmentSection(true);
      } else if (moveRequest.assigned_shift_id) {
        // Assigned to shift
        const shift = shifts?.find(s => s.id === moveRequest.assigned_shift_id);
        if (shift) {
          setAssignmentMode(shift.status === 'active' ? 'active_shift' : 'future_shift');
          setSelectedShiftId(moveRequest.assigned_shift_id);
          setShowAssignmentSection(true);
        }
      } else {
        // Unassigned
        setAssignmentMode('unassigned');
        setShowAssignmentSection(false);
      }

      console.log('[EDIT MODE] Form pre-populated successfully');
    }
  }, [isEditing, moveRequest, shifts]);

  // Filter bins for dropdown
  const availableBins = allBins?.filter((b) => {
    // Exclude bins that already have pending move requests
    if (b.has_pending_move) return false;

    // Exclude bins that are already selected
    if (selectedBins.some((selected) => selected.id === b.id)) return false;

    // Search filter
    if (binSearchQuery) {
      const query = binSearchQuery.toLowerCase();
      return (
        b.bin_number.toString().includes(query) ||
        b.current_street.toLowerCase().includes(query) ||
        b.city.toLowerCase().includes(query) ||
        b.zip.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Calculate date based on quick selection
  const handleDateQuickSelect = (option: '24h' | '3days' | 'week' | 'custom') => {
    setDateOption(option);
    const now = new Date();
    let targetDate = new Date();

    if (option === '24h') {
      targetDate.setDate(now.getDate() + 1);
    } else if (option === '3days') {
      targetDate.setDate(now.getDate() + 3);
    } else if (option === 'week') {
      targetDate.setDate(now.getDate() + 7);
    }

    if (option !== 'custom') {
      setFormData({ ...formData, scheduled_date: targetDate.toISOString().split('T')[0] });
    }
  };

  // Handle Google Places autocomplete selection for new location
  const handleNewLocationPlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place.address_components || !place.geometry) return;

    // Parse address components
    let street = '';
    let city = '';
    let zip = '';

    place.address_components.forEach((component) => {
      const types = component.types;

      if (types.includes('street_number')) {
        street = component.long_name;
      }
      if (types.includes('route')) {
        street = street ? `${street} ${component.long_name}` : component.long_name;
      }
      if (types.includes('locality')) {
        city = component.long_name;
      }
      if (!city && types.includes('sublocality_level_1')) {
        city = component.long_name;
      }
      if (types.includes('postal_code')) {
        zip = component.long_name;
      }
    });

    const lat = place.geometry.location?.lat();
    const lng = place.geometry.location?.lng();

    // Update all fields with auto-filled data
    setFormData({
      ...formData,
      new_street: street.trim(),
      new_city: city.trim(),
      new_zip: zip.trim(),
      new_latitude: lat || null,
      new_longitude: lng || null,
    });

    // Mark fields as auto-filled for visual feedback
    setNewLocationAutoFilled({
      street: false, // Street is user-input (from autocomplete)
      city: true,
      zip: true,
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Handle in-progress warning confirmation
  const handleInProgressConfirm = async (action: 'remove_from_route' | 'insert_after_current' | 'reoptimize_route') => {
    console.log('✅ [IN-PROGRESS WARNING] User confirmed action:', action);

    if (!pendingUpdateParams || !moveRequest) return;

    setIsSubmitting(true);
    setShowInProgressWarning(false);

    try {
      // Add the in_progress_action to the update params
      const paramsWithAction = {
        ...pendingUpdateParams,
        in_progress_action: action,
      };

      console.log('✏️ [EDIT MODE] Retrying with in_progress_action:', paramsWithAction);
      await updateMoveRequest(moveRequest.id, paramsWithAction);

      console.log('✅ [EDIT MODE] Successfully updated move request after in-progress confirmation');

      // Invalidate all move request queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      console.log('✅ [EDIT MODE] Invalidated all move request queries');

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('❌ [EDIT MODE] Failed to update after in-progress confirmation:', error);
      alert(`Failed to update move. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      setPendingUpdateParams(null);
      setWarningData({});
    }
  };

  // Handle active shift warning confirmation
  const handleActiveShiftConfirm = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 [ACTIVE SHIFT WARNING] handleActiveShiftConfirm() CALLED');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Function exists:', typeof handleActiveShiftConfirm);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('✅ [ACTIVE SHIFT WARNING] User confirmed changes');
    console.log('   Move Request ID:', moveRequest?.id);
    console.log('   Move Request exists:', !!moveRequest);
    console.log('   Pending Update Params exists:', !!pendingUpdateParams);
    console.log('   Pending Update Params:', JSON.stringify(pendingUpdateParams, null, 2));

    if (!pendingUpdateParams || !moveRequest) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ [ACTIVE SHIFT WARNING] ABORT: Missing data');
      console.log('   pendingUpdateParams:', pendingUpdateParams);
      console.log('   moveRequest:', moveRequest);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    console.log('🔄 [ACTIVE SHIFT WARNING] Setting isSubmitting to true...');
    setIsSubmitting(true);
    console.log('🔄 [ACTIVE SHIFT WARNING] Hiding active shift warning modal...');
    setShowActiveShiftWarning(false);
    console.log('✅ [ACTIVE SHIFT WARNING] State updated, starting try block...');

    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [ACTIVE SHIFT WARNING] INSIDE TRY BLOCK');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      // Check if this is a new-style pending update with assignment metadata
      const hasMetadata = 'assignmentChanged' in pendingUpdateParams;
      console.log('📋 [ACTIVE SHIFT WARNING] Has metadata:', hasMetadata);

      if (hasMetadata) {
        // New-style: Use the stored metadata to retry the correct operation
        const { assignmentChanged, newShiftId, newUserId, baseUpdateParams, insertAfterBinId, insertPosition } = pendingUpdateParams as any;

        console.log('✏️ [ACTIVE SHIFT WARNING] Metadata details:');
        console.log('   Assignment changed:', assignmentChanged);
        console.log('   New shift ID:', newShiftId);
        console.log('   New user ID:', newUserId);
        console.log('   Base update params:', JSON.stringify(baseUpdateParams, null, 2));
        console.log('   Insert after bin ID:', insertAfterBinId);
        console.log('   Insert position:', insertPosition);

        // Update fields with confirmation flag
        if (Object.keys(baseUpdateParams).length > 1) {
          console.log('📝 [ACTIVE SHIFT WARNING] Updating fields with confirmation...');

          const updateParams = {
            ...baseUpdateParams,
            confirm_active_shift_change: true,
          };

          // If assignment didn't change, we need to preserve the existing assignment
          if (!assignmentChanged) {
            console.log('📌 [ACTIVE SHIFT WARNING] Preserving existing assignment in update');
            // Use EXISTING assignment values, not the NEW (potentially empty) values
            updateParams.assigned_shift_id = moveRequest.assigned_shift_id || '';
            updateParams.assigned_user_id = moveRequest.assigned_user_id || '';
            updateParams.assignment_type = moveRequest.assignment_type || '';
          }

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📝 [ACTIVE SHIFT WARNING] About to call updateMoveRequest()');
          console.log('   Move Request ID:', moveRequest.id);
          console.log('   Full update params:', JSON.stringify(updateParams, null, 2));
          console.log('   confirm_active_shift_change:', updateParams.confirm_active_shift_change);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          const updateResult = await updateMoveRequest(moveRequest.id, updateParams);

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ [ACTIVE SHIFT WARNING] updateMoveRequest() COMPLETED');
          console.log('   Result:', JSON.stringify(updateResult, null, 2));
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        // Then handle assignment if it changed
        if (assignmentChanged && newShiftId) {
          console.log('🚚 [ACTIVE SHIFT WARNING] Assigning to shift:', newShiftId);
          await assignMoveToShift({
            move_request_id: moveRequest.id,
            shift_id: newShiftId,
            insert_after_bin_id: insertAfterBinId || undefined,
            insert_position: insertPosition || undefined,
          });
          console.log('✅ [ACTIVE SHIFT WARNING] Assigned to shift');
        } else if (assignmentChanged && newUserId) {
          console.log('👤 [ACTIVE SHIFT WARNING] Assigning to user:', newUserId);
          await assignMoveToUser({
            move_request_id: moveRequest.id,
            user_id: newUserId,
          });
          console.log('✅ [ACTIVE SHIFT WARNING] Assigned to user');
        } else if (!assignmentChanged) {
          console.log('⏭️ [ACTIVE SHIFT WARNING] No assignment change, fields-only update completed');
        }
      } else {
        // Old-style: Just retry with confirmation flag (backward compatibility)
        const paramsWithConfirmation = {
          ...pendingUpdateParams,
          confirm_active_shift_change: true,
        };

        console.log('✏️ [EDIT MODE] Retrying with confirm_active_shift_change (legacy):', paramsWithConfirmation);
        await updateMoveRequest(moveRequest.id, paramsWithConfirmation);
      }

      console.log('✅ [EDIT MODE] Successfully updated move request after active shift confirmation');

      // Invalidate all move request queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      console.log('✅ [EDIT MODE] Invalidated all move request queries');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 [ACTIVE SHIFT WARNING] ALL OPERATIONS COMPLETED SUCCESSFULLY');
      console.log('   Calling onSuccess callback...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌❌❌ [ACTIVE SHIFT WARNING] CAUGHT ERROR IN TRY BLOCK');
      console.error('   Error type:', typeof error);
      console.error('   Error instanceof Error:', error instanceof Error);
      console.error('   Error message:', error instanceof Error ? error.message : String(error));
      console.error('   Error stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('   Full error object:', error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      alert(`Failed to update move. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🧹 [ACTIVE SHIFT WARNING] FINALLY BLOCK - Cleaning up...');
      console.log('   Setting isSubmitting to false...');
      setIsSubmitting(false);
      console.log('   Clearing pendingUpdateParams...');
      setPendingUpdateParams(null);
      console.log('   Clearing warningData...');
      setWarningData({});
      console.log('✅ [ACTIVE SHIFT WARNING] Cleanup complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 [ACTIVE SHIFT WARNING] handleActiveShiftConfirm() FINISHED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log(isEditing ? '✏️ [EDIT MODE]' : '🚀 [CREATE MODE]', 'Starting submission...');
    console.log('📋 [MOVE REQUEST] Assignment mode:', assignmentMode);
    console.log('👤 [MOVE REQUEST] Selected user ID:', selectedUserId);
    console.log('🚚 [MOVE REQUEST] Selected shift ID:', selectedShiftId);

    // EDIT MODE: Update existing move request
    if (isEditing && moveRequest) {
      console.log('✏️ [EDIT MODE] Updating move request:', moveRequest.id);

      setIsSubmitting(true);

      // Declare variables BEFORE try block so they're accessible in catch block
      let assignmentChanged = false;
      let oldShiftId: string | null = null;
      let oldUserId: string | null = null;
      let newShiftId: string | null = null;
      let newUserId: string | null = null;
      let baseUpdateParams: any = {};

      try {
        const scheduledDate = Math.floor(new Date(formData.scheduled_date).getTime() / 1000);

        // Prepare base update parameters (non-assignment fields)
        baseUpdateParams = {
          scheduled_date: scheduledDate,
          move_type: formData.move_type,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined,
          client_updated_at: moveRequest.updated_at, // For optimistic locking
        };

        // Add location fields if relocation
        if (formData.move_type === 'relocation') {
          baseUpdateParams.new_street = formData.new_street || undefined;
          baseUpdateParams.new_city = formData.new_city || undefined;
          baseUpdateParams.new_zip = formData.new_zip || undefined;
          baseUpdateParams.new_latitude = formData.new_latitude || undefined;
          baseUpdateParams.new_longitude = formData.new_longitude || undefined;
        }

        // Determine old and new assignment values
        oldShiftId = moveRequest.assigned_shift_id || null;
        oldUserId = moveRequest.assigned_user_id || null;
        newShiftId = (assignmentMode === 'active_shift' || assignmentMode === 'future_shift') && selectedShiftId ? selectedShiftId : null;
        newUserId = assignmentMode === 'user' && selectedUserId ? selectedUserId : null;

        // Detect if assignment changed
        assignmentChanged = (newShiftId !== oldShiftId || newUserId !== oldUserId);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 [ASSIGNMENT DETECTION]');
        console.log('   Assignment Mode:', assignmentMode);
        console.log('   Old assignment - Shift:', oldShiftId, 'User:', oldUserId);
        console.log('   New assignment - Shift:', newShiftId, 'User:', newUserId);
        console.log('   Assignment changed:', assignmentChanged);
        console.log('   Is unassigning:', assignmentChanged && !newShiftId && !newUserId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (assignmentChanged) {
          // Assignment changed - use specialized assignment APIs
          console.log('🔄 [EDIT MODE] Assignment changed, using specialized APIs');

          // First update non-assignment fields if needed
          if (Object.keys(baseUpdateParams).length > 1) { // More than just client_updated_at
            console.log('📝 [EDIT MODE] Updating non-assignment fields first:', baseUpdateParams);
            await updateMoveRequest(moveRequest.id, baseUpdateParams);
          }

          // Then handle assignment change
          if (newShiftId && newShiftId !== oldShiftId) {
            // Assigning to a shift (or changing shift)
            console.log('🚚 [EDIT MODE] Assigning to shift:', newShiftId);
            await assignMoveToShift({
              move_request_id: moveRequest.id,
              shift_id: newShiftId,
              insert_after_bin_id: assignmentMode === 'active_shift' ? insertAfterBinId || undefined : undefined,
              insert_position: assignmentMode === 'future_shift' ? insertPosition : undefined,
            });
          } else if (newUserId && newUserId !== oldUserId) {
            // Assigning to a user (or changing user)
            console.log('👤 [EDIT MODE] Assigning to user:', newUserId);
            await assignMoveToUser({
              move_request_id: moveRequest.id,
              user_id: newUserId,
            });
          } else if (!newShiftId && !newUserId) {
            // Unassigning (back to pending)
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⭕ [UNASSIGNMENT] Starting unassignment flow');
            console.log('   Move Request ID:', moveRequest.id);
            console.log('   Old Shift ID:', oldShiftId);
            console.log('   Old User ID:', oldUserId);
            console.log('   Old Assignment Type:', moveRequest.assignment_type);
            console.log('   Was on active shift:', moveRequest.status === 'in_progress');
            console.log('   Current status:', moveRequest.status);
            console.log('   Assigned driver:', moveRequest.assigned_driver_name);

            const unassignParams = {
              assigned_shift_id: '',
              assigned_user_id: '',
              assignment_type: '',
              client_updated_at: moveRequest.updated_at,
            };

            console.log('   Update params:', JSON.stringify(unassignParams, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            try {
              const result = await updateMoveRequest(moveRequest.id, unassignParams);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('✅ [UNASSIGNMENT] Successfully unassigned move request');
              console.log('   Updated move request:', result);
              console.log('   Backend should send WebSocket to driver:', oldShiftId);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } catch (error) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.error('❌ [UNASSIGNMENT] Failed to unassign');
              console.error('   Error:', error);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              throw error;
            }
          }
        } else {
          // Assignment didn't change - just update fields via standard update
          console.log('📝 [EDIT MODE] No assignment change, updating fields only');
          const updateParams = {
            ...baseUpdateParams,
            // Keep existing assignment
            assigned_shift_id: oldShiftId || '',
            assigned_user_id: oldUserId || '',
            assignment_type: moveRequest.assignment_type || '',
          };
          console.log('✏️ [EDIT MODE] Update parameters:', updateParams);
          await updateMoveRequest(moveRequest.id, updateParams);
        }

        console.log('✅ [EDIT MODE] Successfully updated move request');

        // Invalidate all move request queries to refresh the UI
        await queryClient.invalidateQueries({ queryKey: ['move-requests'] });
        console.log('✅ [EDIT MODE] Invalidated all move request queries');

        onSuccess?.();
        handleClose();
      } catch (error) {
        console.error('❌ [EDIT MODE] Failed to update move request:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check for in-progress warning (driver at location)
        if (errorMessage.includes('is currently at this location') || errorMessage.includes('Stop ')) {
          console.log('⚠️ [EDIT MODE] In-progress warning detected');

          // Parse driver name and waypoint info from error message
          // Example: "⚠️ Driver John Doe is currently at this location (Stop 3 of 8)..."
          const driverMatch = errorMessage.match(/Driver\s+(.+?)\s+is currently/);
          const waypointMatch = errorMessage.match(/\(Stop\s+\d+\s+of\s+\d+\)/);

          setWarningData({
            driverName: driverMatch ? driverMatch[1] : 'Unknown Driver',
            waypointInfo: waypointMatch ? waypointMatch[0].replace(/[()]/g, '') : 'Unknown position',
          });
          // Store structured data for retry (same as active shift warning)
          setPendingUpdateParams({
            assignmentChanged,
            newShiftId,
            newUserId,
            baseUpdateParams,
            insertAfterBinId,
            insertPosition,
          } as any);
          setShowInProgressWarning(true);
          setIsSubmitting(false);
          return;
        }

        // Check for active shift warning (case-insensitive)
        const lowerError = errorMessage.toLowerCase();
        if (lowerError.includes('active route') || lowerError.includes('active shift')) {
          console.log('⚠️ [EDIT MODE] Active shift warning detected');
          console.log('⚠️ [EDIT MODE] Full error message:', errorMessage);

          // Parse driver name from error message
          // Example: "⚠️ This move is on John Driver's active route..."
          // Support both regular apostrophe (') and fancy apostrophes (' ')
          const driverMatch = errorMessage.match(/on\s+(.+?)['']?'?s active/i);

          console.log('⚠️ [EDIT MODE] Driver match result:', driverMatch);
          console.log('⚠️ [EDIT MODE] Parsed driver name:', driverMatch ? driverMatch[1] : 'NO MATCH');
          console.log('⚠️ [EDIT MODE] Fallback driver name:', moveRequest.assigned_driver_name);

          const finalDriverName = driverMatch ? driverMatch[1] : moveRequest.assigned_driver_name || 'Unknown Driver';
          console.log('⚠️ [EDIT MODE] Final driver name for warning:', finalDriverName);

          setWarningData({
            driverName: finalDriverName,
          });
          // Store the original params for retry
          setPendingUpdateParams({
            assignmentChanged,
            newShiftId,
            newUserId,
            baseUpdateParams,
            insertAfterBinId,
            insertPosition,
          } as any);

          console.log('⚠️ [EDIT MODE] About to show active shift warning dialog');
          console.log('⚠️ [EDIT MODE] Warning data being set:', { driverName: finalDriverName });

          setShowActiveShiftWarning(true);
          setIsSubmitting(false);

          console.log('⚠️ [EDIT MODE] Active shift warning dialog state set to TRUE');
          return;
        }

        // For other errors, show alert
        alert(`Failed to update move. Error: ${errorMessage}`);
        setIsSubmitting(false);
      }
      return; // Exit early for edit mode
    }

    // ══════════════════════════════════════════════════════════════
    // CREATE MODE: Rest of the original create logic below
    // ══════════════════════════════════════════════════════════════

    console.log('📍 [CREATE MODE] Insert after bin ID:', insertAfterBinId);
    console.log('📦 [CREATE MODE] Target bins:', targetBins.length);

    // Validate bin selection in standalone mode
    if (isStandalone && selectedBins.length === 0) {
      alert('Please select at least one bin to schedule a move request.');
      return;
    }

    // Validate assignment options
    if (assignmentMode === 'user' && !selectedUserId) {
      alert('Please select a user to assign to.');
      return;
    }

    if ((assignmentMode === 'active_shift' || assignmentMode === 'future_shift') && !selectedShiftId) {
      alert('Please select a shift to assign to.');
      return;
    }

    if (assignmentMode === 'active_shift' && !insertAfterBinId) {
      alert('Please select where to insert the move(s) in the active route.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert date string to Unix timestamp
      const scheduledDate = Math.floor(new Date(formData.scheduled_date).getTime() / 1000);
      console.log('📅 [CREATE MODE] Scheduled date:', scheduledDate, new Date(formData.scheduled_date));

      // Create move requests for each target bin
      const createdMoveRequestIds: string[] = [];
      for (const targetBin of targetBins) {
        console.log('📦 [CREATE MODE] Creating move request for bin:', targetBin.bin_number);
        const moveRequest = await createMoveRequest({
          bin_id: targetBin.id,
          scheduled_date: scheduledDate,
          move_type: formData.move_type,
          new_street: formData.move_type === 'relocation' ? formData.new_street : undefined,
          new_city: formData.move_type === 'relocation' ? formData.new_city : undefined,
          new_zip: formData.move_type === 'relocation' ? formData.new_zip : undefined,
          new_latitude: formData.move_type === 'relocation' && formData.new_latitude ? formData.new_latitude : undefined,
          new_longitude: formData.move_type === 'relocation' && formData.new_longitude ? formData.new_longitude : undefined,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined,
        });
        console.log('✅ [CREATE MODE] Created move request:', moveRequest.id);
        createdMoveRequestIds.push(moveRequest.id);
      }

      console.log('✅ [CREATE MODE] All move requests created:', createdMoveRequestIds);

      // Handle assignment based on mode
      if (assignmentMode === 'user' && selectedUserId) {
        console.log('👤 [ASSIGNMENT] Assigning to user:', selectedUserId);
        // Assign to user (one-off)
        for (const moveRequestId of createdMoveRequestIds) {
          console.log('👤 [ASSIGNMENT] Assigning move request:', moveRequestId);
          try {
            await assignMoveToUser({
              move_request_id: moveRequestId,
              user_id: selectedUserId,
            });
            console.log('✅ [ASSIGNMENT] Successfully assigned move request to user:', moveRequestId);
          } catch (assignError) {
            console.error('❌ [ASSIGNMENT] Failed to assign move request to user:', moveRequestId, assignError);
            throw assignError;
          }
        }
      } else if ((assignmentMode === 'active_shift' || assignmentMode === 'future_shift') && selectedShiftId) {
        console.log('🚚 [ASSIGNMENT] Assigning to shift:', selectedShiftId);
        // Assign to shift
        for (const moveRequestId of createdMoveRequestIds) {
          console.log('🚚 [ASSIGNMENT] Assigning move request:', moveRequestId);
          try {
            await assignMoveToShift({
              move_request_id: moveRequestId,
              shift_id: selectedShiftId,
              insert_after_bin_id: assignmentMode === 'active_shift' ? insertAfterBinId || undefined : undefined,
              insert_position: assignmentMode === 'future_shift' ? insertPosition : undefined,
            });
            console.log('✅ [ASSIGNMENT] Successfully assigned move request to shift:', moveRequestId);
          } catch (assignError) {
            console.error('❌ [ASSIGNMENT] Failed to assign move request to shift:', moveRequestId, assignError);
            throw assignError;
          }
        }
      } else {
        console.log('⏭️ [ASSIGNMENT] Skipping assignment - mode is unassigned');
      }

      console.log('🎉 [CREATE MODE] Submission complete!');

      // Invalidate all move request queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      console.log('✅ [CREATE MODE] Invalidated all move request queries');

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('❌ [CREATE MODE] Failed to create move request:', error);
      console.error('❌ [CREATE MODE] Error details:', JSON.stringify(error, null, 2));
      alert(`Failed to schedule move. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return typeof window !== 'undefined' ? createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-0 md:p-4">
        <Card
          className={`w-full md:max-w-2xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto md:m-4 md:rounded-2xl rounded-none pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 md:p-6 relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 md:mb-6">
            <div className="flex-1 mr-2">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                {isEditing
                  ? 'Edit Move Request'
                  : selectedBins.length > 1
                  ? 'Schedule Bulk Moves'
                  : 'Schedule Bin Move'}
              </h2>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {isEditing
                  ? moveRequest?.bin_number
                    ? `Bin ${moveRequest.bin_number} - ${moveRequest.bin_street || 'Unknown location'}`
                    : 'Loading bin details...'
                  : selectedBins.length > 1
                  ? `${selectedBins.length} bins selected`
                  : selectedBins.length === 1
                  ? `Bin ${selectedBins[0].bin_number} - ${selectedBins[0].current_street}`
                  : 'Select bin(s) to schedule move request(s)'}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Bin Selector (Standalone Mode Only - Hidden in Edit Mode) */}
          {isStandalone && !isEditing && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bin *
              </label>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by bin #, street, city, or zip..."
                  value={binSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBinSearchQuery(value);
                    // Only show dropdown when there's input
                    if (value.length > 0) {
                      setShowBinDropdown(true);
                    } else {
                      setShowBinDropdown(false);
                    }
                  }}
                  onClick={() => {
                    // Show dropdown on click only if there's already text
                    if (binSearchQuery.length > 0) {
                      setShowBinDropdown(true);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* Dropdown Results */}
              {showBinDropdown && (
                <>
                  {/* Click outside to close dropdown - positioned BEHIND dropdown */}
                  <div
                    className="fixed inset-0 z-[5]"
                    onClick={() => setShowBinDropdown(false)}
                  />

                  {/* Dropdown with animation and higher z-index */}
                  <div className="relative z-[10] mt-2 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl animate-slide-in-down">
                    {binsLoading ? (
                      <div className="p-4 text-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading bins...
                      </div>
                    ) : availableBins && availableBins.length > 0 ? (
                      <div className="py-2">
                        {availableBins.slice(0, 50).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Add bin to selection
                              setSelectedBins([...selectedBins, b]);
                              // Clear search and close dropdown
                              setBinSearchQuery('');
                              setShowBinDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-all duration-150 border-b border-gray-100 last:border-b-0 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-900">Bin #{b.bin_number}</span>
                                  {b.fill_percentage !== null && (
                                    <span className={cn(
                                      'text-xs px-2 py-0.5 rounded-full font-medium',
                                      b.fill_percentage >= 80 ? 'bg-red-100 text-red-700' :
                                      b.fill_percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                    )}>
                                      {b.fill_percentage}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">{b.current_street}</div>
                                <div className="text-xs text-gray-500">{b.city}, {b.zip}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                        {availableBins.length > 50 && (
                          <div className="px-4 py-2 text-xs text-gray-500 text-center bg-gray-50">
                            Showing first 50 results. Refine your search to see more.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No available bins found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {binSearchQuery ? 'Try a different search' : 'All bins may already have pending move requests'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Selected Bins Display (shown in bulk mode or when editing with bin info) */}
          {(selectedBins.length > 1 || (isEditing && moveRequest?.bin_number)) && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isEditing ? 'Bin' : `Selected Bins (${selectedBins.length})`}
              </label>
              <div className="flex flex-wrap gap-2">
                {isEditing && moveRequest ? (
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border-2 border-gray-300 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">Bin #{moveRequest.bin_number}</span>
                      {moveRequest.bin_fill_percentage !== null && moveRequest.bin_fill_percentage !== undefined && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded-full font-medium',
                          moveRequest.bin_fill_percentage >= 80 ? 'bg-red-100 text-red-700' :
                          moveRequest.bin_fill_percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        )}>
                          {moveRequest.bin_fill_percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  selectedBins.map((selectedBin) => (
                    <div
                      key={selectedBin.id}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border-2 border-blue-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">Bin #{selectedBin.bin_number}</span>
                        {selectedBin.fill_percentage !== null && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full font-medium',
                            selectedBin.fill_percentage >= 80 ? 'bg-red-100 text-red-700' :
                            selectedBin.fill_percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {selectedBin.fill_percentage}%
                          </span>
                        )}
                      </div>
                      {/* Only show remove button in standalone create mode (not edit mode) */}
                      {isStandalone && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBins(selectedBins.filter((b) => b.id !== selectedBin.id));
                          }}
                          className="p-0.5 hover:bg-blue-200 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* When to Move */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When should this be moved? *
              </label>

              {/* Quick Date Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('24h')}
                  className={`px-2 md:px-3 py-2 text-xs md:text-sm border-2 rounded-lg transition-colors ${
                    dateOption === '24h'
                      ? 'border-red-500 bg-red-50 text-red-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Within 24hrs
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('3days')}
                  className={`px-2 md:px-3 py-2 text-xs md:text-sm border-2 rounded-lg transition-colors ${
                    dateOption === '3days'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Within 3 days
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('week')}
                  className={`px-2 md:px-3 py-2 text-xs md:text-sm border-2 rounded-lg transition-colors ${
                    dateOption === 'week'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Next week
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('custom')}
                  className={`px-2 md:px-3 py-2 text-xs md:text-sm border-2 rounded-lg transition-colors ${
                    dateOption === 'custom'
                      ? 'border-primary bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Custom date
                </button>
              </div>

              {/* Date Picker (always visible) */}
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => {
                  setFormData({ ...formData, scheduled_date: e.target.value });
                  setDateOption('custom');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Move Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Move Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, move_type: 'store' })}
                  className={`p-3 md:p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.move_type === 'store'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm md:text-base text-gray-900">Store in Warehouse</div>
                  <div className="text-xs md:text-sm text-gray-600">Pick up and store for future use</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, move_type: 'relocation' })}
                  className={`p-3 md:p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.move_type === 'relocation'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm md:text-base text-gray-900">Relocation</div>
                  <div className="text-xs md:text-sm text-gray-600">Move to new address</div>
                </button>
              </div>
            </div>

            {/* New Location (for relocation) */}
            {formData.move_type === 'relocation' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  New Location
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <PlacesAutocomplete
                    value={formData.new_street}
                    onChange={(value) => {
                      setFormData({ ...formData, new_street: value });
                      // Reset auto-filled state when user types
                      setNewLocationAutoFilled({ street: false, city: false, zip: false });
                    }}
                    onPlaceSelect={handleNewLocationPlaceSelect}
                    placeholder="123 Main Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      required={formData.move_type === 'relocation'}
                      value={formData.new_city}
                      onChange={(e) => {
                        setFormData({ ...formData, new_city: e.target.value });
                        setNewLocationAutoFilled({ ...newLocationAutoFilled, city: false });
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary transition-colors text-sm",
                        newLocationAutoFilled.city ? "bg-blue-50 border-blue-300" : "bg-white border-gray-300"
                      )}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                      ZIP *
                    </label>
                    <input
                      type="text"
                      required={formData.move_type === 'relocation'}
                      value={formData.new_zip}
                      onChange={(e) => {
                        setFormData({ ...formData, new_zip: e.target.value });
                        setNewLocationAutoFilled({ ...newLocationAutoFilled, zip: false });
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary transition-colors text-sm",
                        newLocationAutoFilled.zip ? "bg-blue-50 border-blue-300" : "bg-white border-gray-300"
                      )}
                      placeholder="ZIP"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Why is this move needed?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Additional details..."
              />
            </div>

            {/* Assignment Section - Unified for both Store and Relocation */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAssignmentSection(!showAssignmentSection)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-900">
                      Assignment (Optional)
                    </span>
                    {assignmentMode !== 'unassigned' && (
                      <Badge className="bg-primary text-white text-xs">
                        {assignmentMode === 'user' ? 'User Assigned' :
                         assignmentMode === 'active_shift' ? 'Active Shift' : 'Future Shift'}
                      </Badge>
                    )}
                  </div>
                  {showAssignmentSection ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                {showAssignmentSection && (
                <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
                  {/* Assignment Mode Radio Buttons */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Choose Assignment Type
                    </label>

                    {/* Leave Unassigned */}
                    <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-white">
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="unassigned"
                        checked={assignmentMode === 'unassigned'}
                        onChange={() => setAssignmentMode('unassigned')}
                        className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Leave Unassigned</div>
                        <div className="text-sm text-gray-600">Assign to driver later</div>
                      </div>
                    </label>

                    {/* Assign to User */}
                    <label className={cn(
                      "flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-white",
                      assignmentMode === 'user' && "border-primary bg-blue-50"
                    )}>
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="user"
                        checked={assignmentMode === 'user'}
                        onChange={() => setAssignmentMode('user')}
                        className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span className="font-medium text-gray-900">Assign to User (one-off)</span>
                        </div>
                        <div className="text-sm text-gray-600">Manual one-time assignment</div>
                      </div>
                    </label>

                    {/* Assign to Active Shift */}
                    <label className={cn(
                      "flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-white",
                      assignmentMode === 'active_shift' && "border-primary bg-blue-50"
                    )}>
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="active_shift"
                        checked={assignmentMode === 'active_shift'}
                        onChange={() => setAssignmentMode('active_shift')}
                        className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          <span className="font-medium text-gray-900">Assign to Active Shift</span>
                        </div>
                        <div className="text-sm text-gray-600">Add to driver currently on route</div>
                      </div>
                    </label>

                    {/* Assign to Future Shift */}
                    <label className={cn(
                      "flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-white",
                      assignmentMode === 'future_shift' && "border-primary bg-blue-50"
                    )}>
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="future_shift"
                        checked={assignmentMode === 'future_shift'}
                        onChange={() => setAssignmentMode('future_shift')}
                        className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium text-gray-900">Assign to Future Shift</span>
                        </div>
                        <div className="text-sm text-gray-600">Add to upcoming scheduled shift</div>
                      </div>
                    </label>
                  </div>

                  {/* Conditional: User Selection */}
                  {assignmentMode === 'user' && (
                    <div className="pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select User *
                      </label>
                      {usersLoading ? (
                        <div className="text-center py-8 bg-white rounded-lg">
                          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Loading users...</p>
                        </div>
                      ) : users && users.length > 0 ? (
                        <div className="space-y-2">
                          {users.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => setSelectedUserId(user.id)}
                              className={cn(
                                'w-full text-left p-4 rounded-xl border-2 transition-all',
                                selectedUserId === user.id
                                  ? 'border-primary bg-white'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <User className="w-4 h-4 text-gray-600" />
                                <div>
                                  <div className="font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-sm text-gray-500 capitalize">{user.role}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white rounded-lg">
                          <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No users found</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conditional: Shift Selection (Active or Future) */}
                  {(assignmentMode === 'active_shift' || assignmentMode === 'future_shift') && (
                    <div className="pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Shift *
                      </label>
                      {shiftsLoading ? (
                        <div className="text-center py-8 bg-white rounded-lg">
                          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Loading shifts...</p>
                        </div>
                      ) : shifts && shifts.filter(s =>
                          assignmentMode === 'active_shift' ? s.status === 'active' : s.status !== 'active'
                        ).length > 0 ? (
                        <div className="space-y-2">
                          {shifts
                            .filter(s => assignmentMode === 'active_shift' ? s.status === 'active' : s.status !== 'active')
                            .map((shift) => {
                              const isActive = shift.status === 'active';
                              const isSelected = selectedShiftId === shift.id;

                              return (
                            <button
                              key={shift.id}
                              type="button"
                              onClick={() => {
                                setSelectedShiftId(shift.id);
                                setInsertAfterBinId(''); // Reset selection when changing shifts
                              }}
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
                                        isActive
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-blue-100 text-blue-700'
                                      )}
                                    >
                                      {isActive ? 'Active Now' : 'Future Shift'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {shift.date} • {shift.startTime}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm text-gray-500">
                                    {shift.binCount} bins • {shift.binsCollected || 0} completed
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No available shifts found</p>
                        <p className="text-xs text-gray-400 mt-1">Create a shift first</p>
                      </div>
                    )}
                    </div>
                  )}

                  {/* Position Selection - Future Shift */}
                  {assignmentMode === 'future_shift' && selectedShiftId && (
                    <div className="pt-4">
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                        Insert Position *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setInsertPosition('start')}
                          className={cn(
                            'p-3 md:p-4 rounded-xl border-2 text-left transition-all',
                            insertPosition === 'start'
                              ? 'border-primary bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className="font-semibold text-sm md:text-base text-gray-900 mb-1">At Start</div>
                          <div className="text-xs md:text-sm text-gray-600">
                            Insert at the beginning of the route
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInsertPosition('end')}
                          className={cn(
                            'p-3 md:p-4 rounded-xl border-2 text-left transition-all',
                            insertPosition === 'end'
                              ? 'border-primary bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className="font-semibold text-sm md:text-base text-gray-900 mb-1">At End</div>
                          <div className="text-xs md:text-sm text-gray-600">
                            Insert at the end of the route
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Position Selection - Active Shift */}
                  {assignmentMode === 'active_shift' && selectedShiftId && (
                    <div className="pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Insert After Bin *
                      </label>
                      <div className="space-y-2 bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                        {remainingBins.length > 0 ? (
                          remainingBins.map((bin, index) => (
                            <button
                              key={bin.bin_id}
                              type="button"
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
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      Bin #{bin.bin_number}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Insert after this bin
                                    </div>
                                  </div>
                                </div>
                                <MapPin className="w-4 h-4 text-gray-400" />
                              </div>
                            </button>
                          ))
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
              )}
              </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 w-full">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 w-full bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  isEditing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
                  )
                ) : isEditing ? (
                  <><Calendar className="w-4 h-4 mr-2" />Save Changes</>
                ) : (
                  <><Calendar className="w-4 h-4 mr-2" />Schedule Move</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
      </div>

      {/* Warning Modals */}
      {showInProgressWarning && warningData.driverName && warningData.waypointInfo && (
        <InProgressWarningModal
          driverName={warningData.driverName}
          waypointInfo={warningData.waypointInfo}
          onClose={() => {
            setShowInProgressWarning(false);
            setPendingUpdateParams(null);
            setWarningData({});
            setIsSubmitting(false);
          }}
          onConfirm={handleInProgressConfirm}
        />
      )}

      {showActiveShiftWarning && warningData.driverName && (
        <ActiveShiftWarningModal
          driverName={warningData.driverName}
          onClose={() => {
            setShowActiveShiftWarning(false);
            setPendingUpdateParams(null);
            setWarningData({});
            setIsSubmitting(false);
          }}
          onConfirm={handleActiveShiftConfirm}
        />
      )}
    </>,
    document.body
  ) : null;
}

// In-Progress Warning Modal
interface InProgressWarningModalProps {
  driverName: string;
  waypointInfo: string; // e.g., "Stop 3 of 8"
  onClose: () => void;
  onConfirm: (action: 'remove_from_route' | 'insert_after_current' | 'reoptimize_route') => void;
}

export function InProgressWarningModal({ driverName, waypointInfo, onClose, onConfirm }: InProgressWarningModalProps) {
  const [selectedAction, setSelectedAction] = useState<'remove_from_route' | 'insert_after_current' | 'reoptimize_route'>('insert_after_current');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleConfirm = () => {
    onConfirm(selectedAction);
    handleClose();
  };

  return typeof window !== 'undefined' ? createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none p-0 md:p-4">
        <Card
          className={`w-full md:max-w-lg h-full md:h-auto m-0 md:m-4 md:rounded-2xl rounded-none pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 md:gap-3 flex-1">
                <div className="p-1.5 md:p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-xl font-bold text-gray-900">Driver at Location</h2>
                  <p className="text-xs md:text-sm text-gray-600">Action required for in-progress move</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-900">
                <span className="font-semibold">{driverName}</span> is currently at this location ({waypointInfo}).
                What should happen to this bin in their route?
              </p>
            </div>

            {/* Action Selection */}
            <div className="space-y-3 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Action *
              </label>

              {/* Remove from Route */}
              <label className={cn(
                "flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50",
                selectedAction === 'remove_from_route' && "border-primary bg-blue-50"
              )}>
                <input
                  type="radio"
                  name="inProgressAction"
                  value="remove_from_route"
                  checked={selectedAction === 'remove_from_route'}
                  onChange={() => setSelectedAction('remove_from_route')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Remove from Route</div>
                  <div className="text-sm text-gray-600">
                    Remove this bin from the driver's route immediately
                  </div>
                </div>
              </label>

              {/* Insert After Current */}
              <label className={cn(
                "flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50",
                selectedAction === 'insert_after_current' && "border-primary bg-blue-50"
              )}>
                <input
                  type="radio"
                  name="inProgressAction"
                  value="insert_after_current"
                  checked={selectedAction === 'insert_after_current'}
                  onChange={() => setSelectedAction('insert_after_current')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Insert After Current Bin</div>
                  <div className="text-sm text-gray-600">
                    Keep in route, insert right after the driver finishes this bin
                  </div>
                </div>
              </label>

              {/* Re-optimize Route */}
              <label className={cn(
                "flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50",
                selectedAction === 'reoptimize_route' && "border-primary bg-blue-50"
              )}>
                <input
                  type="radio"
                  name="inProgressAction"
                  value="reoptimize_route"
                  checked={selectedAction === 'reoptimize_route'}
                  onChange={() => setSelectedAction('reoptimize_route')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Re-optimize Route</div>
                  <div className="text-sm text-gray-600">
                    Smart re-order remaining bins for optimal route efficiency
                  </div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 w-full">
                Cancel
              </Button>
              <Button onClick={handleConfirm} className="flex-1 w-full bg-primary hover:bg-primary/90">
                <Route className="w-4 h-4 mr-2" />
                Confirm Changes
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>,
    document.body
  ) : null;
}

// Active Shift Warning Modal
interface ActiveShiftWarningModalProps {
  driverName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ActiveShiftWarningModal({ driverName, onClose, onConfirm }: ActiveShiftWarningModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleConfirm = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔘 [ACTIVE SHIFT MODAL] Confirm button CLICKED');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Checkbox confirmed:', confirmed);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!confirmed) {
      console.log('⚠️ [ACTIVE SHIFT MODAL] User did not check the confirmation checkbox');
      alert('Please confirm that you understand this will affect the active route.');
      return;
    }

    console.log('✅ [ACTIVE SHIFT MODAL] Calling onConfirm callback...');
    console.log('   onConfirm function exists:', typeof onConfirm);
    onConfirm();
    console.log('✅ [ACTIVE SHIFT MODAL] onConfirm callback completed');
    console.log('🚪 [ACTIVE SHIFT MODAL] Closing modal...');
    handleClose();
  };

  return typeof window !== 'undefined' ? createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none p-0 md:p-4">
        <Card
          className={`w-full md:max-w-lg h-full md:h-auto m-0 md:m-4 md:rounded-2xl rounded-none pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 md:gap-3 flex-1">
                <div className="p-1.5 md:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                  <Truck className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-xl font-bold text-gray-900">Active Route Change</h2>
                  <p className="text-xs md:text-sm text-gray-600">This will affect driver's navigation</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900 mb-3">
                <span className="font-semibold">{driverName}</span> is currently on route with this move assigned.
              </p>
              <p className="text-sm text-yellow-900">
                Editing this move request will update their active navigation and route. The driver will be notified of the changes.
              </p>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all mb-6">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <div className="flex-1 text-sm text-gray-900">
                I understand this will modify the driver's active route and they will be notified of the change
              </div>
            </label>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 w-full">
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!confirmed}
                className={cn(
                  "flex-1 w-full",
                  confirmed ? "bg-primary hover:bg-primary/90" : "bg-gray-300 cursor-not-allowed"
                )}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Confirm Changes
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>,
    document.body
  ) : null;
}

// Retire Bin Modal
interface RetireBinModalProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function RetireBinModal({ bin, bins, onClose, onSuccess }: RetireBinModalProps) {
  const isBulk = bins && bins.length > 0;
  const targetBins = isBulk ? bins : bin ? [bin] : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    disposal_action: 'retire' as 'retire' | 'store',
    reason: '',
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Implement API call to retire bin
    alert('Retire bin API not yet connected - coming in next phase!');

    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess?.();
      handleClose();
    }, 1000);
  };

  return typeof window !== 'undefined' ? createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-0 md:p-4">
        <Card
          className={`w-full md:max-w-md h-full md:h-auto m-0 md:m-4 md:rounded-2xl rounded-none pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 md:mb-6">
            <div className="flex-1 mr-2">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                {isBulk ? 'Retire Multiple Bins' : 'Retire Bin'}
              </h2>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {isBulk
                  ? `${targetBins.length} bins selected`
                  : bin
                  ? `Bin ${bin.bin_number} - ${bin.current_street}`
                  : ''}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {isBulk
                  ? `These ${targetBins.length} bins will be removed from active service. You can still view them in the system.`
                  : 'This bin will be removed from active service. You can still view it in the system.'}
              </p>
            </div>

            {/* Disposal Action */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Action *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, disposal_action: 'retire' })}
                  className={`p-3 md:p-4 border-2 rounded-lg text-center transition-colors ${
                    formData.disposal_action === 'retire'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm md:text-base text-gray-900">Retire</div>
                  <div className="text-xs text-gray-600">Permanently remove</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, disposal_action: 'store' })}
                  className={`p-3 md:p-4 border-2 rounded-lg text-center transition-colors ${
                    formData.disposal_action === 'store'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm md:text-base text-gray-900">Store</div>
                  <div className="text-xs text-gray-600">Keep in warehouse</div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <textarea
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Why is this bin being retired?"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 w-full">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retiring...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" />Retire Bin</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
      </div>
    </>,
    document.body
  ) : null;
}
