/**
 * No-Go Zone types matching backend API
 */

export type ZoneStatus = 'active' | 'monitoring' | 'resolved';
export type IncidentType = 'vandalism' | 'landlord_complaint' | 'theft' | 'relocation_request' | 'missing';
export type IncidentStatus = 'open' | 'resolved' | 'investigating';

export type ZoneResolutionType = 'merged' | 'manual_resolution';

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
  // Merge fields (present when zone was consumed by or consumed another zone)
  resolution_type?: ZoneResolutionType;
  merged_into_zone_id?: string;  // set on the consumed zone
  merged_zone_count?: number;    // count of zones this zone has absorbed
}

export interface ZoneIncident {
  id: string;
  zone_id: string;
  bin_id?: string; // nil for address-only manager reports
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
  // Mode 1: bin-linked (bin_id provided → coordinates looked up automatically)
  bin_id?: string;
  // Mode 2: address-only (no bin, manager geocoded the address)
  latitude?: number;
  longitude?: number;
  address?: string;
  // Common fields
  incident_type: IncidentType;
  description: string;
}

/**
 * Get severity label
 */
export function getSeverityLabel(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (severity) {
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    case 'critical': return 'Critical';
  }
}
