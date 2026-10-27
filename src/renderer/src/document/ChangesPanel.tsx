import {
  groupConnections,
  type ChangedElement,
  type ChangesSinceSave
} from '@shared/document/changesSinceSave'

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
  // Put one element back as the saved file has it (undoable like any edit).
  onReset: (element: ChangedElement) => void
  onClose: () => void
}

// What the reset button says and promises, by what happened to the element since the save.
const RESET: Record<ChangedElement['changeType'], { label: string; title: string }> = {
  modified: {
    label: 'Reset',
    title: 'Put this element back as it is in the saved file (Ctrl+Z undoes it)'
  },
  added: {
    label: 'Remove',
    title: 'Remove this element; it is not in the saved file (Ctrl+Z undoes it)'
  },
  removed: {
    label: 'Restore',
    title:
      'Bring this element back, with its connections where they can be drawn (Ctrl+Z undoes it)'
  }
}

function ElementRow({
  el,
  connections,
  onReveal,
  onReset
}: {
  el: ChangedElement
  // The connections that came or went with this element: one decision, listed under it.
  connections: ChangedElement[]
  onReveal: (id: string) => void
  onReset: (element: ChangedElement) => void
}): React.JSX.Element {
  const reset = RESET[el.changeType]
  return (
    <li className="changes-row">
      <div className="changes-row-head">
        <button
          type="button"
          className="changes-row-target"
          title="Find this element on the canvas"
          onClick={() => onReveal(el.id)}
        >
          <span className="changes-row-kind">{el.kind}</span>
          <span className="changes-row-label">{el.label}</span>
        </button>
        <button
          type="button"
          className="changes-row-reset"
          title={reset.title}
          onClick={() => onReset(el)}
        >
          {reset.label}
        </button>
      </div>
      {el.changedFields && el.changedFields.length > 0 && (
        <span className="changes-row-fields">{el.changedFields.join(', ')}</span>
      )}
      {connections.length > 0 && (
        <details className="changes-row-connections">
          <summary>
            {connections.length} connection{connections.length === 1 ? '' : 's'}{' '}
            {el.changeType === 'removed' ? 'removed' : 'added'} with it
            {el.changeType === 'removed'
              ? ' (Restore brings them back)'
              : ' (Remove takes them too)'}
          </summary>
          <ul>
            {connections.map((connection) => (
              <li key={connection.id}>
                {el.changeType === 'removed' ? (
                  connection.label
                ) : (
                  // An added connection is on the canvas, so it can be found; a removed one is not.
                  <button
                    type="button"
                    className="changes-row-target"
                    title="Find this connection on the canvas"
                    onClick={() => onReveal(connection.id)}
                  >
                    {connection.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function Section({
  title,
  elements,
  onReveal,
  onReset
}: {
  title: string
  elements: ChangedElement[]
  onReveal: (id: string) => void
  onReset: (element: ChangedElement) => void
}): React.JSX.Element | null {
  if (elements.length === 0) return null
  return (
    <div className="changes-section">
      <p className="diagnostics-section-title">
        {title} ({elements.length})
      </p>
      <ul className="changes-row-list">
        {groupConnections(elements).map(({ element, connections }) => (
          <ElementRow
            key={`${element.kind}-${element.id}`}
            el={element}
            connections={connections}
            onReveal={onReveal}
            onReset={onReset}
          />
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
  onReset,
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
            <Section
              title="Modified"
              elements={diff.modified}
              onReveal={onReveal}
              onReset={onReset}
            />
            <Section title="Added" elements={diff.added} onReveal={onReveal} onReset={onReset} />
            <Section
              title="Removed"
              elements={diff.removed}
              onReveal={onReveal}
              onReset={onReset}
            />
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
