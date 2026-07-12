import type { TargetArea } from '@/components/ui/area-autocomplete';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

/** A GeoJSON Polygon or MultiPolygon (minimal shape — avoids a @types/geojson dep). */
export type AreaGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface AreaBoundary {
  name: string;
  namelsad: string;
  type: string;
  bbox: [number, number, number, number]; // west, south, east, north
  geometry: AreaGeometry;
}

/**
 * Fetches a picked area's TRUE legal boundary (TIGER city polygon) from the
 * backend, or null when there is no authoritative shape — a district, a county,
 * an unknown city, or a same-name city far from where the user picked. Callers
 * fall back to the search-bbox overlay on null.
 */
export async function getAreaBoundary(area: TargetArea): Promise<AreaBoundary | null> {
  const shortName = area.label.split(',')[0].trim();
  if (!shortName) return null;

  const params = new URLSearchParams({
    name: shortName,
    lat: String(area.lat),
    lng: String(area.lng),
  });
  if (area.type) params.set('type', area.type);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`${API_URL}/api/areas/boundary?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.found || !data.geometry) return null;
    return {
      name: data.name,
      namelsad: data.namelsad,
      type: data.type,
      bbox: data.bbox,
      geometry: data.geometry,
    };
  } catch {
    return null; // network error / timeout / abort — caller uses bbox fallback
  } finally {
    clearTimeout(timeout);
  }
}
