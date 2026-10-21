import type { MarkerKind } from '@shared/diagram'
import { MARKER_ID } from '@shared/export/markerShapes'

// Split out from edgeMarkers.tsx: react-refresh/only-export-components flags
// a file exporting both a component and plain values/functions. The marker
// ids themselves live with the shapes (shared with the SVG export); this is
// the url(#id) helper LabeledEdge uses to reference them.
export { MARKER_ID }

export function markerUrl(kind: MarkerKind | undefined): string | undefined {
  if (!kind || kind === 'none') return undefined
  return `url(#${MARKER_ID[kind]})`
}
