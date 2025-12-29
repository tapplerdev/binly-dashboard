/**
 * Route types for waste collection routes
 * Routes are reusable templates that define standard collection patterns
 */

export interface Route {
  id: string;
  name: string; // e.g., "Route 1 - East Side"
  description?: string;
  bin_count: number;
  bin_ids: string[]; // Array of bin IDs assigned to this route
  geographic_area: string; // e.g., "North Sector", "Central", "East Side"
  estimated_duration_hours: number;
  schedule_pattern?: string; // e.g., "Mon/Wed/Fri", "Tue/Thu/Sat"
  created_at?: string;
  updated_at?: string;
}

/**
 * Get route display label for UI
 */
export function getRouteLabel(route: Route): string {
  return `${route.name} • ${route.bin_count} bins`;
}

/**
 * Get route schedule display
 */
export function getRouteSchedule(route: Route): string {
  return route.schedule_pattern || 'No fixed schedule';
}
