/**
 * No-Go Zone types matching backend API
 */

export type ZoneStatus = 'active' | 'monitoring' | 'resolved';
export type IncidentType = 'vandalism' | 'landlord_complaint' | 'theft' | 'relocation_request';
export type IncidentStatus = 'open' | 'resolved' | 'investigating';

export interface NoGoZone {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  conflict_score: number;
  status: ZoneStatus;
  created_by_user_id?: string;
  created_at_iso: string;
  updated_at_iso: string;
  resolved_by_user_id?: string;
  resolved_at_iso?: string;
  resolution_notes?: string;
}

export interface ZoneIncident {
  id: string;
  zone_id: string;
  bin_id: string;
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

/**
 * Get severity level based on conflict score
 */
export function getZoneSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 16) return 'low';
  if (score < 31) return 'medium';
  if (score < 51) return 'high';
  return 'critical';
}

/**
 * Get color for zone polygon based on severity
 */
export function getZoneColor(score: number): string {
  const severity = getZoneSeverity(score);
  switch (severity) {
    case 'low':
      return '#F59E0B'; // amber-500
    case 'medium':
      return '#F97316'; // orange-500
    case 'high':
      return '#EF4444'; // red-500
    case 'critical':
      return '#DC2626'; // red-600
  }
}

/**
 * Get rgba color for zone marker with transparency
 */
export function getZoneColorRgba(score: number, alpha: number = 0.4): string {
  const severity = getZoneSeverity(score);
  switch (severity) {
    case 'low':
      return `rgba(245, 158, 11, ${alpha})`; // amber-500
    case 'medium':
      return `rgba(249, 115, 22, ${alpha})`; // orange-500
    case 'high':
      return `rgba(239, 68, 68, ${alpha})`; // red-500
    case 'critical':
      return `rgba(220, 38, 38, ${alpha})`; // red-600
  }
}

/**
 * Get zone opacity based on status
 */
export function getZoneOpacity(status: ZoneStatus): number {
  switch (status) {
    case 'active':
      return 0.4;
    case 'monitoring':
      return 0.25;
    case 'resolved':
      return 0.1;
  }
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
  }
}
