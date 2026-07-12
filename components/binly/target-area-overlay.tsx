'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { polygonToCells, cellToBoundary } from 'h3-js';
import type { TargetArea } from '@/components/ui/area-autocomplete';

/**
 * Visualizes a picked target area on the map: flies the camera to it, draws
 * the bounding box the recommender will actually search (dashed outline),
 * and tiles it with the same h3 hexagons as the Growth map so "this is the
 * area you picked" reads at a glance — including which Brentwood you meant.
 *
 * Deliberately shows the SEARCH GEOMETRY (bbox), not the municipal boundary:
 * highlighting the pretty official polygon would overpromise what the
 * algorithm sweeps. Imperative google.maps overlays (no Polygon component in
 * @vis.gl) — same pattern as the Growth hex overlay.
 */
export function TargetAreaOverlay({ area }: { area: TargetArea | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !area) return;

    // Fall back to a ~2km box around the center when HERE gave no mapView.
    const [w, s, e, n] = area.bbox ?? [
      area.lng - 0.02, area.lat - 0.015, area.lng + 0.02, area.lat + 0.015,
    ];

    map.fitBounds(
      new google.maps.LatLngBounds({ lat: s, lng: w }, { lat: n, lng: e }),
      48,
    );

    const overlays: Array<google.maps.Polygon | google.maps.Rectangle> = [];

    // The search box itself — dashed, honest.
    overlays.push(
      new google.maps.Rectangle({
        bounds: { north: n, south: s, east: e, west: w },
        strokeColor: '#7C3AED',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillOpacity: 0,
        clickable: false,
        map,
      }),
    );

    // Hex fill, resolution scaled to the box so big areas stay legible and
    // cheap. Skip the fill entirely (outline remains) if a huge area would
    // mint an absurd number of cells.
    const diag = Math.max(n - s, e - w);
    const res = diag < 0.06 ? 8 : diag < 0.25 ? 7 : 6;
    try {
      const cells = polygonToCells(
        [[[n, w], [n, e], [s, e], [s, w]]],
        res,
        false,
      );
      if (cells.length <= 600) {
        for (const cell of cells) {
          overlays.push(
            new google.maps.Polygon({
              paths: cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng })),
              strokeColor: '#7C3AED',
              strokeOpacity: 0.45,
              strokeWeight: 1,
              fillColor: '#7C3AED',
              fillOpacity: 0.08,
              clickable: false,
              map,
            }),
          );
        }
      }
    } catch {
      // h3 failure just means no hex fill — the outline still shows the area
    }

    return () => overlays.forEach((o) => o.setMap(null));
  }, [map, area]);

  return null;
}
