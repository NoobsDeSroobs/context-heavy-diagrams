import { useState, type KeyboardEvent } from 'react'

const PANEL_WIDTH = 260

// Toggles between a small "+ <placeholder>" button and an inline
// text-entry form — this app's established convention for adding an item
// to a list (LegendPanel/HighlightsPanel's own "Add…" flows), not a
// native window.prompt() (see docs/known-issues.md's entry on why this
// codebase avoids native dialogs for this kind of input).
function AddListItem({
  placeholder,
  onAdd
}: {
  placeholder: string
  onAdd: (name: string) => void
}): React.JSX.Element {
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
        + {placeholder}
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
        placeholder={placeholder}
      />
      <button type="button" onClick={confirm} disabled={!value.trim()}>
        Add
      </button>
    </span>
  )
}

// Reuses LegendPanel's own .legend-row/-row-label/-row-remove — same
// "name + × button" row shape, no swatch column needed here.
function ManagedList({
  title,
  addPlaceholder,
  items,
  onAdd,
  onRemove
}: {
  title: string
  addPlaceholder: string
  items: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}): React.JSX.Element {
  return (
    <div className="threat-matrix-manage-group">
      <h3 className="threat-matrix-manage-title">{title}</h3>
      {items.length === 0 && <p className="legend-panel-hint">None yet.</p>}
      {items.map((item) => (
        <div key={item} className="legend-row">
          <span className="legend-row-label">{item}</span>
          <button
            type="button"
            className="legend-row-remove"
            title="Remove"
            aria-label={`Remove ${item}`}
            onClick={() => onRemove(item)}
          >
            ×
          </button>
        </div>
      ))}
      <AddListItem placeholder={addPlaceholder} onAdd={onAdd} />
    </div>
  )
}

interface ThreatMatrixManagePanelProps {
  anchorRect: DOMRect
  threats: string[]
  services: string[]
  onAddThreat: (name: string) => void
  onRemoveThreat: (name: string) => void
  onAddService: (name: string) => void
  onRemoveService: (name: string) => void
  onClose: () => void
}

// A dedicated panel for growing/shrinking the matrix,
// replacing the inline "+ Threat"/"+ Service" corner buttons a previous
// pass put directly in the table (removed from there now that this
// exists — one place to manage the matrix, not two). Deliberately just
// add/remove for now, per the user's own framing: they intend to make
// the service dimension recursive (linked sub-graphs, or the diagram's
// own shapes) later, at which point this panel is where that kind of
// control would live too — but that's not designed or built here, this
// is just the add/remove buttons "for now." Not wired into the top menu
// bar (Canvas.tsx's MenuBar) — deliberately deferred until the feature
// solidifies, per the user's own call. Reuses LegendPanel's own dock-
// shell classes (.legend-panel/-toolbar/-title/-body) — same small
// floating-panel shape, close-via-×-button-only (no click-outside/
// Escape handling), matching that panel's own idiom exactly rather than
// the click-outside-closes idiom this file's own cell editor popup uses.
export default function ThreatMatrixManagePanel({
  anchorRect,
  threats,
  services,
  onAddThreat,
  onRemoveThreat,
  onAddService,
  onRemoveService,
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
        <ManagedList
          title="Threats"
          addPlaceholder="Threat"
          items={threats}
          onAdd={onAddThreat}
          onRemove={onRemoveThreat}
        />
        <ManagedList
          title="Services"
          addPlaceholder="Service"
          items={services}
          onAdd={onAddService}
          onRemove={onRemoveService}
        />
      </div>
    </div>
  )
}
