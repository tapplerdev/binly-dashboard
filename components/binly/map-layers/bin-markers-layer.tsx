'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useBins } from '@/lib/hooks/use-bins';
import { Bin, isMappableBin, MappableBin, getBinMarkerColor } from '@/lib/types/bin';

interface BinMarkersLayerProps {
  /** Override bins instead of fetching via useBins */
  bins?: Bin[];
  /** Filter by status. Default: only active + pending_move */
  filter?: 'active' | 'all';
  /** Marker size. "sm" = 16px context dots, "md" = 24px, "lg" = 32px (live-map default) */
  size?: 'sm' | 'md' | 'lg';
  /** Show bin number label inside marker */
  showLabels?: boolean;
  /** Click handler */
  onBinClick?: (binId: string) => void;
  /** zIndex for markers */
  zIndex?: number;
  /** Statuses to exclude */
  excludeStatuses?: string[];
}

const SIZE_MAP = { sm: 16, md: 24, lg: 32 };
const FONT_MAP = { sm: 7, md: 9, lg: 11 };

/**
 * Renders bin markers on a Google Map — matches live-map-view.tsx pattern exactly.
 * Uses imperative AdvancedMarkerElement API for performance with many markers.
 * Must be a child of <GoogleMap>.
 */
export function BinMarkersLayer({
  bins: propBins,
  filter = 'active',
  size = 'lg',
  showLabels = true,
  onBinClick,
  zIndex = 10,
  excludeStatuses = ['in_storage', 'retired'],
}: BinMarkersLayerProps) {
  const map = useMap();
  const { data: hookBins } = useBins();
  const markersRef = useMemo<{ current: globalThis.Map<string, google.maps.marker.AdvancedMarkerElement> }>(
    () => ({ current: new globalThis.Map() }), []
  );

  const allBins = propBins || hookBins || [];
  const filteredBins: MappableBin[] = allBins
    .filter(isMappableBin)
    .filter(b => {
      if (excludeStatuses.includes(b.status)) return false;
      if (filter === 'active') return b.status === 'active' || b.status === 'pending_move';
      return true;
    });

  const handleClick = useCallback(
    (binId: string) => onBinClick?.(binId),
    [onBinClick]
  );

  const px = SIZE_MAP[size];
  const fontSize = FONT_MAP[size];

  useEffect(() => {
    if (!map || !google.maps.marker?.AdvancedMarkerElement) return;

    const prev = markersRef.current;
    const newIds = new Set(filteredBins.map(b => b.id));

    // Remove stale markers
    prev.forEach((marker, id) => {
      if (!newIds.has(id)) {
        marker.map = null;
        prev.delete(id);
      }
    });

    // Add new markers
    filteredBins.forEach((bin) => {
      if (prev.has(bin.id)) return;

      const bgColor = getBinMarkerColor(bin.fill_percentage, bin.status as any);
      const el = document.createElement('div');
      el.style.cssText = `
        width:${px}px;height:${px}px;border-radius:50%;
        background:${bgColor};border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:${fontSize}px;font-weight:700;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        cursor:pointer;transition:transform .15s;
      `;
      if (showLabels) {
        el.textContent = String(bin.bin_number);
      }
      el.title = `Bin #${bin.bin_number} — ${bin.status === 'missing' ? 'MISSING' : `${bin.fill_percentage ?? 0}%`}`;
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.15)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: bin.latitude, lng: bin.longitude },
        content: el,
        zIndex,
      });
      if (onBinClick) {
        marker.addListener('click', () => handleClick(bin.id));
      }
      prev.set(bin.id, marker);
    });

    return () => {};
  }, [map, filteredBins, handleClick, markersRef, px, fontSize, showLabels, zIndex, onBinClick]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => { m.map = null; });
      markersRef.current.clear();
    };
  }, [markersRef]);

  return null;
}
