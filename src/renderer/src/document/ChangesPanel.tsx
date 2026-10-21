import type { ChangedElement, ChangesSinceSave } from '@shared/document/changesSinceSave'

// An element with unsaved Details content — sourced from noteShadows'
// existing dirty flag (ADR 0092), not a new tracking mechanism. See ADR 0102.
export interface DetailsChangedEntry {
  nodeId: string
  label: string
}

interface ChangesPanelProps {
  // null while the first diff hasn't resolved yet (the reread IPC is async).
  diff: ChangesSinceSave | null
  detailsChanged: DetailsChangedEntry[]
  // True when currentPath is null — comparing against an empty diagram
  // rather than a file on disk (never saved yet).
  neverSaved: boolean
  onRefresh: () => void
  // Select + frame the element on canvas — works for both a node and an
  // edge id (see Canvas.tsx's focusSearchMatch).
  onReveal: (id: string) => void
  onClose: () => void
}

function ElementRow({
  el,
  onReveal
}: {
  el: ChangedElement
  onReveal: (id: string) => void
}): React.JSX.Element {
  return (
    <li className="changes-row">
      <button
        type="button"
        className="changes-row-target"
        title="Find this element on the canvas"
        onClick={() => onReveal(el.id)}
      >
        <span className="changes-row-kind">{el.kind}</span>
        <span className="changes-row-label">{el.label}</span>
      </button>
      {el.changedFields && el.changedFields.length > 0 && (
        <span className="changes-row-fields">{el.changedFields.join(', ')}</span>
      )}
    </li>
  )
}

function Section({
  title,
  elements,
  onReveal
}: {
  title: string
  elements: ChangedElement[]
  onReveal: (id: string) => void
}): React.JSX.Element | null {
  if (elements.length === 0) return null
  return (
    <div className="changes-section">
      <p className="diagnostics-section-title">
        {title} ({elements.length})
      </p>
      <ul className="changes-row-list">
        {elements.map((el) => (
          <ElementRow key={`${el.kind}-${el.id}`} el={el} onReveal={onReveal} />
        ))}
      </ul>
    </div>
  )
}

// Fixed right-side dock, same shell/toggle model as Diagnostics/Layers (ADR
// 0013) — see ADR 0102. v1 covers nodes/edges only; the
// top-level collections (highlights, legend, requiredTags, …) are a
// deliberate fast-follow, not shown here.
export default function ChangesPanel({
  diff,
  detailsChanged,
  neverSaved,
  onRefresh,
  onReveal,
  onClose
}: ChangesPanelProps): React.JSX.Element {
  const empty =
    diff !== null &&
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.modified.length === 0 &&
    detailsChanged.length === 0

  return (
    <div className="changes-panel">
      <div className="diagnostics-panel-toolbar">
        <span className="diagnostics-panel-title">Changes since last save</span>
        <div className="details-panel-spacer" />
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="changes-panel-body">
        {neverSaved && (
          <p className="diagnostics-panel-hint">
            This diagram has never been saved — comparing against a blank diagram.
          </p>
        )}
        {diff === null && (
          <p className="diagnostics-panel-empty">Comparing against the saved file…</p>
        )}
        {empty && (
          <p className="diagnostics-panel-empty">No changes since the file was last saved.</p>
        )}
        {diff && (
          <>
            <Section title="Modified" elements={diff.modified} onReveal={onReveal} />
            <Section title="Added" elements={diff.added} onReveal={onReveal} />
            <Section title="Removed" elements={diff.removed} onReveal={onReveal} />
          </>
        )}
        {detailsChanged.length > 0 && (
          <div className="changes-section">
            <p className="diagnostics-section-title">Details changed ({detailsChanged.length})</p>
            <ul className="changes-row-list">
              {detailsChanged.map((d) => (
                <li key={d.nodeId} className="changes-row">
                  <button
                    type="button"
                    className="changes-row-target"
                    title="Find this element on the canvas"
                    onClick={() => onReveal(d.nodeId)}
                  >
                    <span className="changes-row-label">{d.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
