'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBinChecks, getBinMoves, getBinIncidents, type BinMove } from '@/lib/api/bins';
import { ZoneIncident, formatIncidentType, getIncidentIcon } from '@/lib/types/zone';
import { getMoveRequest, getMoveRequests, cancelMoveRequest } from '@/lib/api/move-requests';
import { BinWithPriority, getMoveRequestUrgency, getMoveRequestBadgeColor, type MoveRequest, type BinCheck } from '@/lib/types/bin';
import { AssignMovesModal } from '@/components/binly/assign-moves-modal';
import { CheckDetailModal } from '@/components/binly/check-detail-modal';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  MapPin,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Package,
  Clock,
  AlertTriangle,
  Trash2,
  Image as ImageIcon,
  Truck,
  User,
  Navigation,
  ExternalLink,
  ArrowRight,
  PackageX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BinDetailDrawerProps {
  bin: BinWithPriority;
  onClose: () => void;
  onScheduleMove?: (bin: BinWithPriority) => void;
  onRetire?: (bin: BinWithPriority) => void;
}

export function BinDetailDrawer({ bin, onClose, onScheduleMove, onRetire }: BinDetailDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'moves' | 'incidents'>('overview');
  const [isClosing, setIsClosing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<BinCheck | null>(null);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleCheckClick = (check: BinCheck) => {
    setSelectedCheck(check);
    setIsCheckModalOpen(true);
  };

  const handleCheckModalClose = () => {
    setIsCheckModalOpen(false);
    setSelectedCheck(null);
  };

  // Fetch check history
  const { data: checks, isLoading: checksLoading } = useQuery({
    queryKey: ['bin-checks', bin.id],
    queryFn: () => getBinChecks(bin.id),
    enabled: activeTab === 'checks',
  });

  // Fetch move history
  const { data: moves, isLoading: movesLoading } = useQuery({
    queryKey: ['bin-moves', bin.id],
    queryFn: () => getBinMoves(bin.id),
    enabled: activeTab === 'moves',
  });

  // Fetch incident history
  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['bin-incidents', bin.id],
    queryFn: () => getBinIncidents(bin.id),
    enabled: activeTab === 'incidents',
  });

  // Fetch all move requests for this bin
  const { data: allMoveRequests, isLoading: moveRequestsLoading } = useQuery({
    queryKey: ['bin-move-requests', bin.id],
    queryFn: async () => {
      const requests = await getMoveRequests();
      // Filter to only move requests for this bin that are not cancelled
      return requests.filter((req) => req.bin_id === bin.id && req.status !== 'cancelled');
    },
    enabled: activeTab === 'moves',
  });

  // Fetch active move request
  const { data: activeMoveRequest, isLoading: moveRequestLoading } = useQuery({
    queryKey: ['move-request', bin.next_move_request_id],
    queryFn: () => getMoveRequest(bin.next_move_request_id!),
    enabled: !!bin.has_pending_move && !!bin.next_move_request_id && activeTab === 'overview',
  });

  // Cancel move request mutation
  const cancelMoveMutation = useMutation({
    mutationFn: (moveRequestId: string) => cancelMoveRequest(moveRequestId, 'Cancelled by manager'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      alert('Move request cancelled successfully');
    },
    onError: (error) => {
      console.error('Failed to cancel move request:', error);
      alert('Failed to cancel move request. Please try again.');
    },
  });

  const getPriorityColor = (score: number) => {
    if (score >= 1000) return 'text-red-600 bg-red-50';
    if (score >= 500) return 'text-orange-600 bg-orange-50';
    if (score >= 200) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-green-100 text-green-700' };
      case 'retired':
        return { label: 'Retired', color: 'bg-gray-100 text-gray-600' };
      case 'pending_move':
        return { label: 'Pending Move', color: 'bg-blue-100 text-blue-700' };
      case 'in_storage':
        return { label: 'In Storage', color: 'bg-purple-100 text-purple-700' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const getMoveStatusBadge = (moveRequest: MoveRequest) => {
    const urgency = getMoveRequestUrgency(moveRequest.scheduled_date);

    // Overdue takes priority
    if (urgency === 'overdue') {
      return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
    }

    // Then check status
    switch (moveRequest.status) {
      case 'pending':
        return { label: 'Pending', color: 'bg-blue-100 text-blue-700' };
      case 'assigned':
        return { label: 'Assigned', color: 'bg-purple-100 text-purple-700' };
      case 'in_progress':
        return { label: 'In Progress', color: 'bg-orange-100 text-orange-700' };
      case 'completed':
        return { label: 'Completed', color: 'bg-green-100 text-green-700' };
      default:
        return { label: moveRequest.status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  // Create combined timeline
  type TimelineItem = {
    type: 'move_request' | 'completed_move';
    date: number; // Unix timestamp for sorting
    data: MoveRequest | BinMove;
  };

  const createTimeline = (): TimelineItem[] => {
    const timeline: TimelineItem[] = [];

    // Add move requests
    if (allMoveRequests) {
      allMoveRequests.forEach((request) => {
        timeline.push({
          type: 'move_request',
          date: request.status === 'completed'
            ? (request.completed_at || request.scheduled_date)
            : request.scheduled_date,
          data: request,
        });
      });
    }

    // Add completed moves (historical location changes)
    if (moves) {
      moves.forEach((move) => {
        timeline.push({
          type: 'completed_move',
          date: new Date(move.movedOnIso).getTime() / 1000, // Convert to Unix timestamp
          data: move,
        });
      });
    }

    // Sort by priority: Overdue → Urgent → Pending/Assigned/In Progress → Completed
    return timeline.sort((a, b) => {
      if (a.type === 'move_request' && b.type === 'move_request') {
        const aReq = a.data as MoveRequest;
        const bReq = b.data as MoveRequest;

        // Completed requests go to bottom
        if (aReq.status === 'completed' && bReq.status !== 'completed') return 1;
        if (aReq.status !== 'completed' && bReq.status === 'completed') return -1;

        // For active requests, sort by urgency and date
        if (aReq.status !== 'completed' && bReq.status !== 'completed') {
          const aUrgency = getMoveRequestUrgency(aReq.scheduled_date);
          const bUrgency = getMoveRequestUrgency(bReq.scheduled_date);

          // Overdue first
          if (aUrgency === 'overdue' && bUrgency !== 'overdue') return -1;
          if (aUrgency !== 'overdue' && bUrgency === 'overdue') return 1;

          // Then by scheduled date (earliest first for active)
          return aReq.scheduled_date - bReq.scheduled_date;
        }

        // Both completed, sort by completion date (newest first)
        return b.date - a.date;
      }

      // Completed moves go to bottom
      if (a.type === 'completed_move' && b.type === 'move_request') {
        const bReq = b.data as MoveRequest;
        return bReq.status === 'completed' ? b.date - a.date : 1;
      }
      if (a.type === 'move_request' && b.type === 'completed_move') {
        const aReq = a.data as MoveRequest;
        return aReq.status === 'completed' ? b.date - a.date : -1;
      }

      // Both completed moves, sort by date (newest first)
      return b.date - a.date;
    });
  };

  const timeline = createTimeline();

  const status = getStatusBadge(bin.status);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full md:max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Bin {bin.bin_number}</h2>
                <Badge className={cn('text-xs md:text-sm', status.color)}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">
                  {bin.current_street}, {bin.city}, {bin.zip}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 md:mt-4 flex flex-col md:flex-row gap-2">
            <Button
              onClick={() => onScheduleMove?.(bin)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Move
            </Button>
            <Button
              onClick={() => onRetire?.(bin)}
              variant="outline"
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Retire Bin
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 md:px-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 md:gap-6 min-w-max">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'checks', label: 'Check History' },
              { key: 'moves', label: 'Move History' },
              { key: 'incidents', label: 'Incidents' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4 md:space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Fill Level</p>
                      <p className="text-xl font-bold text-gray-900">
                        {bin.fill_percentage || 0}%
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last Checked</p>
                      <p className="text-xl font-bold text-gray-900">
                        {bin.days_since_check !== undefined && bin.days_since_check !== null
                          ? `${bin.days_since_check}d ago`
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Active Move Request */}
              {bin.has_pending_move && activeMoveRequest && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Pending Move Request</h3>
                  <Card className="p-4 border-l-4 border-l-primary">
                    <div className="space-y-4">
                      {/* Move Type and Status */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {activeMoveRequest.move_type === 'pickup_only' ? (
                            <PackageX className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ArrowRight className="w-5 h-5 text-blue-600" />
                          )}
                          <span className="font-semibold text-gray-900">
                            {activeMoveRequest.move_type === 'pickup_only' ? 'Pickup Only' : 'Relocation'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={cn('text-xs md:text-sm', getMoveRequestBadgeColor(activeMoveRequest.scheduled_date))}
                          >
                            {getMoveRequestUrgency(activeMoveRequest.scheduled_date).toUpperCase()}
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-700 text-xs md:text-sm">
                            {activeMoveRequest.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {/* Scheduled Date */}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Scheduled for:</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(activeMoveRequest.scheduled_date * 1000), 'PPp')}
                        </span>
                      </div>

                      {/* Assigned Driver */}
                      {activeMoveRequest.assigned_shift_id ? (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Assigned to:</span>
                          <span className="font-medium text-gray-900">
                            {activeMoveRequest.assigned_driver_name || 'Driver (Shift assigned)'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="text-orange-600 font-medium">Unassigned</span>
                        </div>
                      )}

                      {/* Disposal Action (for pickup only) */}
                      {activeMoveRequest.move_type === 'pickup_only' && activeMoveRequest.disposal_action && (
                        <div className="flex items-center gap-2 text-sm">
                          <Trash2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Action:</span>
                          <span className="font-medium text-gray-900 capitalize">
                            {activeMoveRequest.disposal_action}
                          </span>
                        </div>
                      )}

                      {/* New Location (for relocation) */}
                      {activeMoveRequest.move_type === 'relocation' && activeMoveRequest.new_street && (
                        <div className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">New Location:</span>
                          </div>
                          <div className="ml-6 text-gray-900">
                            {activeMoveRequest.new_street}
                            {activeMoveRequest.new_city && `, ${activeMoveRequest.new_city}`}
                            {activeMoveRequest.new_zip && ` ${activeMoveRequest.new_zip}`}
                          </div>
                        </div>
                      )}

                      {/* Reason/Notes */}
                      {(activeMoveRequest.reason || activeMoveRequest.notes) && (
                        <div className="text-sm">
                          <span className="text-gray-600">
                            {activeMoveRequest.reason ? 'Reason: ' : 'Notes: '}
                          </span>
                          <span className="text-gray-900">
                            {activeMoveRequest.reason || activeMoveRequest.notes}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        {activeMoveRequest.status === 'pending' && !activeMoveRequest.assigned_shift_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAssignModal(true)}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Assign to Shift
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onScheduleMove?.(bin)}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Edit Move
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to cancel this move request?')) {
                              cancelMoveMutation.mutate(activeMoveRequest.id);
                            }
                          }}
                          disabled={cancelMoveMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          {cancelMoveMutation.isPending ? 'Cancelling...' : 'Cancel Move'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Location Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Location Details</h3>
                <Card className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Street:</span>
                    <span className="font-medium text-gray-900">{bin.current_street}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium text-gray-900">{bin.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ZIP:</span>
                    <span className="font-medium text-gray-900">{bin.zip}</span>
                  </div>
                  {bin.latitude && bin.longitude && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coordinates:</span>
                      <span className="font-mono text-sm text-gray-900">
                        {bin.latitude.toFixed(6)}, {bin.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              {/* Two Column Layout: Map + Routes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Left Column: Map View */}
                <div className="space-y-4">
                  {/* Static Map */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Map View</h3>
                    <Card className="p-0 overflow-hidden relative">
                      {bin.latitude && bin.longitude ? (
                        <>
                          {/* Static Google Maps Image */}
                          <div className="relative aspect-square w-full">
                            <img
                              src={`https://maps.googleapis.com/maps/api/staticmap?center=${bin.latitude},${bin.longitude}&zoom=15&size=600x600&markers=color:red%7C${bin.latitude},${bin.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                              alt="Bin location"
                              className="w-full h-full object-cover"
                            />
                            {/* View on Live Map Button */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                              <Button
                                onClick={() => {
                                  router.push(`/operations/live-map?bin=${bin.id}`);
                                }}
                                className="bg-white hover:bg-gray-50 text-gray-900 shadow-lg border border-gray-200"
                                size="sm"
                              >
                                <Navigation className="w-4 h-4 mr-2" />
                                View on Live Map
                                <ExternalLink className="w-3 h-3 ml-2" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="aspect-square w-full bg-gray-100 flex items-center justify-center">
                          <div className="text-center">
                            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No location data</p>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>

                {/* Right Column: Scheduled Routes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Scheduled Routes</h3>
                  <Card className="p-4 space-y-4">
                    {/* TODO: Replace with real data from backend */}
                    {/* Mock data for now */}
                    {false ? (
                      <>
                        {/* Upcoming Routes */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">Upcoming:</h4>
                          <div className="space-y-2">
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Truck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900">Route #5</span>
                                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                                      Stop 3 of 12
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3 h-3" />
                                      <span>Tomorrow, 2:00 PM</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3" />
                                      <span>Driver: John Smith</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200" />

                        {/* Last Collection */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">Last Collection:</h4>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-900">Dec 15, 2024 - Route #5</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600">Driver: John Smith</span>
                              </div>
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Collected, filled to 65%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Empty State */
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Truck className="w-6 h-6 text-gray-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Not Currently Scheduled
                        </h4>
                        <p className="text-sm text-gray-500 mb-4">
                          This bin is not on any upcoming routes. Consider adding it to a route if it needs service.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            router.push('/operations/routes');
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Add to Route
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checks' && (
            <div className="space-y-4">
              {checksLoading ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-500">Loading check history...</p>
                </div>
              ) : checks && checks.length > 0 ? (
                <div className="space-y-3">
                  {checks.map((check) => (
                    <Card
                      key={check.id}
                      className="p-4 cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleCheckClick(check)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-gray-900">
                              {check.checkedByName || 'Unknown Driver'}
                            </span>
                            {check.shiftId && (
                              <Badge className="bg-gray-100 text-gray-700 text-xs">
                                shift
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">Fill:</span>
                              <span className="font-semibold text-gray-900">
                                {check.fillPercentage !== null ? `${check.fillPercentage}%` : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500">
                                {format(new Date(check.checkedOnIso), 'PPp')}
                              </span>
                            </div>
                          </div>
                        </div>
                        {check.photoUrl && (
                          <div className="ml-4">
                            <img
                              src={check.photoUrl}
                              alt="Check photo"
                              className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No check history available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="space-y-4">
              {incidentsLoading ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-gray-300 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-500">Loading incidents...</p>
                </div>
              ) : incidents && incidents.length > 0 ? (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <Card key={incident.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none mt-0.5">{getIncidentIcon(incident.incident_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-900">{formatIncidentType(incident.incident_type)}</span>
                            {incident.is_field_observation && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Manager</span>
                            )}
                            {incident.shift_id && !incident.is_field_observation && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Shift</span>
                            )}
                          </div>
                          {incident.description && (
                            <p className="text-sm text-gray-600 mb-1">{incident.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {incident.reported_by_name && (
                              <span>{incident.reported_by_name}</span>
                            )}
                            {incident.reported_by_name && incident.reported_at_iso && (
                              <span>·</span>
                            )}
                            {incident.reported_at_iso && (
                              <span>{format(new Date(incident.reported_at_iso), 'PPp')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No incidents reported for this bin</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'moves' && (
            <div className="space-y-4">
              {movesLoading || moveRequestsLoading ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-500">Loading move history...</p>
                </div>
              ) : timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((item, index) => {
                    if (item.type === 'move_request') {
                      const moveRequest = item.data as MoveRequest;
                      const statusBadge = getMoveStatusBadge(moveRequest);
                      const isCompleted = moveRequest.status === 'completed';
                      const isOverdue = getMoveRequestUrgency(moveRequest.scheduled_date) === 'overdue' && !isCompleted;

                      return (
                        <Card key={`request-${moveRequest.id}`} className={cn(
                          "p-4",
                          isOverdue && "border-l-4 border-l-red-500"
                        )}>
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              isOverdue ? "bg-red-50" : isCompleted ? "bg-green-50" : "bg-blue-50"
                            )}>
                              {moveRequest.move_type === 'pickup_only' ? (
                                <PackageX className={cn(
                                  "w-5 h-5",
                                  isOverdue ? "text-red-600" : isCompleted ? "text-green-600" : "text-blue-600"
                                )} />
                              ) : (
                                <ArrowRight className={cn(
                                  "w-5 h-5",
                                  isOverdue ? "text-red-600" : isCompleted ? "text-green-600" : "text-blue-600"
                                )} />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">
                                  {moveRequest.move_type === 'pickup_only' ? 'Pickup Only' : 'Relocation'}
                                </span>
                                <Badge className={statusBadge.color}>
                                  {statusBadge.label}
                                </Badge>
                              </div>

                              {/* Scheduled Date */}
                              <div className="space-y-1 text-sm mb-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">
                                    {isCompleted ? 'Completed:' : 'Scheduled:'}
                                  </span>
                                  <span className="text-gray-900">
                                    {isCompleted && moveRequest.completed_at_iso
                                      ? format(new Date(moveRequest.completed_at_iso), 'PPp')
                                      : format(new Date(moveRequest.scheduled_date * 1000), 'PPp')}
                                  </span>
                                </div>

                                {/* Assignment Status */}
                                {!isCompleted && (
                                  <div className="flex items-center gap-2">
                                    {moveRequest.assigned_shift_id ? (
                                      <>
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-600">Assigned to:</span>
                                        <span className="text-gray-900">
                                          {moveRequest.assigned_driver_name || 'Driver'}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                                        <span className="text-orange-600">Unassigned</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* New Location for Relocation */}
                              {moveRequest.move_type === 'relocation' && moveRequest.new_street && (
                                <div className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600">New Location:</span>
                                  </div>
                                  <div className="ml-6 text-gray-900">
                                    {moveRequest.new_street}
                                    {moveRequest.new_city && `, ${moveRequest.new_city}`}
                                    {moveRequest.new_zip && ` ${moveRequest.new_zip}`}
                                  </div>
                                </div>
                              )}

                              {/* Disposal Action for Pickup */}
                              {moveRequest.move_type === 'pickup_only' && moveRequest.disposal_action && (
                                <div className="text-sm">
                                  <span className="text-gray-600">Action: </span>
                                  <span className="text-gray-900 capitalize">{moveRequest.disposal_action}</span>
                                </div>
                              )}

                              {/* Reason/Notes */}
                              {(moveRequest.reason || moveRequest.notes) && (
                                <div className="text-sm mt-2 text-gray-600">
                                  {moveRequest.reason || moveRequest.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    } else {
                      // Completed Move (historical location change)
                      const move = item.data as BinMove;
                      return (
                        <Card key={`move-${move.id}`} className="p-4 bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-gray-200 rounded-lg">
                              <MapPin className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">Location Change</span>
                                <Badge className="bg-gray-100 text-gray-700">Historical</Badge>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">
                                    {format(new Date(move.movedOnIso), 'PPp')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">From:</span>
                                  <span className="ml-2 text-gray-900">{move.movedFrom}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">To:</span>
                                  <span className="ml-2 text-gray-900">{move.movedTo}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No move history available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && activeMoveRequest && (
        <AssignMovesModal
          moveRequests={[activeMoveRequest]}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['move-requests'] });
            queryClient.invalidateQueries({ queryKey: ['bins'] });
          }}
        />
      )}

      {/* Check Detail Modal */}
      <CheckDetailModal
        check={selectedCheck}
        isOpen={isCheckModalOpen}
        onClose={handleCheckModalClose}
      />
    </>
  );
}
