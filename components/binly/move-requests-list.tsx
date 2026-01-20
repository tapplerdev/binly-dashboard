'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMoveRequests, updateMoveRequest, bulkCancelMoves, cancelMoveRequest, clearMoveAssignment } from '@/lib/api/move-requests';
import {
  MoveRequest,
  MoveRequestStatus,
  getMoveRequestUrgency,
  getMoveRequestBadgeColor,
} from '@/lib/types/bin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/binly/kpi-card';
import { Dropdown, MultiSelectDropdown } from '@/components/ui/dropdown';
import { AssignMovesModal } from '@/components/binly/assign-moves-modal';
import { ScheduleMoveModal } from '@/components/binly/bin-modals';
import {
  Calendar,
  Clock,
  Package,
  AlertTriangle,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  X as XIcon,
  Truck,
  MapPin,
  CheckCircle,
  Trash2,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortColumn = 'bin_number' | 'scheduled_date' | 'urgency' | 'status' | 'assigned_driver_name';

export function MoveRequestsList() {
  // State
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MoveRequestStatus | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoves, setSelectedMoves] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showScheduleMoveModal, setShowScheduleMoveModal] = useState(false);
  const [showBulkEditDateModal, setShowBulkEditDateModal] = useState(false);
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [showSingleCancelModal, setShowSingleCancelModal] = useState(false);
  const [bulkEditDate, setBulkEditDate] = useState('');
  const [movesToAssign, setMovesToAssign] = useState<MoveRequest[]>([]); // For single or bulk assignment
  const [moveToEdit, setMoveToEdit] = useState<MoveRequest | null>(null); // For editing individual move
  const [moveToCancel, setMoveToCancel] = useState<MoveRequest | null>(null); // For canceling individual move

  // Fetch all move requests
  const { data: allMoves, isLoading, error, refetch } = useQuery({
    queryKey: ['move-requests', 'all'],
    queryFn: () => getMoveRequests({ status: 'all', limit: 1000 }),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Calculate KPIs
  const urgentCount = useMemo(() => {
    return allMoves?.filter((m) => {
      const urgency = getMoveRequestUrgency(m.scheduled_date);
      return m.status !== 'completed' && m.status !== 'cancelled' && urgency === 'urgent';
    }).length || 0;
  }, [allMoves]);

  const pendingCount = useMemo(() => {
    return allMoves?.filter((m) => m.status === 'pending').length || 0;
  }, [allMoves]);

  const activeCount = useMemo(() => {
    return allMoves?.filter((m) => m.status === 'in_progress').length || 0;
  }, [allMoves]);

  const overdueCount = useMemo(() => {
    return allMoves?.filter((m) => {
      const urgency = getMoveRequestUrgency(m.scheduled_date);
      return m.status !== 'completed' && m.status !== 'cancelled' && urgency === 'overdue';
    }).length || 0;
  }, [allMoves]);

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Client-side filtering
  const filteredMoves = useMemo(() => {
    return allMoves
      ?.filter((move) => {
        // Status filter
        if (statusFilter !== 'all' && move.status !== statusFilter) {
          return false;
        }

        // Assigned filter
        if (assignedFilter === 'assigned' && !move.assigned_shift_id) {
          return false;
        }
        if (assignedFilter === 'unassigned' && move.assigned_shift_id) {
          return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            move.bin_number.toString().includes(query) ||
            move.current_street.toLowerCase().includes(query) ||
            move.city.toLowerCase().includes(query) ||
            move.zip.toLowerCase().includes(query) ||
            move.assigned_driver_name?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Manual column sorting if set
        if (sortColumn) {
          let comparison = 0;

          switch (sortColumn) {
            case 'bin_number':
              comparison = a.bin_number - b.bin_number;
              break;
            case 'scheduled_date':
              comparison = a.scheduled_date - b.scheduled_date;
              break;
            case 'urgency': {
              const aUrgency = getMoveRequestUrgency(a.scheduled_date);
              const bUrgency = getMoveRequestUrgency(b.scheduled_date);
              const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, scheduled: 3 };
              comparison = urgencyOrder[aUrgency] - urgencyOrder[bUrgency];
              break;
            }
            case 'status':
              comparison = a.status.localeCompare(b.status);
              break;
            case 'assigned_driver_name':
              comparison = (a.assigned_driver_name || '').localeCompare(b.assigned_driver_name || '');
              break;
          }

          return sortDirection === 'asc' ? comparison : -comparison;
        }

        // Default auto-sort by urgency then by date
        const aUrgency = getMoveRequestUrgency(a.scheduled_date);
        const bUrgency = getMoveRequestUrgency(b.scheduled_date);

        const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, scheduled: 3 };
        const aOrder = urgencyOrder[aUrgency];
        const bOrder = urgencyOrder[bUrgency];

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        // If same urgency, sort by date (soonest first)
        return a.scheduled_date - b.scheduled_date;
      });
  }, [allMoves, statusFilter, assignedFilter, searchQuery, sortColumn, sortDirection]);

  // Multi-select handlers
  const handleSelectMove = (moveId: string) => {
    const newSelected = new Set(selectedMoves);
    if (newSelected.has(moveId)) {
      newSelected.delete(moveId);
    } else {
      newSelected.add(moveId);
    }
    setSelectedMoves(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMoves.size === filteredMoves?.length) {
      setSelectedMoves(new Set());
    } else {
      setSelectedMoves(new Set(filteredMoves?.map((m) => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedMoves(new Set());
  };

  // Get selected move requests
  const getSelectedMoveRequests = (): MoveRequest[] => {
    return filteredMoves?.filter((m) => selectedMoves.has(m.id)) || [];
  };

  // Bulk edit date mutation
  const bulkEditDateMutation = useMutation({
    mutationFn: async (newDate: string) => {
      const scheduledDate = Math.floor(new Date(newDate).getTime() / 1000);
      const selectedMoveIds = Array.from(selectedMoves);

      for (const id of selectedMoveIds) {
        await updateMoveRequest(id, { scheduled_date: scheduledDate });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      alert(`Successfully updated ${selectedMoves.size} move request(s)`);
      clearSelection();
      setShowBulkEditDateModal(false);
      setBulkEditDate('');
    },
    onError: (error) => {
      console.error('Failed to update move requests:', error);
      alert('Failed to update move requests. Please try again.');
    },
  });

  // Bulk cancel mutation
  const bulkCancelMutation = useMutation({
    mutationFn: async () => {
      const selectedMoveIds = Array.from(selectedMoves);
      await bulkCancelMoves(selectedMoveIds, 'Bulk cancelled by manager');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      alert(`Successfully cancelled ${selectedMoves.size} move request(s)`);
      clearSelection();
      setShowBulkCancelModal(false);
    },
    onError: (error) => {
      console.error('Failed to cancel move requests:', error);
      alert('Failed to cancel move requests. Please try again.');
    },
  });

  // Single cancel mutation
  const singleCancelMutation = useMutation({
    mutationFn: async (moveId: string) => {
      await cancelMoveRequest(moveId, 'Cancelled by manager');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      alert('Move request cancelled successfully');
      setShowSingleCancelModal(false);
      setMoveToCancel(null);
      setOpenMenuId(null);
    },
    onError: (error) => {
      console.error('Failed to cancel move request:', error);
      alert('Failed to cancel move request. Please try again.');
    },
  });

  // Clear assignment mutation
  const clearAssignmentMutation = useMutation({
    mutationFn: async (moveId: string) => {
      await clearMoveAssignment(moveId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      alert('Assignment cleared successfully');
      setOpenMenuId(null);
    },
    onError: (error) => {
      console.error('Failed to clear assignment:', error);
      alert(error.message || 'Failed to clear assignment. Please try again.');
    },
  });

  // Check if selection has mixed assigned/unassigned moves
  const selectedMovesArray = getSelectedMoveRequests();
  const hasAssignedMoves = selectedMovesArray.some(m => m.assigned_shift_id);
  const hasUnassignedMoves = selectedMovesArray.some(m => !m.assigned_shift_id);
  const hasMixedSelection = hasAssignedMoves && hasUnassignedMoves;

  // Handlers for individual row assignment
  const handleSingleAssign = (move: MoveRequest) => {
    setMovesToAssign([move]);
    setShowAssignModal(true);
  };

  // Handle three-dot menu open
  const handleMenuOpen = (moveId: string, buttonElement: HTMLButtonElement) => {
    if (openMenuId === moveId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = buttonElement.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.right + window.scrollX - 160, // 160px is the menu width
      });
      setOpenMenuId(moveId);
    }
  };

  // Handlers for individual row menu actions
  const handleEditDetails = (move: MoveRequest) => {
    setMoveToEdit(move);
    setShowScheduleMoveModal(true);
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleClearAssignment = (move: MoveRequest) => {
    setOpenMenuId(null);
    setMenuPosition(null);
    if (confirm('Are you sure you want to clear the shift assignment for this move request?')) {
      clearAssignmentMutation.mutate(move.id);
    }
  };

  const handleCancelMove = (move: MoveRequest) => {
    setMoveToCancel(move);
    setShowSingleCancelModal(true);
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleConfirmSingleCancel = () => {
    if (moveToCancel) {
      singleCancelMutation.mutate(moveToCancel.id);
    }
  };

  // Handlers for bulk operations
  const handleBulkAssign = () => {
    if (hasMixedSelection) {
      alert('Cannot bulk assign: You have selected both assigned and unassigned move requests. Please select only unassigned moves to bulk assign.');
      return;
    }
    setMovesToAssign(selectedMovesArray);
    setShowAssignModal(true);
  };

  const handleBulkEditDate = () => {
    setShowBulkEditDateModal(true);
  };

  const handleBulkCancel = () => {
    setShowBulkCancelModal(true);
  };

  const handleBulkEditDateSubmit = () => {
    if (!bulkEditDate) {
      alert('Please select a date');
      return;
    }
    bulkEditDateMutation.mutate(bulkEditDate);
  };

  const handleBulkCancelConfirm = () => {
    bulkCancelMutation.mutate();
  };

  // Get urgency badge
  const getUrgencyBadge = (move: MoveRequest) => {
    const urgency = getMoveRequestUrgency(move.scheduled_date);
    const colors = getMoveRequestBadgeColor(move.scheduled_date);

    const labels = {
      overdue: '⚠️ Overdue',
      urgent: '🔴 Urgent',
      soon: 'Move Soon',
      scheduled: 'Scheduled',
    };

    return (
      <Badge className={cn('font-semibold whitespace-nowrap', colors)}>
        {labels[urgency]}
      </Badge>
    );
  };

  // Get status badge
  const getStatusBadge = (status: MoveRequestStatus) => {
    const config = {
      pending: { label: 'Pending', color: 'bg-gray-500 text-white' },
      assigned: { label: 'Assigned', color: 'bg-blue-500 text-white' },
      in_progress: { label: 'In Progress', color: 'bg-amber-500 text-white' },
      completed: { label: 'Completed', color: 'bg-green-500 text-white' },
      cancelled: { label: 'Cancelled', color: 'bg-gray-400 text-white' },
      overdue: { label: 'Overdue', color: 'bg-red-500 text-white' },
    };

    const { label, color } = config[status];
    return <Badge className={cn('font-semibold whitespace-nowrap', color)}>{label}</Badge>;
  };

  // Loading state
  if (isLoading && !allMoves) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Loading move requests...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold mb-2">Failed to load move requests</p>
          <p className="text-gray-500 text-sm mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Urgent"
          value={urgentCount.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-red-100 text-red-600"
          onClick={() => {
            setStatusFilter('all');
            setAssignedFilter('all');
            // TODO: Add urgency filter
          }}
        />
        <KpiCard
          title="Pending"
          value={pendingCount.toString()}
          icon={<Clock className="w-5 h-5" />}
          iconBgColor="bg-blue-100 text-blue-600"
          onClick={() => {
            setStatusFilter('pending');
            setAssignedFilter('all');
          }}
        />
        <KpiCard
          title="Active"
          value={activeCount.toString()}
          icon={<Truck className="w-5 h-5" />}
          iconBgColor="bg-green-100 text-green-600"
          onClick={() => {
            setStatusFilter('in_progress');
            setAssignedFilter('all');
          }}
        />
        <KpiCard
          title="Overdue"
          value={overdueCount.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-orange-100 text-orange-600"
          onClick={() => {
            setStatusFilter('all');
            // TODO: Add overdue filter
          }}
        />
      </div>

      {/* Filters and Actions */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Select All Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={filteredMoves && filteredMoves.length > 0 && selectedMoves.size === filteredMoves.length}
              onChange={handleSelectAll}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
            />
            <span className="ml-2 text-sm text-gray-600">
              {selectedMoves.size > 0 ? `${selectedMoves.size} selected` : 'Select all'}
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 flex-1">
            <Dropdown
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as MoveRequestStatus | 'all')}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
              ]}
            />

            <Dropdown
              label="Assignment"
              value={assignedFilter}
              onChange={(value) => setAssignedFilter(value as 'all' | 'assigned' | 'unassigned')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'unassigned', label: 'Unassigned' },
              ]}
            />

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bin #, address, driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Create Button */}
          <Button
            className="whitespace-nowrap"
            onClick={() => setShowScheduleMoveModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Move Request
          </Button>
        </div>
      </Card>

      {/* Bulk Action Bar */}
      {selectedMoves.size > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center animate-slide-in-up">
          <Card className="px-6 py-4 shadow-2xl border-2 border-primary/20">
            <div className="flex items-center gap-6">
              {/* Count Badge */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  {selectedMoves.size}
                </div>
                <span className="font-semibold text-gray-700">
                  {selectedMoves.size} move{selectedMoves.size !== 1 ? 's' : ''} selected
                </span>
              </div>

              {/* Actions */}
              {hasMixedSelection ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800 font-medium">
                    Mixed selection - Cannot bulk assign
                  </span>
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={handleBulkAssign}>
                  <Truck className="h-4 w-4 mr-2" />
                  {hasAssignedMoves ? 'Re-assign to Shift' : 'Assign to Shift'}
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={handleBulkEditDate}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Date
              </Button>

              <Button variant="destructive" size="sm" onClick={handleBulkCancel}>
                <XIcon className="h-4 w-4 mr-2" />
                Cancel Moves
              </Button>

              {/* Clear Button */}
              <button
                onClick={clearSelection}
                className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                aria-label="Clear selection"
              >
                <XIcon className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 w-[5%]"></th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-[8%] cursor-pointer"
                  onClick={() => handleSort('bin_number')}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Bin</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-[18%]">
                  Location
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer"
                  onClick={() => handleSort('scheduled_date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Requested Date</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer"
                  onClick={() => handleSort('urgency')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Urgency</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer"
                  onClick={() => handleSort('assigned_driver_name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Assigned To</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Type
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMoves?.map((move) => (
                <tr
                  key={move.id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    selectedMoves.has(move.id) && 'bg-blue-50'
                  )}
                >
                  {/* Checkbox */}
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedMoves.has(move.id)}
                      onChange={() => handleSelectMove(move.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>

                  {/* Bin Number */}
                  <td className="py-4 px-4 text-center">
                    <span className="font-semibold text-gray-900">{move.bin_number}</span>
                  </td>

                  {/* Location */}
                  <td className="py-4 px-4 min-w-[200px]">
                    <div className="text-sm">
                      <div className="text-gray-900 font-medium whitespace-nowrap">{move.current_street}</div>
                      <div className="text-gray-500 text-xs">
                        {move.city}, {move.zip}
                      </div>
                    </div>
                  </td>

                  {/* Requested Date */}
                  <td className="py-4 px-4">
                    <div className="text-sm">
                      <div className="text-gray-900 font-medium">
                        {format(new Date(move.scheduled_date * 1000), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {format(new Date(move.scheduled_date * 1000), 'h:mm a')}
                      </div>
                    </div>
                  </td>

                  {/* Urgency */}
                  <td className="py-4 px-4">{getUrgencyBadge(move)}</td>

                  {/* Status */}
                  <td className="py-4 px-4">{getStatusBadge(move.status)}</td>

                  {/* Assigned To */}
                  <td className="py-4 px-4">
                    {move.assigned_driver_name ? (
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{move.assigned_driver_name}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 font-medium">Unassigned</span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="py-4 px-4">
                    {move.move_type === 'pickup_only' ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">Pickup</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">Relocation</span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Primary Action Button - context aware */}
                      {move.status === 'pending' && !move.assigned_shift_id && (
                        <Button
                          size="sm"
                          onClick={() => handleSingleAssign(move)}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          <Truck className="h-3.5 w-3.5 mr-1.5" />
                          Assign
                        </Button>
                      )}

                      {move.status === 'pending' && move.assigned_shift_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleAssign(move)}
                          className="border-gray-300"
                        >
                          <Truck className="h-3.5 w-3.5 mr-1.5" />
                          Re-assign
                        </Button>
                      )}

                      {(move.status === 'in_progress' || move.status === 'completed' || move.status === 'cancelled') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-300"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1.5" />
                          View
                        </Button>
                      )}

                      {/* Three-dot Menu - for secondary actions */}
                      {move.status === 'pending' && (
                        <button
                          ref={(el) => {
                            if (el) menuButtonRefs.current.set(move.id, el);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const button = e.currentTarget as HTMLButtonElement;
                            handleMenuOpen(move.id, button);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredMoves?.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold mb-2">No move requests found</p>
              <p className="text-gray-400 text-sm">
                {searchQuery || statusFilter !== 'all' || assignedFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a move request to get started'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Results Count */}
      {filteredMoves && filteredMoves.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredMoves.length} of {allMoves?.length} move request{allMoves?.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <AssignMovesModal
          moveRequests={movesToAssign}
          onClose={() => {
            setShowAssignModal(false);
            setMovesToAssign([]);
          }}
          onSuccess={() => {
            clearSelection();
            refetch();
            setShowAssignModal(false);
            setMovesToAssign([]);
          }}
        />
      )}

      {/* Bulk Edit Date Modal */}
      {showBulkEditDateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBulkEditDateModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Edit Scheduled Date</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Update date for {selectedMoves.size} move request{selectedMoves.size !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkEditDateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={bulkEditDate}
                    onChange={(e) => setBulkEditDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBulkEditDateModal(false);
                      setBulkEditDate('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkEditDateSubmit}
                    disabled={bulkEditDateMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {bulkEditDateMutation.isPending ? 'Updating...' : 'Update Date'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bulk Cancel Modal */}
      {showBulkCancelModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBulkCancelModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Cancel Move Requests</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to cancel {selectedMoves.size} move request{selectedMoves.size !== 1 ? 's' : ''}?
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkCancelModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    This action cannot be undone. All selected move requests will be cancelled.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkCancelModal(false)}
                >
                  Keep Requests
                </Button>
                <Button
                  onClick={handleBulkCancelConfirm}
                  disabled={bulkCancelMutation.isPending}
                  variant="destructive"
                >
                  <XIcon className="w-4 h-4 mr-2" />
                  {bulkCancelMutation.isPending ? 'Cancelling...' : 'Cancel Requests'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Schedule Move Modal */}
      {showScheduleMoveModal && (
        <ScheduleMoveModal
          moveRequest={moveToEdit}
          onClose={() => {
            setShowScheduleMoveModal(false);
            setMoveToEdit(null);
          }}
          onSuccess={() => {
            refetch();
            setShowScheduleMoveModal(false);
            setMoveToEdit(null);
          }}
        />
      )}

      {/* Single Cancel Confirmation Modal */}
      {showSingleCancelModal && moveToCancel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSingleCancelModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Cancel Move Request</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to cancel this move request?
                  </p>
                </div>
                <button
                  onClick={() => setShowSingleCancelModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">
                      Bin #{moveToCancel.bin_number}
                    </div>
                    <div className="text-sm text-gray-600">
                      {moveToCancel.current_street}, {moveToCancel.city} {moveToCancel.zip}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Scheduled: {format(new Date(moveToCancel.scheduled_date * 1000), 'MMM dd, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    This action cannot be undone. The move request will be cancelled and removed from any assigned shifts.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSingleCancelModal(false)}
                >
                  Keep Request
                </Button>
                <Button
                  onClick={handleConfirmSingleCancel}
                  disabled={singleCancelMutation.isPending}
                  variant="destructive"
                >
                  <XIcon className="w-4 h-4 mr-2" />
                  {singleCancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dropdown Menu Portal */}
      {openMenuId && menuPosition && typeof window !== 'undefined' && createPortal(
        <>
          {/* Click-outside overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpenMenuId(null);
              setMenuPosition(null);
            }}
          />
          {/* Dropdown */}
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in-down"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            {(() => {
              const move = filteredMoves?.find((m) => m.id === openMenuId);
              if (!move) return null;

              return (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDetails(move);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Details
                  </button>
                  {move.assigned_shift_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearAssignment(move);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <XIcon className="h-4 w-4" />
                      Clear Assignment
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelMove(move);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-b-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel Move
                  </button>
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
