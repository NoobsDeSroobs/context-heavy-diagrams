import { useState, type KeyboardEvent } from 'react'
import type { SecurityThreat } from '@shared/diagram'

const PANEL_WIDTH = 300

// Toggles between a small "+ <placeholder>" button and an inline
// text-entry form — this app's established convention for adding an item
// to a list (LegendPanel/HighlightsPanel's own "Add…" flows), not a
// native window.prompt() (see docs/known-issues.md's entry on why this
// codebase avoids native dialogs for this kind of input).
function AddThreatItem({ onAdd }: { onAdd: (name: string) => void }): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const reset = (): void => {
    setAdding(false)
    setValue('')
  }
  const confirm = (): void => {
    if (value.trim()) onAdd(value.trim())
    reset()
  }

  if (!adding) {
    return (
      <button type="button" className="threat-matrix-add-button" onClick={() => setAdding(true)}>
        + Threat
      </button>
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') confirm()
    if (event.key === 'Escape') reset()
  }

  return (
    <span className="threat-matrix-add-form">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Threat"
      />
      <button type="button" onClick={confirm} disabled={!value.trim()}>
        Add
      </button>
    </span>
  )
}

// A × that asks once before actually removing — remove is destructive
// (ADR 0082: it deletes assessment data), and a native confirm() near
// <select> elements has its own known bug in this codebase.
function ConfirmRemove({
  onRemove,
  what
}: {
  onRemove: () => void
  what: string
}): React.JSX.Element {
  const [armed, setArmed] = useState(false)
  if (armed) {
    return (
      <span className="threat-matrix-confirm-remove">
        <button
          type="button"
          className="legend-row-remove"
          title={`Delete ${what} and its assessments`}
          onClick={() => {
            onRemove()
            setArmed(false)
          }}
        >
          Delete
        </button>
        <button type="button" onClick={() => setArmed(false)}>
          Cancel
        </button>
      </span>
    )
  }
  return (
    <button
      type="button"
      className="legend-row-remove"
      title={`Remove ${what}`}
      aria-label={`Remove ${what}`}
      onClick={() => setArmed(true)}
    >
      ×
    </button>
  )
}

interface ThreatMatrixManagePanelProps {
  anchorRect: DOMRect
  threats: SecurityThreat[]
  hiddenThreatIds: Set<string>
  entities: { id: string; label: string }[]
  hiddenEntityIds: Set<string>
  assessableEntities: { id: string; label: string }[]
  onAddAllEntities: () => void
  onAddThreat: (name: string) => void
  onRenameThreat: (id: string, name: string) => void
  onToggleThreatHidden: (id: string) => void
  onRemoveThreat: (id: string) => void
  onAddEntity: (nodeId: string) => void
  onToggleEntityHidden: (nodeId: string) => void
  onRemoveEntity: (nodeId: string) => void
  onClose: () => void
}

// Grows/shrinks the matrix (ADR 0082). Threats are a free-text catalog;
// entities are picked from the diagram's own 'entity' nodes. Every row has a
// hide toggle (keep the data, drop it from the grid) distinct from remove
// (delete it and its assessments). Reuses LegendPanel's dock-shell classes
// (.legend-panel/-toolbar/-title/-body) and .legend-row layout, close via
// ×-button only.
export default function ThreatMatrixManagePanel({
  anchorRect,
  threats,
  hiddenThreatIds,
  entities,
  hiddenEntityIds,
  assessableEntities,
  onAddAllEntities,
  onAddThreat,
  onRenameThreat,
  onToggleThreatHidden,
  onRemoveThreat,
  onAddEntity,
  onToggleEntityHidden,
  onRemoveEntity,
  onClose
}: ThreatMatrixManagePanelProps): React.JSX.Element {
  const left = Math.min(anchorRect.left, window.innerWidth - PANEL_WIDTH - 8)
  const top = anchorRect.bottom + 6

  return (
    <div className="legend-panel nodrag nopan" style={{ left, top, width: PANEL_WIDTH }}>
      <div className="legend-panel-toolbar">
        <span className="legend-panel-title">Manage matrix</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="legend-panel-body">
        <div className="threat-matrix-manage-group">
          <h3 className="threat-matrix-manage-title">Threats</h3>
          {threats.length === 0 && <p className="legend-panel-hint">None yet.</p>}
          {threats.map((threat) => {
            const hidden = hiddenThreatIds.has(threat.id)
            return (
              <div
                key={threat.id}
                className={hidden ? 'legend-row threat-matrix-manage-row-hidden' : 'legend-row'}
              >
                <input
                  className="required-tag-value-input"
                  value={threat.name}
                  onChange={(event) => onRenameThreat(threat.id, event.target.value)}
                />
                <button
                  type="button"
                  className="threat-matrix-manage-hide"
                  title={hidden ? 'Show as a matrix row' : 'Hide from the matrix (keep the data)'}
                  aria-label={hidden ? 'Show' : 'Hide'}
                  onClick={() => onToggleThreatHidden(threat.id)}
                >
                  {hidden ? '🙈' : '👁'}
                </button>
                <ConfirmRemove
                  what={`"${threat.name}"`}
                  onRemove={() => onRemoveThreat(threat.id)}
                />
              </div>
            )
          })}
          <AddThreatItem onAdd={onAddThreat} />
        </div>

        <div className="threat-matrix-manage-group">
          <h3 className="threat-matrix-manage-title">Entities</h3>
          {entities.length === 0 && (
            <p className="legend-panel-hint">No entities in the matrix yet.</p>
          )}
          {entities.map((entity) => {
            const hidden = hiddenEntityIds.has(entity.id)
            return (
              <div
                key={entity.id}
                className={hidden ? 'legend-row threat-matrix-manage-row-hidden' : 'legend-row'}
              >
                <span className="legend-row-label">{entity.label}</span>
                <button
                  type="button"
                  className="threat-matrix-manage-hide"
                  title={
                    hidden ? 'Show as a matrix column' : 'Hide from the matrix (keep the data)'
                  }
                  aria-label={hidden ? 'Show' : 'Hide'}
                  onClick={() => onToggleEntityHidden(entity.id)}
                >
                  {hidden ? '🙈' : '👁'}
                </button>
                <ConfirmRemove
                  what={`"${entity.label}"`}
                  onRemove={() => onRemoveEntity(entity.id)}
                />
              </div>
            )
          })}
          {assessableEntities.length > 0 ? (
            <>
              <select
                className="threat-matrix-add-entity-select"
                value=""
                onChange={(event) => {
                  if (event.target.value) onAddEntity(event.target.value)
                }}
              >
                <option value="">+ Add an entity to assess…</option>
                {assessableEntities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="threat-matrix-add-button"
                onClick={onAddAllEntities}
                title="Add every entity in the diagram to the matrix"
              >
                + Add all {assessableEntities.length}{' '}
                {assessableEntities.length === 1 ? 'entity' : 'entities'}
              </button>
            </>
          ) : (
            <p className="legend-panel-hint">
              {entities.length > 0
                ? 'Every entity is already in the matrix.'
                : 'Draw an entity first.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
