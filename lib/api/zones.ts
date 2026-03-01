/**
 * No-Go Zones API service
 */

import { CreateManagerIncidentRequest, NoGoZone, ZoneIncident } from '@/lib/types/zone';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
  } catch {
    return null;
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch all no-go zones
 */
export async function getNoGoZones(status?: string): Promise<NoGoZone[]> {
  try {
    const url = status
      ? `${API_URL}/api/no-go-zones?status=${status}`
      : `${API_URL}/api/no-go-zones`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zones: ${response.statusText}`);
    }

    const zones: NoGoZone[] = await response.json();
    return zones;
  } catch (error) {
    console.error('Error fetching zones:', error);
    throw error;
  }
}

/**
 * Fetch single zone by ID
 */
export async function getNoGoZone(id: string): Promise<NoGoZone> {
  try {
    const response = await fetch(`${API_URL}/api/no-go-zones/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zone: ${response.statusText}`);
    }

    const zone: NoGoZone = await response.json();
    return zone;
  } catch (error) {
    console.error(`Error fetching zone ${id}:`, error);
    throw error;
  }
}

/**
 * Fetch incidents for a zone
 */
export async function getZoneIncidents(zoneId: string): Promise<ZoneIncident[]> {
  try {
    const response = await fetch(`${API_URL}/api/no-go-zones/${zoneId}/incidents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch incidents: ${response.statusText}`);
    }

    const incidents: ZoneIncident[] = await response.json();
    return incidents;
  } catch (error) {
    console.error(`Error fetching incidents for zone ${zoneId}:`, error);
    throw error;
  }
}

/**
 * Fetch field observations (for manager review)
 */
export async function getFieldObservations(status?: 'all' | 'pending' | 'verified'): Promise<ZoneIncident[]> {
  try {
    const url = status
      ? `${API_URL}/api/field-observations?status=${status}`
      : `${API_URL}/api/field-observations`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch field observations: ${response.statusText}`);
    }

    const observations: ZoneIncident[] = await response.json();
    return observations;
  } catch (error) {
    console.error('Error fetching field observations:', error);
    throw error;
  }
}

/**
 * Verify a field observation
 */
export async function verifyFieldObservation(incidentId: string): Promise<ZoneIncident> {
  try {
    const response = await fetch(`${API_URL}/api/field-observations/${incidentId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to verify observation: ${response.statusText}`);
    }

    const incident: ZoneIncident = await response.json();
    return incident;
  } catch (error) {
    console.error(`Error verifying observation ${incidentId}:`, error);
    throw error;
  }
}

/**
 * Fetch incidents reported during a specific shift
 */
export async function getShiftIncidents(shiftId: string): Promise<ZoneIncident[]> {
  try {
    const response = await fetch(`${API_URL}/api/shifts/${shiftId}/incidents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shift incidents: ${response.statusText}`);
    }

    const incidents: ZoneIncident[] = await response.json();
    return incidents;
  } catch (error) {
    console.error(`Error fetching incidents for shift ${shiftId}:`, error);
    throw error;
  }
}

/**
 * Submit a manager phone-call incident report
 * POST /manager/incident-report (requires auth)
 */
export async function createManagerIncidentReport(
  payload: CreateManagerIncidentRequest,
): Promise<{ incident_id: string; zone_id: string; message: string }> {
  const response = await fetch(`${API_URL}/api/manager/incident-report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || `Request failed: ${response.status}`);
  }

  return response.json();
}
