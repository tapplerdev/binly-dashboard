import { apiFetch, getAuthHeaders } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

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
  // Core+halo enrichment (present when a target area is set):
  locality?: 'in_area' | 'near_area';
  distance_from_area_mi?: number;
  area_match?: number; // 0..1 similarity to the area profile
}

export interface ChatResponse {
  response: string;
  tool_calls_made?: string[];
  conversation_id: string;
  recommendations?: {
    count: number;
    requested?: number;
    in_area_count?: number;
    nearby_count?: number;
    recommendations: LocationRecommendation[];
  };
}

export interface ChatTargetArea {
  label: string;
  type?: string; // HERE area type (city / district / county) — gates the true-boundary lookup backend-side
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // west, south, east, north
}

export async function sendChatMessage(
  message: string,
  conversationId?: string,
  targetArea?: ChatTargetArea | null,
  includeNearby?: boolean,
  expansionRadiusMiles?: number,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minute timeout

  try {
    const resp = await apiFetch(`${API_URL}/api/manager/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        ...(targetArea ? { target_area: targetArea } : {}),
        ...(includeNearby !== undefined ? { include_nearby: includeNearby } : {}),
        // The distance slider. Sent as a top-level field so the backend injects
        // it into the tool call deterministically — routed through the prose
        // instead, the model is free to ignore or "round" it.
        ...(expansionRadiusMiles !== undefined
          ? { expansion_radius_miles: expansionRadiusMiles }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(errorData.error || `Chat request failed: ${resp.statusText}`);
    }

    return resp.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the AI is taking too long. Try a smaller count or specific city.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
