/**
 * Label sizing for circular map markers.
 *
 * The markers are fixed-diameter circles with a fixed font size, and bin numbers
 * are not fixed width. At 32px with an 11px bold font, a 4-digit number like
 * 9001 needs ~27px of glyph inside a ~24px usable interior — so it collides with
 * the white ring. 5 digits would be worse.
 *
 * The fix is to shrink the TEXT, not grow the circle. Circle size has to stay
 * constant because colour already encodes fill level; a marker that grew with
 * its bin number would read as "this bin matters more", which is a signal we
 * don't mean and can't turn off.
 *
 * Lives here rather than in a component because three separate files build this
 * same marker — live-map-view, map-layers/bin-markers-layer, and
 * airtag-map-view — each with its own copy of the CSS. Fixing one would have
 * left the other two wrong.
 */

/** White ring around each marker, per side. */
const BORDER_PX = 2;
/** Breathing room so glyphs never touch the ring. */
const INNER_PAD_PX = 2;
/**
 * Advance width of one bold digit, as a fraction of font size. Measured against
 * the system sans stack these markers use; tabular-nums keeps every digit at
 * this width, so a number of 1s is as wide as a number of 8s.
 */
const DIGIT_ASPECT = 0.62;
/** Below this a label is decoration, not information. */
const MIN_FONT_PX = 6;

/**
 * Largest font size at which `text` fits inside a circle of `diameterPx`,
 * never exceeding `maxFontPx`.
 *
 * Returns MIN_FONT_PX rather than something illegible when the text genuinely
 * cannot fit — at that point the caller should be passing showLabels={false},
 * which every small-marker caller already does.
 */
export function markerFontSize(diameterPx: number, text: string, maxFontPx: number): number {
  const usable = diameterPx - 2 * (BORDER_PX + INNER_PAD_PX);
  const chars = Math.max(text.length, 1);
  const fitted = Math.floor(usable / (chars * DIGIT_ASPECT));
  return Math.max(MIN_FONT_PX, Math.min(maxFontPx, fitted));
}

/**
 * The text-rendering CSS for a marker label, sized to fit.
 *
 * `tabular-nums` matters here: proportional digits make 1s narrow, so the same
 * 4-digit number can fit or not depending on which digits it contains. Tabular
 * makes the width predictable, which is what markerFontSize assumes.
 */
export function markerLabelCss(diameterPx: number, text: string, maxFontPx: number): string {
  const size = markerFontSize(diameterPx, text, maxFontPx);
  return [
    `font-size:${size}px`,
    'font-weight:700',
    'line-height:1',
    'font-variant-numeric:tabular-nums',
    // Long labels get a hair of negative tracking — buys roughly one character
    // at 4+ digits without visibly distorting the number.
    `letter-spacing:${text.length >= 4 ? '-0.03em' : '0'}`,
  ].join(';');
}
