const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return { 'Content-Type': 'application/json' };
    const token = JSON.parse(authStorage)?.state?.token;
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

export interface AIRecommendation {
  id: string;
  type: string;
  entity_type: string;
  entity_id?: string;
  title: string;
  description: string;
  severity: string;
  recommended_action?: string;
  status: string;
  source: string;
  reasoning?: string;
  created_at: number;
  expires_at?: number;
  actioned_at?: number;
  actioned_by_user_id?: string;
  snoozed_until?: number;
}

export interface RecommendationsResponse {
  recommendations: AIRecommendation[];
  counts: {
    total: number;
    pending: number;
    accepted: number;
    dismissed: number;
    snoozed: number;
  };
}

export async function getRecommendations(status?: string, type?: string): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (type) params.append('type', type);

  const resp = await fetch(`${API_URL}/api/manager/ai-recommendations?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to fetch recommendations');
  return resp.json();
}

export async function getPendingCount(): Promise<number> {
  const resp = await fetch(`${API_URL}/api/manager/ai-recommendations/pending-count`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) return 0;
  const data = await resp.json();
  return data.count || 0;
}

export async function acceptRecommendation(id: string): Promise<void> {
  const resp = await fetch(`${API_URL}/api/manager/ai-recommendations/${id}/accept`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to accept recommendation');
}

export async function dismissRecommendation(id: string): Promise<void> {
  const resp = await fetch(`${API_URL}/api/manager/ai-recommendations/${id}/dismiss`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to dismiss recommendation');
}

export async function snoozeRecommendation(id: string, snoozeUntil?: number): Promise<void> {
  const resp = await fetch(`${API_URL}/api/manager/ai-recommendations/${id}/snooze`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ snooze_until: snoozeUntil }),
  });
  if (!resp.ok) throw new Error('Failed to snooze recommendation');
}
