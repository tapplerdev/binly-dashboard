/**
 * API functions for bin move requests
 */

import { MoveRequest, MoveRequestStatus, MoveRequestType, MoveRequestHistoryEvent } from '@/lib/types/bin';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Get auth token from localStorage (Zustand persist storage)
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;

    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Get headers with authentication
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Get all move requests with optional filters
 */
export interface GetMoveRequestsParams {
  status?: MoveRequestStatus | 'all';
  assigned?: 'assigned' | 'unassigned' | 'all';
  urgency?: 'urgent' | 'soon' | 'scheduled' | 'overdue' | 'all';
  move_type?: MoveRequestType | 'all';
  limit?: number;
}

export async function getMoveRequests(params?: GetMoveRequestsParams): Promise<MoveRequest[]> {
  const queryParams = new URLSearchParams();

  if (params?.status && params.status !== 'all') {
    queryParams.append('status', params.status);
  }
  if (params?.assigned && params.assigned !== 'all') {
    queryParams.append('assigned', params.assigned);
  }
  if (params?.move_type && params.move_type !== 'all') {
    queryParams.append('move_type', params.move_type);
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }

  const url = `${API_BASE_URL}/api/manager/bins/move-requests${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch move requests: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new move request
 */
export interface CreateMoveRequestParams {
  bin_id: string;
  scheduled_date: number; // Unix timestamp
  move_type: MoveRequestType; // 'store' or 'relocation'
  new_street?: string;
  new_city?: string;
  new_zip?: string;
  new_latitude?: number;
  new_longitude?: number;
  reason?: string;
  notes?: string;
  reason_category?: string; // 'landlord_complaint' | 'theft' | 'vandalism' | 'missing' | 'relocation_request' | 'other'
  create_no_go_zone?: boolean;
  assign_to_shift_id?: string; // Optional: auto-assign to shift
}

export async function createMoveRequest(params: CreateMoveRequestParams): Promise<MoveRequest> {
  const response = await fetch(`${API_BASE_URL}/api/manager/bins/schedule-move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to create move request: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Assign move request to a shift
 */
export interface AssignMoveToShiftParams {
  move_request_id: string;
  shift_id?: string; // Optional - auto-find active shift if not provided
  insert_after_bin_id?: string; // For active shifts - insert after specific bin
  insert_position?: 'start' | 'end'; // For future shifts - general position
  move_order?: string[]; // Array of move request IDs in desired order
}

export async function assignMoveToShift(params: AssignMoveToShiftParams): Promise<void> {
  const { move_request_id, ...body } = params;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚚 [API] assignMoveToShift CALLED');
  console.log('   Move Request ID:', move_request_id);
  console.log('   Shift ID:', body.shift_id || 'auto-find active');
  console.log('   Insert after bin:', body.insert_after_bin_id || 'N/A');
  console.log('   Insert position:', body.insert_position || 'N/A');
  console.log('   Full body:', JSON.stringify(body, null, 2));

  const url = `${API_BASE_URL}/api/manager/bins/move-requests/${move_request_id}/assign-to-shift`;
  console.log('   API URL:', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    console.log('   Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API] assignMoveToShift FAILED');
      console.error('   Status:', response.status);
      console.error('   Error:', errorText);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw new Error(`Failed to assign move to shift: ${response.statusText} - ${errorText}`);
    }

    console.log('✅ [API] assignMoveToShift SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ [API] assignMoveToShift EXCEPTION');
    console.error('   Error:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }
}

/**
 * Bulk assign multiple move requests to a shift
 */
export interface BulkAssignMovesParams {
  move_request_ids: string[];
  shift_id?: string;
  insert_after_bin_id?: string;
  insert_position?: 'start' | 'end';
  move_order?: string[]; // Order of move request IDs
}

export async function bulkAssignMoves(params: BulkAssignMovesParams): Promise<void> {
  // For bulk operations, we'll call the assign endpoint for each move
  // In the future, this could be optimized with a dedicated bulk endpoint
  const { move_request_ids, move_order, ...assignParams } = params;

  const orderedIds = move_order || move_request_ids;

  for (const id of orderedIds) {
    await assignMoveToShift({
      move_request_id: id,
      ...assignParams,
    });
  }
}

/**
 * Cancel a move request
 */
export async function cancelMoveRequest(moveRequestId: string, reason?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/manager/bins/move-requests/${moveRequestId}/cancel`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel move request: ${response.statusText}`);
  }
}

