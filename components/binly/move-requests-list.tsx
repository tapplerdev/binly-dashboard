'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMoveRequests, updateMoveRequest, bulkCancelMoves, cancelMoveRequest, clearMoveAssignment } from '@/lib/api/move-requests';
import { useWebSocket, WebSocketMessage } from '@/lib/hooks/use-websocket';
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
import { MultiSelectDropdown } from '@/components/ui/dropdown';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AssignMovesModal } from '@/components/binly/assign-moves-modal';
import { ScheduleMoveModal } from '@/components/binly/bin-modals'; // For editing (legacy fallback)
import { EditMoveRequestModal } from '@/components/binly/edit-move-request-modal'; // New edit modal with satellite map
import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map'; // For creating
import { MoveRequestDetailDrawer } from '@/components/binly/move-request-detail-drawer';
import { AssignUserModal } from '@/components/binly/assign-user-modal';
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
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortColumn = 'bin_number' | 'scheduled_date' | 'created_at' | 'urgency' | 'status' | 'assigned_driver_name';
type MoveFilterOption = 'overdue' | 'urgent' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'store' | 'relocation';

// Get auth token helper function
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;
    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

export function MoveRequestsList() {
  // State
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MoveFilterOption[]>([]);

  // WebSocket connection for real-time updates
  const token = getAuthToken();
  const wsUrl = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`;

  useWebSocket({
    url: wsUrl,
    onMessage: (message: WebSocketMessage) => {
      if (message.type === 'move_request_status_updated') {
        console.log('📡 Received move request status update:', message.data);
        // Invalidate and refetch move requests to show updated status
        queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      }
    },
    autoReconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
  });
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoves, setSelectedMoves] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignUserModal, setShowAssignUserModal] = useState(false);
  const [showScheduleMoveModal, setShowScheduleMoveModal] = useState(false); // Legacy edit modal
  const [showEditMoveModal, setShowEditMoveModal] = useState(false); // New satellite-map edit modal
  const [showCreateMoveModal, setShowCreateMoveModal] = useState(false); // For creating new with map
  const [showBulkEditDateModal, setShowBulkEditDateModal] = useState(false);
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [showSingleCancelModal, setShowSingleCancelModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [bulkEditDate, setBulkEditDate] = useState('');
  const [movesToAssign, setMovesToAssign] = useState<MoveRequest[]>([]); // For single or bulk assignment
  const [moveToAssignUser, setMoveToAssignUser] = useState<MoveRequest | null>(null); // For user assignment
  const [moveToEdit, setMoveToEdit] = useState<MoveRequest | null>(null); // For editing individual move
  const [moveToCancel, setMoveToCancel] = useState<MoveRequest | null>(null); // For canceling individual move
  const [selectedMoveForDetail, setSelectedMoveForDetail] = useState<MoveRequest | null>(null); // For detail drawer

  // Animation states for cancel modals
  const [isBulkCancelClosing, setIsBulkCancelClosing] = useState(false);
  const [isSingleCancelClosing, setIsSingleCancelClosing] = useState(false);

  // Fetch all move requests
  const { data: allMoves, isLoading, error, refetch } = useQuery({
    queryKey: ['move-requests', 'all'],
    queryFn: () => getMoveRequests({ status: 'all', limit: 1000 }),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Debug: Log assigned moves to see driver_name data
  useEffect(() => {
    if (allMoves) {
      const assignedMoves = allMoves.filter(m => m.status === 'assigned');
      if (assignedMoves.length > 0) {
        console.log('🔍 Assigned moves:', assignedMoves.map(m => ({
          bin: m.bin_number,
          status: m.status,
          assigned_shift_id: m.assigned_shift_id,
          assigned_user_id: m.assigned_user_id,
          driver_name: m.driver_name,
          assigned_driver_name: m.assigned_driver_name,
          assigned_user_name: m.assigned_user_name,
        })));
      }
    }
  }, [allMoves]);

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
        // Multi-select filters
        if (filters.length > 0) {
          const matchesFilter = filters.some((filter) => {
            const urgency = getMoveRequestUrgency(move.scheduled_date);

            switch (filter) {
              case 'overdue':
                return urgency === 'overdue';
              case 'urgent':
                return urgency === 'urgent';
              case 'pending':
                return move.status === 'pending';
              case 'assigned':
                return move.status === 'assigned';
              case 'in_progress':
                return move.status === 'in_progress';
              case 'completed':
                return move.status === 'completed';
              case 'store':
                return move.move_type === 'store' || move.move_type === 'pickup_only'; // backward compatibility
              case 'relocation':
                return move.move_type === 'relocation';
              default:
                return false;
            }
          });

          if (!matchesFilter) return false;
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
            case 'created_at': {
              // Use created_at_iso for sorting (ISO string format)
              const aDate = a.created_at_iso ? new Date(a.created_at_iso).getTime() : 0;
              const bDate = b.created_at_iso ? new Date(b.created_at_iso).getTime() : 0;
              comparison = aDate - bDate;
              break;
            }
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
  }, [allMoves, filters, assignedFilter, searchQuery, sortColumn, sortDirection]);

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

  const handleSingleAssignUser = (move: MoveRequest) => {
    setMoveToAssignUser(move);
    setShowAssignUserModal(true);
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  // Handler for opening detail drawer
  const handleRowClick = (move: MoveRequest) => {
    setSelectedMoveForDetail(move);
    setShowDetailDrawer(true);
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
    setShowEditMoveModal(true); // Open new satellite-map edit modal
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

  // Modal close handlers with animation
  const handleCloseBulkCancelModal = () => {
    setIsBulkCancelClosing(true);
    setTimeout(() => {
      setShowBulkCancelModal(false);
      setIsBulkCancelClosing(false);
    }, 300);
  };

  const handleCloseSingleCancelModal = () => {
    setIsSingleCancelClosing(true);
    setTimeout(() => {
      setShowSingleCancelModal(false);
      setMoveToCancel(null);
      setIsSingleCancelClosing(false);
    }, 300);
  };

  // Get urgency badge
  const getUrgencyBadge = (move: MoveRequest) => {
    // Use urgency from API (backend now returns "resolved" for completed/cancelled)
    const urgency = move.urgency;

    const config = {
      overdue: {
        label: '⚠️ Overdue',
        colors: 'bg-red-500 text-white',
      },
      urgent: {
        label: '🔴 Urgent',
        colors: 'bg-red-500 text-white',
      },
      soon: {
        label: 'Move Soon',
        colors: 'bg-orange-500 text-white',
      },
      scheduled: {
        label: 'Scheduled',
        colors: 'bg-blue-500 text-white',
      },
      resolved: {
        label: '✓ Resolved',
        colors: 'bg-green-600 text-white',
      },
    };

    const { label, colors } = config[urgency] || config.scheduled;

    return (
      <Badge className={cn('font-semibold whitespace-nowrap', colors)}>
        {label}
      </Badge>
    );
  };

  // Get status badge
  const getStatusBadge = (status: MoveRequestStatus) => {
    const config = {
      pending: { label: 'Pending', color: 'bg-orange-500 text-white border-orange-600' },
      assigned: { label: 'Assigned', color: 'bg-blue-600 text-white border-blue-700' },
      in_progress: { label: 'In Progress', color: 'bg-purple-600 text-white border-purple-700' },
      completed: { label: 'Completed', color: 'bg-green-600 text-white border-green-700' },
      cancelled: { label: 'Cancelled', color: 'bg-gray-500 text-white border-gray-600' },
      overdue: { label: 'Overdue', color: 'bg-red-600 text-white border-red-700' },
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
    <div className="space-y-4 md:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <KpiCard
          title="Urgent"
          value={urgentCount.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-red-100 text-red-600"
          onClick={() => {
            setFilters(['urgent']);
            setAssignedFilter('all');
          }}
        />
        <KpiCard
          title="Pending"
          value={pendingCount.toString()}
          icon={<Clock className="w-5 h-5" />}
          iconBgColor="bg-blue-100 text-blue-600"
          onClick={() => {
            setFilters(['pending']);
            setAssignedFilter('all');
          }}
        />
        <KpiCard
          title="Active"
          value={activeCount.toString()}
          icon={<Truck className="w-5 h-5" />}
          iconBgColor="bg-green-100 text-green-600"
          onClick={() => {
            setFilters(['in_progress']);
            setAssignedFilter('all');
          }}
        />
        <KpiCard
          title="Overdue"
          value={overdueCount.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-orange-100 text-orange-600"
          onClick={() => {
            setFilters(['overdue']);
            setAssignedFilter('all');
          }}
        />
      </div>

      {/* Filters and Actions */}
      <Card className="p-3 md:p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4">
          {/* Multi-select Filter Dropdown */}
          <MultiSelectDropdown
            label="Filter By"
            selectedValues={filters}
            options={[
              { value: 'overdue', label: 'Overdue' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'pending', label: 'Pending' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'store', label: 'Store' },
              { value: 'relocation', label: 'Relocation' },
            ]}
            onChange={(values) => setFilters(values as MoveFilterOption[])}
          />

          {/* Search Bar */}
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search bin #, address, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Assignment Segmented Control */}
          <div className="flex items-center lg:ml-auto">
            <SegmentedControl
              value={assignedFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'unassigned', label: 'Unassigned' },
              ]}
              onChange={(value) => setAssignedFilter(value as 'all' | 'assigned' | 'unassigned')}
            />
          </div>

          {/* Create Button */}
          <Button
            className="whitespace-nowrap w-full lg:w-auto"
            onClick={() => setShowCreateMoveModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Move Request
          </Button>
        </div>
      </Card>

      {/* Bulk Action Bar */}
      {selectedMoves.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 left-0 right-0 z-40 flex justify-center px-3 lg:px-0 animate-slide-in-up">
          <Card className="px-4 lg:px-6 py-3 lg:py-4 shadow-2xl border-2 border-primary/20 w-full lg:w-auto max-w-full lg:max-w-none">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-6">
              {/* Count Badge */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedMoves.size}
                </div>
                <span className="font-semibold text-gray-700 text-sm lg:text-base">
                  {selectedMoves.size} move{selectedMoves.size !== 1 ? 's' : ''} selected
                </span>

                {/* Clear Button - Mobile only, inline with count */}
                <button
                  onClick={clearSelection}
                  className="lg:hidden ml-auto h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  aria-label="Clear selection"
                >
                  <XIcon className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-4">
                {hasMixedSelection ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span className="text-sm text-yellow-800 font-medium">
                      Mixed selection - Cannot bulk assign
                    </span>
                  </div>
                ) : (
                  <Button variant="default" size="sm" onClick={handleBulkAssign} className="w-full lg:w-auto">
                    <Truck className="h-4 w-4 mr-2" />
                    {hasAssignedMoves ? 'Re-assign to Shift' : 'Assign to Shift'}
                  </Button>
                )}

                <Button variant="outline" size="sm" onClick={handleBulkEditDate} className="w-full lg:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Date
                </Button>

                <Button variant="destructive" size="sm" onClick={handleBulkCancel} className="w-full lg:w-auto">
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel Moves
                </Button>
              </div>

              {/* Clear Button - Desktop only */}
              <button
                onClick={clearSelection}
                className="hidden lg:flex h-8 w-8 rounded-full hover:bg-gray-100 items-center justify-center transition-colors"
                aria-label="Clear selection"
              >
                <XIcon className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-4 px-4 w-[5%] align-middle rounded-tl-2xl">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={filteredMoves && filteredMoves.length > 0 && selectedMoves.size === filteredMoves.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      title="Select all"
                    />
                  </div>
                </th>
                <th
                  className="text-left py-4 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer align-middle"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Created At</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-center py-4 px-4 text-sm font-semibold text-gray-700 w-[8%] cursor-pointer align-middle"
                  onClick={() => handleSort('bin_number')}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Bin</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-4 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer align-middle"
                  onClick={() => handleSort('scheduled_date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Requested Date</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-4 px-4 text-sm font-semibold text-gray-700 cursor-pointer align-middle"
                  onClick={() => handleSort('urgency')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Urgency</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-4 px-4 text-sm font-semibold text-gray-700 cursor-pointer align-middle"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-left py-4 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer align-middle"
                  onClick={() => handleSort('assigned_driver_name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Assigned To</span>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle">
                  Type
                </th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700 align-middle rounded-tr-2xl">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMoves?.map((move) => (
                <tr
                  key={move.id}
                  onClick={() => handleRowClick(move)}
                  className={cn(
                    'hover:bg-gray-50 transition-colors cursor-pointer',
                    selectedMoves.has(move.id) && 'bg-blue-50'
                  )}
                >
                  {/* Checkbox */}
                  <td className="py-4 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedMoves.has(move.id)}
                      onChange={() => handleSelectMove(move.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>

                  {/* Created At */}
                  <td className="py-4 px-4 align-middle">
                    <div className="text-sm">
                      {move.created_at_iso ? (
                        <>
                          <div className="text-gray-900 font-medium">
                            {format(new Date(move.created_at_iso), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {format(new Date(move.created_at_iso), 'h:mm a')}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </div>
                  </td>

                  {/* Bin Number */}
                  <td className="py-4 px-4 text-center align-middle">
                    <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-200 font-semibold text-sm">
                      #{move.bin_number}
                    </Badge>
                  </td>

                  {/* Requested Date */}
                  <td className="py-4 px-4 align-middle">
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
                  <td className="py-4 px-4 align-middle">{getUrgencyBadge(move)}</td>

                  {/* Status */}
                  <td className="py-4 px-4 align-middle">{getStatusBadge(move.status)}</td>

                  {/* Assigned To */}
                  <td className="py-4 px-4 align-middle">
                    {move.driver_name ? (
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{move.driver_name}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 font-medium">Unassigned</span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="py-4 px-4 align-middle">
                    {move.move_type === 'relocation' ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">Relocation</span>
                      </div>
                    ) : move.move_type === 'store' ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">Store</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">Pickup</span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      {/* Three-dot Menu */}
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
                {searchQuery || filters.length > 0 || assignedFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a move request to get started'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Mobile Card View */}
      {filteredMoves && filteredMoves.length === 0 ? (
        <Card className="lg:hidden">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold mb-2">No move requests found</p>
            <p className="text-gray-400 text-sm">
              {searchQuery || filters.length > 0 || assignedFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a move request to get started'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="lg:hidden space-y-3">
          {filteredMoves?.map((move) => (
            <Card
              key={move.id}
              className="p-4 hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
              onClick={() => handleRowClick(move)}
            >
              {/* Header Row: Checkbox, Bin Number, Actions */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMoves.has(move.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectMove(move.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                  <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-200 font-semibold text-base px-3 py-1">
                    #{move.bin_number}
                  </Badge>
                </div>

                {/* Actions Menu */}
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
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Created At */}
              {move.created_at_iso && (
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-gray-500 mr-2">Created:</span>
                    <span className="text-gray-900 font-medium">
                      {format(new Date(move.created_at_iso), 'MMM dd, yyyy')}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {format(new Date(move.created_at_iso), 'h:mm a')}
                    </span>
                  </div>
                </div>
              )}

              {/* Requested Date */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-500 mr-2">Requested:</span>
                  <span className="text-gray-900 font-medium">
                    {format(new Date(move.scheduled_date * 1000), 'MMM dd, yyyy')}
                  </span>
                  <span className="text-gray-500 ml-2">
                    {format(new Date(move.scheduled_date * 1000), 'h:mm a')}
                  </span>
                </div>
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {getUrgencyBadge(move)}
                {getStatusBadge(move.status)}
              </div>

              {/* Assigned Driver */}
              {move.driver_name ? (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Assigned to:</span>
                  <span className="text-gray-900 font-medium">{move.driver_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500 font-medium">Unassigned</span>
                </div>
              )}

              {/* Move Type */}
              <div className="flex items-center gap-2 text-sm">
                {move.move_type === 'relocation' ? (
                  <>
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">Relocation</span>
                  </>
                ) : move.move_type === 'store' ? (
                  <>
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">Store</span>
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">Pickup</span>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Assignment Modal (for shift assignment) */}
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

      {/* User Assignment Modal (for manual/one-off assignment) */}
      {showAssignUserModal && moveToAssignUser && (
        <AssignUserModal
          moveRequest={moveToAssignUser}
          onClose={() => {
            setShowAssignUserModal(false);
            setMoveToAssignUser(null);
          }}
          onSuccess={() => {
            refetch();
            setShowAssignUserModal(false);
            setMoveToAssignUser(null);
          }}
        />
      )}

      {/* Bulk Edit Date Modal */}
      {showBulkEditDateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4"
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
            className={`fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4 ${
              isBulkCancelClosing ? 'animate-fade-out' : 'animate-fade-in'
            }`}
            onClick={handleCloseBulkCancelModal}
          >
            <div
              className={`bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 ${
                isBulkCancelClosing ? 'animate-scale-out' : 'animate-scale-in'
              }`}
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
                  onClick={handleCloseBulkCancelModal}
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
                  onClick={handleCloseBulkCancelModal}
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

      {/* New Edit Move Request Modal — satellite map + drag-to-relocate */}
      {showEditMoveModal && moveToEdit && (
        <EditMoveRequestModal
          moveRequest={moveToEdit}
          onClose={() => {
            setShowEditMoveModal(false);
            setMoveToEdit(null);
          }}
          onSuccess={() => {
            refetch();
            setShowEditMoveModal(false);
            setMoveToEdit(null);
          }}
        />
      )}

      {/* Legacy Schedule Move Modal (kept as fallback, no longer triggered by three-dot menu) */}
      {showScheduleMoveModal && (
        <ScheduleMoveModal
          moveRequest={moveToEdit ?? undefined}
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

      {/* Create Move Modal with Map (for creating new) */}
      {showCreateMoveModal && (
        <ScheduleMoveModalWithMap
          onClose={() => setShowCreateMoveModal(false)}
          onSuccess={() => {
            refetch();
            setShowCreateMoveModal(false);
          }}
        />
      )}

      {/* Single Cancel Confirmation Modal */}
      {showSingleCancelModal && moveToCancel && (
        <>
          <div
            className={`fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4 ${
              isSingleCancelClosing ? 'animate-fade-out' : 'animate-fade-in'
            }`}
            onClick={handleCloseSingleCancelModal}
          >
            <div
              className={`bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 ${
                isSingleCancelClosing ? 'animate-scale-out' : 'animate-scale-in'
              }`}
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
                  onClick={handleCloseSingleCancelModal}
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
                  onClick={handleCloseSingleCancelModal}
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

              const isCompletedOrCancelled = move.status === 'completed' || move.status === 'cancelled';
              const isPending = move.status === 'pending';
              const canReassign = move.status === 'pending' || move.status === 'assigned';
              const isAssignedToShift = !!move.assigned_shift_id;
              const isEditable = move.status !== 'completed' && move.status !== 'cancelled';

              return (
                <>
                  {/* Edit - for all editable statuses (pending, assigned, in_progress) */}
                  {isEditable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDetails(move);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Move Request
                    </button>
                  )}

                  {/* View Details - for completed/cancelled */}
                  {!isEditable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDetails(move);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                  )}

                  {/* Cancel Move (for pending and assigned) */}
                  {(move.status === 'pending' || move.status === 'assigned') && (
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
                  )}
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* Detail Drawer */}
      {showDetailDrawer && selectedMoveForDetail && (
        <MoveRequestDetailDrawer
          moveRequest={selectedMoveForDetail}
          onClose={() => {
            setShowDetailDrawer(false);
            setSelectedMoveForDetail(null);
          }}
          onEdit={(move) => {
            setShowDetailDrawer(false);
            setMoveToEdit(move);
            setShowEditMoveModal(true);
          }}
          onCancel={(move) => {
            setShowDetailDrawer(false);
            handleCancelMove(move);
          }}
        />
      )}
    </div>
  );
}
