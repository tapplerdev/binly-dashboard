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

export interface LocationRecommendation {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  zip: string;
  score: number;
  reasoning: string;
  nearest_bin_number: number;
  nearest_bin_distance_miles: number;
  area_avg_fill_rate: number;
  median_income?: number;
}

export interface ChatResponse {
  response: string;
  tool_calls_made?: string[];
  conversation_id: string;
  recommendations?: {
    count: number;
    recommendations: LocationRecommendation[];
  };
}

export async function sendChatMessage(message: string, conversationId?: string): Promise<ChatResponse> {
  const resp = await fetch(`${API_URL}/api/manager/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(errorData.error || `Chat request failed: ${resp.statusText}`);
  }

  return resp.json();
}