/**
 * Update a move request (edit date, notes, location, assignment, etc.)
 */
export interface UpdateMoveRequestParams {
  // Basic fields
  scheduled_date?: number;
  reason?: string;
  notes?: string;
  new_street?: string;
  new_city?: string;
  new_zip?: string;
  new_latitude?: number;
  new_longitude?: number;

  // Assignment fields
  assigned_shift_id?: string | null;
  assigned_user_id?: string | null;
  assignment_type?: 'shift' | 'manual' | '';

  // Edge case handling
  client_updated_at?: number;                // For optimistic locking
  confirm_active_shift_change?: boolean;      // User confirmed warning
  in_progress_action?: 'remove_from_route' | 'insert_after_current' | 'reoptimize_route'; // For in-progress moves
  insert_after_waypoint?: number;             // For manual waypoint insertion
}

export async function updateMoveRequest(
  moveRequestId: string,
  params: UpdateMoveRequestParams
): Promise<MoveRequest> {
  const response = await fetch(`${API_BASE_URL}/api/manager/bins/move-requests/${moveRequestId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Check for specific error codes
    if (response.status === 409) {
      throw new Error(errorText || 'This move request was modified by another user. Please refresh and try again.');
    }
    throw new Error(errorText || `Failed to update move request: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Bulk cancel multiple move requests
 */
export async function bulkCancelMoves(moveRequestIds: string[], reason?: string): Promise<void> {
  for (const id of moveRequestIds) {
    await cancelMoveRequest(id, reason);
  }
}

/**
 * Get a single move request by ID
 */
export async function getMoveRequest(moveRequestId: string): Promise<MoveRequest> {
  const response = await fetch(`${API_BASE_URL}/api/manager/bins/move-requests/${moveRequestId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch move request: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Assign move request to a user (one-off assignment)
 */
export interface AssignMoveToUserParams {
  move_request_id: string;
  user_id: string;
}

export async function assignMoveToUser(params: AssignMoveToUserParams): Promise<void> {
  const { move_request_id, user_id } = params;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 [API] assignMoveToUser CALLED');
  console.log('   Move Request ID:', move_request_id);
  console.log('   User ID:', user_id);

  const url = `${API_BASE_URL}/api/manager/bins/move-requests/${move_request_id}/assign-to-user`;
  console.log('   API URL:', url);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ user_id }),
    });

    console.log('   Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API] assignMoveToUser FAILED');
      console.error('   Status:', response.status);
      console.error('   Error:', errorText);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw new Error(`Failed to assign move to user: ${response.statusText} - ${errorText}`);
    }

    console.log('✅ [API] assignMoveToUser SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ [API] assignMoveToUser EXCEPTION');
    console.error('   Error:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }
}

/**
 * Clear shift assignment from a move request (sets status back to pending)
 * TODO: Backend needs to implement proper endpoint - for now this is a workaround
 */
export async function clearMoveAssignment(moveRequestId: string): Promise<void> {
  // NOTE: This needs a backend endpoint like:
  // PUT /api/manager/bins/move-requests/:id/clear-assignment
  // For now, we'll show an alert
  throw new Error('Clear assignment endpoint not yet implemented on backend');
}

/**
 * Get move request history (audit trail)
 */
export async function getMoveRequestHistory(
  moveRequestId: string
): Promise<MoveRequestHistoryEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/manager/bins/move-requests/${moveRequestId}/history`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch move request history: ${response.statusText}`);
  }

  return response.json();
}
