/**
 * API functions for bin move requests
 */

import { MoveRequest, MoveRequestStatus, MoveRequestType, DisposalAction } from '@/lib/types/bin';

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
  move_type: MoveRequestType;
  disposal_action?: DisposalAction;
  new_street?: string;
  new_city?: string;
  new_zip?: string;
  new_latitude?: number;
  new_longitude?: number;
  reason?: string;
  notes?: string;
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

  const response = await fetch(`${API_BASE_URL}/api/manager/bins/move-requests/${move_request_id}/assign-to-shift`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to assign move to shift: ${response.statusText}`);
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
 * Update a move request (edit date, notes, etc.)
 */
export interface UpdateMoveRequestParams {
  scheduled_date?: number;
  reason?: string;
  notes?: string;
  new_street?: string;
  new_city?: string;
  new_zip?: string;
  new_latitude?: number;
  new_longitude?: number;
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
    throw new Error(`Failed to update move request: ${response.statusText}`);
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
 * Clear shift assignment from a move request (sets status back to pending)
 * TODO: Backend needs to implement proper endpoint - for now this is a workaround
 */
export async function clearMoveAssignment(moveRequestId: string): Promise<void> {
  // NOTE: This needs a backend endpoint like:
  // PUT /api/manager/bins/move-requests/:id/clear-assignment
  // For now, we'll show an alert
  throw new Error('Clear assignment endpoint not yet implemented on backend');
}
