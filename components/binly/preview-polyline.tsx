'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Road-snapped, animated route line through an ORDERED list of points.
 * Geometry comes from the Mapbox Directions API (chunked past its 25-coordinate
 * limit); if Mapbox is unavailable it falls back to straight legs and reports that
 * via onGeometryStatus so the caller can surface a "showing direct lines" note.
 *
 * Standalone (not tied to any one caller's shape) so the shift composer and the
 * route-preview modal can both use it. Pass a memoized `path` — the draw effect
 * re-runs on path identity change.
 */
export function RoutePreviewPolyline({
  path,
  onGeometryStatus,
}: {
  path: LatLng[];
  onGeometryStatus?: (roadSnapped: boolean) => void;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
    if (!map || path.length < 2) return;

    const waypoints: [number, number][] = path.map((p) => [p.longitude, p.latitude]);
    let cancelled = false;

    const fetchGeometry = async (): Promise<google.maps.LatLngLiteral[]> => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) throw new Error('no mapbox token');
      const result: google.maps.LatLngLiteral[] = [];
      for (let start = 0; start < waypoints.length - 1; start += 24) {
        const chunk = waypoints.slice(start, Math.min(start + 25, waypoints.length));
        if (chunk.length < 2) break;
        const coords = chunk.map(([lng, lat]) => `${lng},${lat}`).join(';');
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`
        );
        if (!res.ok) throw new Error('directions failed');
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as
          | [number, number][]
          | undefined;
        if (!geometry) throw new Error('no geometry');
        for (const [lng, lat] of geometry) result.push({ lat, lng });
      }
      return result;
    };

    const draw = (fullPath: google.maps.LatLngLiteral[]) => {
      if (cancelled || fullPath.length < 2) return;
      const line = new google.maps.Polyline({
        path: [],
        geodesic: false,
        strokeColor: '#4880FF',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      polylineRef.current = line;
      const step = Math.max(1, Math.ceil(fullPath.length / 96));
      let idx = 0;
      const tick = () => {
        if (cancelled) return;
        idx = Math.min(fullPath.length, idx + step);
        line.setPath(fullPath.slice(0, idx));
        if (idx < fullPath.length) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);
    };

    fetchGeometry()
      .then((p) => {
        if (cancelled) return;
        onGeometryStatus?.(true);
        draw(p);
      })
      .catch(() => {
        if (cancelled) return;
        onGeometryStatus?.(false);
        draw(waypoints.map(([lng, lat]) => ({ lat, lng })));
      });

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
    // onGeometryStatus is intentionally excluded — the draw depends only on map+path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, path]);

  return null;
}
