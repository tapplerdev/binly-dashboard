import { Route } from '@/lib/types/route';

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
 * Get all available routes with their bin IDs
 */
export async function getRoutes(): Promise<Route[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/routes`, {
      headers: getAuthHeaders(),
    });

    // Handle authentication errors gracefully
    if (response.status === 401) {
      console.warn('⚠️  Backend requires authentication. Routes will not load until auth is implemented.');
      return [];
    }

    if (!response.ok) {
      throw new Error('Failed to fetch routes');
    }

    const routes = await response.json();

    // Handle empty database (backend returns null instead of [])
    if (!routes || routes === null) {
      console.info('No routes found in database');
      return [];
    }

    // Safety check for non-array responses
    if (!Array.isArray(routes)) {
      console.error('Invalid routes response (expected array):', routes);
      return [];
    }

    // Fetch bin IDs for each route by calling individual route endpoint
    const routesWithBins = await Promise.all(
      routes.map(async (route: Route) => {
        try {
          const detailsResponse = await fetch(`${API_BASE_URL}/api/routes/${route.id}`, {
            headers: getAuthHeaders(),
          });
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            // Extract bin IDs from bins array
            // Backend returns: { bins: [{ id: string, bin_number: int, sequence_order: int, ... }] }
            const binIds = details.bins?.map((bin: unknown) => {
              if (!bin) return null;

              // If bin is just a string ID
              if (typeof bin === 'string') {
                return bin;
              }

              // Handle object bin structures
              if (typeof bin === 'object') {
                const binObj = bin as Record<string, unknown>;

                // Direct id field (BinResponse embedded in BinInRoute)
                if (binObj.id && typeof binObj.id === 'string') {
                  return binObj.id;
                }

                // Nested bin object (in case of join query)
                if (binObj.bin && typeof binObj.bin === 'object') {
                  const nestedBin = binObj.bin as Record<string, unknown>;
                  if (nestedBin.id && typeof nestedBin.id === 'string') {
                    return nestedBin.id;
                  }
                }

                // bin_id field
                if (binObj.bin_id && typeof binObj.bin_id === 'string') {
                  return binObj.bin_id;
                }
              }

              console.warn('Unexpected bin structure:', bin);
              return null;
            }).filter(Boolean) || [];
            return { ...route, bin_ids: binIds };
          }
        } catch (error) {
          console.error(`Failed to fetch bins for route ${route.id}:`, error);
        }
        return route;
      })
    );

    return routesWithBins;
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
}

/**
 * Get a specific route by ID with bins
 */
export async function getRoute(routeId: string): Promise<Route | null> {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch route');
  }

  return response.json();
}

/**
 * Create a new route
 */
export async function createRoute(data: {
  name: string;
  description?: string;
  geographic_area: string;
  schedule_pattern?: string;
  bin_ids: string[];
  estimated_duration_hours?: number;
}): Promise<Route> {
  const response = await fetch(`${API_BASE_URL}/api/routes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create route');
  }

  return response.json();
}

/**
 * Update an existing route
 */
export async function updateRoute(
  routeId: string,
  data: {
    name?: string;
    description?: string;
    geographic_area?: string;
    schedule_pattern?: string;
    bin_ids?: string[];
    estimated_duration_hours?: number;
  }
): Promise<Route> {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update route');
  }

  return response.json();
}

/**
 * Delete a route
 */
export async function deleteRoute(routeId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete route');
  }
}

/**
 * Duplicate an existing route
 */
export async function duplicateRoute(routeId: string, name: string): Promise<Route> {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}/duplicate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to duplicate route');
  }

  return response.json();
}
