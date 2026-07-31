/**
 * Credit lines for the embedded geographic datasets.
 *
 * These are LICENCE OBLIGATIONS, not courtesies. Three datasets the backend
 * compiles in require attribution wherever the data is surfaced:
 *
 *   - GeoNames city gazetteer .............. CC BY 4.0
 *   - Ontario municipal boundaries ......... Open Government Licence – Ontario
 *   - Los Angeles neighbourhoods ........... CC BY 4.0 (LA Times "Mapping L.A.")
 *
 * The California city boundaries are US Census TIGER/Line — public domain, no
 * notice required — so they are deliberately absent.
 *
 * Render this anywhere those boundaries are drawn or those city names are
 * listed. Today that is the Create Potential Location dialog, where the target-
 * area overlay and the AI recommendations both appear.
 *
 * Kept as static text rather than fetched from the backend's
 * geo.DataAttributions(): it is three constant strings, and a network round-trip
 * for legal boilerplate that changes once a year is not worth the failure mode
 * of the notice silently disappearing when the request fails. If a fourth
 * dataset is ever embedded, update both — the Go side is the source of truth.
 */
export function DataAttribution({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-gray-400 ${className}`}>
      Boundaries:{' '}
      <a
        href="https://www.ontario.ca/page/open-government-licence-ontario"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600"
      >
        Ontario MMAH (OGL&nbsp;–&nbsp;Ontario)
      </a>
      {' · '}
      <a
        href="http://maps.latimes.com/neighborhoods/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600"
      >
        LA&nbsp;Times
      </a>
      {' · US Census TIGER. Cities: '}
      <a
        href="https://www.geonames.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600"
      >
        GeoNames (CC&nbsp;BY&nbsp;4.0)
      </a>
      .
    </p>
  );
}
