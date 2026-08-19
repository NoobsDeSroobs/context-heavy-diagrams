import type { MarkerKind } from '@shared/diagram'

// Split out from edgeMarkers.tsx: react-refresh/only-export-components flags
// a file exporting both a component and plain values/functions. Marker id
// map + the url(#id) helper LabeledEdge uses to reference them.
export const MARKER_ID: Record<Exclude<MarkerKind, 'none'>, string> = {
  arrowOpen: 'chd-marker-arrow-open',
  arrowClosed: 'chd-marker-arrow-closed',
  circle: 'chd-marker-circle',
  circleFilled: 'chd-marker-circle-filled',
  diamond: 'chd-marker-diamond',
  diamondFilled: 'chd-marker-diamond-filled',
  crowsFootOne: 'chd-marker-crows-one',
  crowsFootMany: 'chd-marker-crows-many',
  crowsFootOneOrMany: 'chd-marker-crows-one-or-many',
  crowsFootZeroOrOne: 'chd-marker-crows-zero-or-one',
  crowsFootZeroOrMany: 'chd-marker-crows-zero-or-many'
}

export function markerUrl(kind: MarkerKind | undefined): string | undefined {
  if (!kind || kind === 'none') return undefined
  return `url(#${MARKER_ID[kind]})`
}
