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

export interface ChatResponse {
  response: string;
  tool_calls_made?: string[];
  conversation_id: string;
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
