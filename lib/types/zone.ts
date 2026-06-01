/**
 * No-Go Zone / Incident types matching backend API
 */

export type ZoneStatus = 'active' | 'monitoring' | 'resolved';
export type IncidentType = 'vandalism' | 'landlord_complaint' | 'theft' | 'relocation_request' | 'missing';
export type IncidentStatus = 'open' | 'resolved' | 'investigating';

export interface NoGoZone {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  status: ZoneStatus;
  created_by_user_id?: string;
  created_at_iso: string;
  updated_at_iso: string;
  resolved_by_user_id?: string;
  resolved_at_iso?: string;
  resolution_notes?: string;
  // Legacy fields (still in DB, no longer populated)
  radius_meters?: number;
  conflict_score?: number;
}

export interface ZoneIncident {
  id: string;
  zone_id: string;
  bin_id?: string;
  bin_number?: number;
  incident_type: IncidentType;
  reported_by_user_id?: string;
  reported_by_name?: string;
  reported_at_iso: string;
  description?: string;
  photo_url?: string;
  check_id?: number;
  move_id?: number;
  shift_id?: string;
  reporter_latitude?: number;
  reporter_longitude?: number;
  is_field_observation: boolean;
  verified_by_user_id?: string;
  verified_by_name?: string;
  verified_at_iso?: string;
  status: IncidentStatus;
}

export interface NearbyIncident {
  id: string;
  zone_id: string;
  incident_type: IncidentType;
  description?: string;
  distance_meters: number;
  reported_at: number;
  bin_number?: number;
  address?: string;
}

/**
 * Format incident type for display
 */
export function formatIncidentType(type: IncidentType): string {
  switch (type) {
    case 'vandalism':
      return 'Vandalism';
    case 'landlord_complaint':
      return 'Landlord Complaint';
    case 'theft':
      return 'Theft';
    case 'relocation_request':
      return 'Relocation Request';
    case 'missing':
      return 'Missing Bin';
  }
}

/**
 * Get icon for incident type
 */
export function getIncidentIcon(type: IncidentType): string {
  switch (type) {
    case 'vandalism':
      return '🔨';
    case 'landlord_complaint':
      return '📋';
    case 'theft':
      return '🚨';
    case 'relocation_request':
      return '📦';
    case 'missing':
      return '❓';
  }
}

/**
 * Request body for POST /manager/incident-report
 */
export interface CreateManagerIncidentRequest {
  bin_id?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  incident_type: IncidentType;
  description: string;
}
