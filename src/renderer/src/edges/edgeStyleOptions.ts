import type { MarkerKind } from '@shared/diagram'

// Shared option lists for edge/line marker + line-style selects — used by
// the Property panel's EdgeFields/LineFields and by the edge direction
// set's default-style editor (ADR 0083). Plain data, its own module so it
// can be imported without pulling in a component (Fast Refresh
// only-export-components).
export const MARKER_OPTIONS: { value: MarkerKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrowOpen', label: 'Open arrow' },
  { value: 'arrowClosed', label: 'Closed arrow' },
  { value: 'circle', label: 'Circle' },
  { value: 'circleFilled', label: 'Filled circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'diamondFilled', label: 'Filled diamond' },
  { value: 'crowsFootOne', label: "Crow's foot — one" },
  { value: 'crowsFootMany', label: "Crow's foot — many" },
  { value: 'crowsFootOneOrMany', label: "Crow's foot — one or many" },
  { value: 'crowsFootZeroOrOne', label: "Crow's foot — zero or one" },
  { value: 'crowsFootZeroOrMany', label: "Crow's foot — zero or many" }
]

export const LINE_STYLE_OPTIONS: { value: 'solid' | 'dashed' | 'dotted'; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' }
]
