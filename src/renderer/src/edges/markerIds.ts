import type { MarkerKind } from '@shared/diagram'
import { MARKER_ID } from '@shared/export/markerShapes'

// Split out from edgeMarkers.tsx: react-refresh/only-export-components flags
// a file exporting both a component and plain values/functions. The marker
// ids themselves live with the shapes (shared with the SVG export); this is
// the url(#id) helper LabeledEdge uses to reference them.
export { MARKER_ID }

// The default end marker of an edge, as React Flow's `defaultEdgeOptions.markerEnd` wants it: the
// bare marker id. React Flow wraps whatever string it is given in `url('#…')` before handing it to
// the edge, so a `url(#id)` string here becomes `url('#url(#id)')`, which names no element, and
// every edge without an explicit end marker is drawn as a plain line (docs/known-issues.md).
export const DEFAULT_EDGE_MARKER_END = MARKER_ID.arrowClosed

export function markerUrl(kind: MarkerKind | undefined): string | undefined {
  if (!kind || kind === 'none') return undefined
  return `url(#${MARKER_ID[kind]})`
}
