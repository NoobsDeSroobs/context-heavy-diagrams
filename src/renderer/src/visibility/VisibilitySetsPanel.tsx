import { useState } from 'react'
import type { VisibilitySet } from '@shared/diagram'

interface VisibilitySetsPanelProps {
  sets: VisibilitySet[]
  hiddenIds: Set<string>
  memberCounts: Map<string, number>
  selectionCount: number
  anchorRect: DOMRect | null
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onAddSelection: (id: string) => void
  onRemoveSelection: (id: string) => void
  onClose: () => void
}

const PANEL_WIDTH = 340

function SetRow({
  set,
  shown,
  count,
  hasSelection,
  onRename,
  onDelete,
  onToggle,
  onAddSelection,
  onRemoveSelection
}: {
  set: VisibilitySet
  shown: boolean
  count: number
  hasSelection: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onToggle: () => void
  onAddSelection: () => void
  onRemoveSelection: () => void
}): React.JSX.Element {
  // The name is edited in place and kept when the field loses focus or Enter is pressed.
  const [draft, setDraft] = useState(set.name)
  const commit = (): void => {
    if (draft.trim() && draft.trim() !== set.name) onRename(draft)
    else setDraft(set.name)
  }
  return (
    <div className="visibility-set-row">
      <input
        type="checkbox"
        checked={shown}
        onChange={onToggle}
        title={shown ? 'Shown. Untick to hide the elements in this set' : 'Hidden. Tick to show'}
        aria-label={`Show ${set.name}`}
      />
      <input
        className="visibility-set-name"
        value={draft}
        aria-label="Set name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(set.name)
            event.currentTarget.blur()
          }
        }}
      />
      <span className="visibility-set-count" title="Elements in this set">
        {count}
      </span>
      <button
        type="button"
        title="Put the selected elements in this set"
        aria-label={`Add the selection to ${set.name}`}
        disabled={!hasSelection}
        onClick={onAddSelection}
      >
        +
      </button>
      <button
        type="button"
        title="Take the selected elements out of this set"
        aria-label={`Remove the selection from ${set.name}`}
        disabled={!hasSelection}
        onClick={onRemoveSelection}
      >
        −
      </button>
      <button
        type="button"
        className="highlight-row-remove"
        title="Delete this set"
        aria-label={`Delete ${set.name}`}
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}

// A floating panel next to the corner buttons, with the highlights (ADR 0194): the sets of the
// diagram, each shown or hidden with its checkbox, and the means to make one and to put the selected
// elements in or out of it.
export default function VisibilitySetsPanel({
  sets,
  hiddenIds,
  memberCounts,
  selectionCount,
  anchorRect,
  onAdd,
  onRename,
  onDelete,
  onToggle,
  onAddSelection,
  onRemoveSelection,
  onClose
}: VisibilitySetsPanelProps): React.JSX.Element {
  const [name, setName] = useState('')
  const rect = anchorRect ?? new DOMRect(0, 0, 0, 0)
  const left = Math.min(rect.right + 8, window.innerWidth - PANEL_WIDTH - 8)
  const bottom = Math.max(window.innerHeight - rect.bottom, 8)
  const maxHeight = Math.max(window.innerHeight - bottom - 16, 200)
  const submit = (): void => {
    if (!name.trim()) return
    onAdd(name)
    setName('')
  }
  return (
    <div
      className="highlights-panel visibility-sets-panel nodrag nopan"
      style={{ left, bottom, width: PANEL_WIDTH, maxHeight }}
    >
      <div className="highlights-panel-toolbar">
        <span className="highlights-panel-title">Visibility sets</span>
        <div className="notes-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="highlights-panel-body">
        <p className="highlights-panel-hint">
          A set shows or hides the elements in it together. An element in no set is always shown;
          one in several is shown while any of them is. Which sets are shown is not saved with the
          file: everything is shown when a diagram opens.
        </p>
        {sets.length === 0 && <p className="highlights-panel-hint">No sets yet.</p>}
        {sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            shown={!hiddenIds.has(set.id)}
            count={memberCounts.get(set.id) ?? 0}
            hasSelection={selectionCount > 0}
            onRename={(next) => onRename(set.id, next)}
            onDelete={() => onDelete(set.id)}
            onToggle={() => onToggle(set.id)}
            onAddSelection={() => onAddSelection(set.id)}
            onRemoveSelection={() => onRemoveSelection(set.id)}
          />
        ))}
        <div className="visibility-set-add">
          <input
            className="visibility-set-name"
            placeholder="New set, for example Today"
            value={name}
            aria-label="New set name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <button type="button" onClick={submit} disabled={!name.trim()}>
            Add set
          </button>
        </div>
      </div>
    </div>
  )
}
