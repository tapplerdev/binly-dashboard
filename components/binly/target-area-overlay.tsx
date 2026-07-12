'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { polygonToCells, cellToBoundary } from 'h3-js';
import type { TargetArea } from '@/components/ui/area-autocomplete';
import { getAreaBoundary, type AreaGeometry } from '@/lib/api/areas';

const PURPLE = '#7C3AED';

/**
 * Visualizes a picked target area on the map: flies the camera there and
 * outlines it.
 *
 * When the backend has the area's TRUE legal boundary (an incorporated city,
 * from TIGER), it draws that real polygon — annexation slivers, holes and all —
 * so "this is the San Jose you meant" reads exactly. When it doesn't (a
 * district like Brentwood, a county, or an unknown city — TIGER covers cities
 * only), it falls back to the search bounding box tiled with h3 hexagons, i.e.
 * the geometry the recommender actually sweeps. The UX never dead-ends.
 *
 * Imperative google.maps overlays (no Polygon component in @vis.gl); the true
 * polygon uses a dedicated Data layer so MultiPolygons and holes render in one
 * call and clean up as a unit.
 */
export function TargetAreaOverlay({ area }: { area: TargetArea | null }) {
  const map = useMap();
  // Only the latest pick may draw: an earlier boundary fetch that resolves late
  // must not paint a stale shape over the current one.
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!map || !area) return;
    const seq = ++reqSeq.current;

    const overlays: Array<google.maps.Polygon | google.maps.Rectangle> = [];
    let dataLayer: google.maps.Data | null = null;

    // Provisional bbox (HERE mapView, or a ~2 km box when absent).
    const [w, s, e, n] = area.bbox ?? [
      area.lng - 0.02, area.lat - 0.015, area.lng + 0.02, area.lat + 0.015,
    ];
    // Fly immediately so the map reacts before the boundary fetch returns.
    map.fitBounds(new google.maps.LatLngBounds({ lat: s, lng: w }, { lat: n, lng: e }), 48);

    // Tile a polygon (array of GeoJSON-order rings, or [lat,lng] loops) with
    // hexagons sized to the area, skipping the fill for absurdly large areas.
    const drawHexes = (
      loops: number[][][],
      diagDeg: number,
      isGeoJson: boolean,
    ) => {
      const res = diagDeg < 0.06 ? 8 : diagDeg < 0.25 ? 7 : 6;
      try {
        const cells = polygonToCells(loops, res, isGeoJson);
        if (cells.length > 1500) return; // outline still conveys the area
        for (const cell of cells) {
          overlays.push(new google.maps.Polygon({
            paths: cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng })),
            strokeColor: PURPLE, strokeOpacity: 0.3, strokeWeight: 1,
            fillColor: PURPLE, fillOpacity: 0.07, clickable: false, map,
          }));
        }
      } catch {
        // h3 failure just means no hex fill — the outline still shows the area.
      }
    };

    // Fallback: the search rectangle + hexes over it (districts / unknown).
    const drawBboxFallback = () => {
      overlays.push(new google.maps.Rectangle({
        bounds: { north: n, south: s, east: e, west: w },
        strokeColor: PURPLE, strokeOpacity: 0.9, strokeWeight: 2,
        fillOpacity: 0, clickable: false, map,
      }));
      drawHexes([[[n, w], [n, e], [s, e], [s, w]]], Math.max(n - s, e - w), false);
    };

    // Collect the GeoJSON rings for hex tiling: MultiPolygon → each part's
    // rings; Polygon → its single ring set.
    const polygonsOf = (geom: AreaGeometry): number[][][][] =>
      geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];

    getAreaBoundary(area)
      .then((boundary) => {
        if (seq !== reqSeq.current) return; // superseded by a newer pick
        if (!boundary) { drawBboxFallback(); return; }

        // Real city polygon — Data layer handles MultiPolygon + holes + styling.
        dataLayer = new google.maps.Data({ map });
        dataLayer.addGeoJson({ type: 'Feature', geometry: boundary.geometry, properties: {} });
        dataLayer.setStyle({
          strokeColor: PURPLE, strokeOpacity: 0.95, strokeWeight: 2.5,
          fillColor: PURPLE, fillOpacity: 0.06, clickable: false,
        });

        // Re-fit to the true bbox (tighter/more accurate than HERE's).
        const [bw, bs, be, bn] = boundary.bbox;
        map.fitBounds(new google.maps.LatLngBounds({ lat: bs, lng: bw }, { lat: bn, lng: be }), 48);

        // Hexes tiling the real shape (deduped across MultiPolygon parts).
        const diag = Math.max(bn - bs, be - bw);
        const res = diag < 0.06 ? 8 : diag < 0.25 ? 7 : 6;
        const seen = new Set<string>();
        let tooMany = false;
        for (const poly of polygonsOf(boundary.geometry)) {
          let cells: string[] = [];
          try { cells = polygonToCells(poly, res, true); } catch { continue; }
          for (const c of cells) {
            seen.add(c);
            if (seen.size > 1500) { tooMany = true; break; }
          }
          if (tooMany) break;
        }
        if (!tooMany) {
          for (const cell of seen) {
            overlays.push(new google.maps.Polygon({
              paths: cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng })),
              strokeColor: PURPLE, strokeOpacity: 0.28, strokeWeight: 1,
              fillColor: PURPLE, fillOpacity: 0.07, clickable: false, map,
            }));
          }
        }
      })
      .catch(() => {
        if (seq === reqSeq.current) drawBboxFallback();
      });

    return () => {
      overlays.forEach((o) => o.setMap(null));
      if (dataLayer) dataLayer.setMap(null);
    };
  }, [map, area]);

  return null;
}
