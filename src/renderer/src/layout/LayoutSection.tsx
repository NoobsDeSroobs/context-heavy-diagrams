import type { HiddenLabel } from '@shared/layout/labelClearance'

// An edge whose label does not fit in the gap between its two elements, with the elements' names for
// the row.
export interface LayoutEntry extends HiddenLabel {
  sourceName: string
  targetName: string
}

// The "Layout" block of the Diagnostics panel (ADR 0146): the edge labels that are partly hidden behind
// the elements they join. Click a row to find the edge on the canvas. Nothing is shown when there are
// none.
export default function LayoutSection({
  entries,
  onRevealEdge
}: {
  entries: LayoutEntry[]
  onRevealEdge: (entry: LayoutEntry) => void
}): React.JSX.Element | null {
  if (entries.length === 0) return null
  return (
    <div className="diagnostics-layout">
      <p className="diagnostics-section-title">Layout ({entries.length})</p>
      <p className="diagnostics-panel-hint">
        These edge labels do not fit in the space between the elements the edge joins, so they cover
        the edge or leave too little of it showing. Move the elements apart.
      </p>
      <ul className="diagnostics-conformance-list">
        {entries.map((entry) => (
          <li key={entry.edgeId} className="diagnostics-conformance-finding">
            <span className="diagnostics-conformance-severity severity-warning">warning</span>
            <button
              type="button"
              className="diagnostics-missing-file-target"
              title="Find this edge on the canvas"
              onClick={() => onRevealEdge(entry)}
            >
              &ldquo;{entry.label}&rdquo; between {entry.sourceName} and {entry.targetName}:{' '}
              {Math.round(entry.gap)} px of room, about {entry.needed} px needed
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
