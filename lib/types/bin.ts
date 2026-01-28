/**
 * Bin data types matching the backend API response
 * Based on backend BinResponse struct from /api/bins
 */

export type BinStatus = 'active' | 'missing' | 'retired' | 'in_storage' | 'pending_move' | 'needs_check';

export interface Bin {
  id: string;
  bin_number: number;
  current_street: string;
  city: string;
  zip: string;
  lastMovedIso?: string | null;
  lastCheckedIso?: string | null;
  lastCheckedAtIso?: string | null;
  status: BinStatus;
  fill_percentage?: number | null;
  checked: boolean;
  move_requested: boolean;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null; // Optional formatted location name
  photo_url?: string | null; // Latest check photo URL
  created_by_user_id?: string | null;
  retiredAtIso?: string | null;
  retired_by_user_id?: string | null;
}

/**
 * Bin with priority data from /api/bins/priority endpoint
 */
export interface BinWithPriority extends Bin {
  priority_score: number;
  days_since_check?: number | null;
  next_move_request_date?: number | null;
  move_request_urgency?: 'urgent' | 'scheduled' | null;
  has_pending_move: boolean;
  has_check_recommendation: boolean;
}

/**
 * Bin with guaranteed coordinates for map display
 */
export interface MappableBin extends Bin {
  latitude: number;
  longitude: number;
}

/**
 * Type guard to check if a bin has valid coordinates
 */
export function isMappableBin(bin: Bin): bin is MappableBin {
  return (
    bin.latitude !== null &&
    bin.latitude !== undefined &&
    bin.longitude !== null &&
    bin.longitude !== undefined
  );
}

/**
 * Get fill level category for styling
 */
export function getFillLevelCategory(
  fillPercentage?: number | null
): 'empty' | 'low' | 'medium' | 'high' | 'critical' {
  if (!fillPercentage) return 'empty';
  if (fillPercentage < 25) return 'low';
  if (fillPercentage < 50) return 'medium';
  if (fillPercentage < 80) return 'high';
  return 'critical';
}

/**
 * Get color for bin marker based on fill level
 */
export function getBinMarkerColor(
  fillPercentage?: number | null
): string {
  const category = getFillLevelCategory(fillPercentage);
  switch (category) {
    case 'empty':
      return '#9CA3AF'; // gray-400
    case 'low':
      return '#10B981'; // green-500
    case 'medium':
      return '#F59E0B'; // amber-500
    case 'high':
      return '#F97316'; // orange-500
    case 'critical':
      return '#EF4444'; // red-500
  }
}

/**
 * Potential Location - A driver-requested location for a future bin
 */
export interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number | null;
  longitude?: number | null;
  requested_by_user_id: string;
  requested_by_name: string;
  created_at_iso: string;
  notes?: string | null;
}

/**
 * Move Request - A request to move a bin to a new location or store in warehouse
 */
export type MoveRequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type MoveRequestType = 'store' | 'relocation';

export interface MoveRequest {
  id: string;
  bin_id: string;
  bin_number: number;
  current_street: string;
  city: string;
  zip: string;
  urgency: 'urgent' | 'soon' | 'scheduled' | 'overdue' | 'resolved';
  move_type: MoveRequestType;
  scheduled_date: number; // Unix timestamp
  scheduled_date_iso: string; // ISO string for display
  new_street?: string | null;
  new_city?: string | null;
  new_zip?: string | null;
  new_latitude?: number | null;
  new_longitude?: number | null;
  reason?: string | null;
  notes?: string | null;
  status: MoveRequestStatus;
  assignment_type?: 'shift' | 'manual';
  assigned_shift_id?: string | null;
  assigned_driver_name?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  driver_name?: string | null; // Unified field - contains driver or user name
  completed_at?: number | null;
  completed_at_iso?: string | null;
  created_by_user_id: string;
  created_by_name?: string | null;
  requested_by_name?: string | null; // Name of user who requested the move
  created_at: number;
  created_at_iso: string;
  updated_at: number;
  updated_at_iso: string;
}

/**
 * Calculate urgency status based on scheduled date
 */
export function getMoveRequestUrgency(scheduledDate: number): 'urgent' | 'soon' | 'scheduled' | 'overdue' | 'resolved' {
  const now = Date.now() / 1000; // Convert to Unix timestamp
  const daysUntil = (scheduledDate - now) / 86400;

  if (scheduledDate < now) return 'overdue';
  if (daysUntil < 1) return 'urgent';
  if (daysUntil < 3) return 'soon';
  return 'scheduled';
}

/**
 * Get color for move request badge based on urgency
 */
export function getMoveRequestBadgeColor(scheduledDate: number): string {
  const urgency = getMoveRequestUrgency(scheduledDate);
  switch (urgency) {
    case 'overdue':
      return 'bg-red-500 text-white';
    case 'urgent':
      return 'bg-red-500 text-white';
    case 'soon':
      return 'bg-orange-500 text-white';
    case 'scheduled':
      return 'bg-blue-500 text-white';
  }
}

/**
 * Move Request History - Audit trail event types
 */
export type MoveRequestHistoryActionType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'unassigned'
  | 'updated'
  | 'completed'
  | 'cancelled';

/**
 * Move Request History Event
 */
export interface MoveRequestHistoryChangeDetail {
  field: string;
  label: string;
  old?: string | null;
  new?: string | null;
  old_formatted?: string | null;
  new_formatted?: string | null;
  old_timestamp?: number | null;
  new_timestamp?: number | null;
}

export interface MoveRequestHistoryMetadata {
  changes: MoveRequestHistoryChangeDetail[];
}

export interface MoveRequestHistoryEvent {
  id: string;
  move_request_id: string;
  action_type: MoveRequestHistoryActionType;
  action_type_label: string; // Human-readable label (e.g., "Created", "Assigned")
  actor_user_id: string;
  actor_name: string;
  description: string | null;
  notes: string | null;
  metadata: string | null; // JSON string containing change details

  // Assignment change tracking
  previous_assignment_type: string | null;
  new_assignment_type: string | null;
  previous_assigned_user_id: string | null;
  new_assigned_user_id: string | null;
  previous_assigned_user_name: string | null;
  new_assigned_user_name: string | null;
  previous_assigned_shift_id: string | null;
  new_assigned_shift_id: string | null;

  created_at_iso: string;
  created_at: number;
}

/**
 * Get icon name for history action type
 */
export function getHistoryActionIcon(actionType: MoveRequestHistoryActionType): string {
  switch (actionType) {
    case 'created':
      return 'Plus';
    case 'assigned':
      return 'UserPlus';
    case 'reassigned':
      return 'RefreshCw';
    case 'unassigned':
      return 'UserMinus';
    case 'updated':
      return 'Edit';
    case 'completed':
      return 'CheckCircle';
    case 'cancelled':
      return 'XCircle';
  }
}

/**
 * Get color for history action type
 */
export function getHistoryActionColor(actionType: MoveRequestHistoryActionType): string {
  switch (actionType) {
    case 'created':
      return 'text-blue-600 bg-blue-50';
    case 'assigned':
      return 'text-green-600 bg-green-50';
    case 'reassigned':
      return 'text-purple-600 bg-purple-50';
    case 'unassigned':
      return 'text-orange-600 bg-orange-50';
    case 'updated':
      return 'text-gray-600 bg-gray-50';
    case 'completed':
      return 'text-green-700 bg-green-100';
    case 'cancelled':
      return 'text-red-600 bg-red-50';
  }
}
