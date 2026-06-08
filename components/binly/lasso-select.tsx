"use client";

/**
 * Shared bin lasso-selection — currently DISABLED.
 *
 * Google decommissioned `google.maps.drawing.DrawingManager` in the Maps JavaScript API
 * (deprecated Aug 2025, removed in v3.65 / May 2026) — its constructor now throws
 * "DrawingManager … is no longer available". Google provides no official replacement, so
 * lasso bin-selection is turned off until we migrate to an alternative (e.g. TerraDraw or a
 * hand-rolled polygon + geometry.poly.containsLocation).
 *
 * The create-route-modal, template-editor-modal and bin-selection-map components render this
 * in place of the old DrawingManager. When re-enabling, implement the drawing here once and
 * all three pick it up.
 */
export interface LassoSelectProps {
  // Permissive on purpose: the call sites pass different shapes
  // (lassoMode/isActive, bins/allBins, onBinsSelected(Bin[]) | onBinsSelected(string[])).
  // All ignored while disabled.
  [key: string]: unknown;
}

export function LassoSelect(_props: LassoSelectProps) {
  // Disabled: no DrawingManager construction = no crash. Renders nothing.
  return null;
}
