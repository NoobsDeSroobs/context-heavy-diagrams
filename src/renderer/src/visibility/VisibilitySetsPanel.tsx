import { useState } from 'react'
import type { VisibilitySet } from '@shared/diagram'
import type { SetMember } from './useVisibilitySets'

interface VisibilitySetsPanelProps {
  sets: VisibilitySet[]
  hiddenIds: Set<string>
  members: Map<string, SetMember[]>
  selectionCount: number
  anchorRect: DOMRect | null
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onAddSelection: (id: string) => void
  onRemoveSelection: (id: string) => void
  onRemoveMember: (setId: string, member: SetMember) => void
  onSelectMember: (member: SetMember) => void
  onClose: () => void
}

const PANEL_WIDTH = 380

function SetRow({
  set,
  shown,
  members,
  hasSelection,
  onRename,
  onDelete,
  onToggle,
  onAddSelection,
  onRemoveSelection,
  onRemoveMember,
  onSelectMember
}: {
  set: VisibilitySet
  shown: boolean
  members: SetMember[]
  hasSelection: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onToggle: () => void
  onAddSelection: () => void
  onRemoveSelection: () => void
  onRemoveMember: (member: SetMember) => void
  onSelectMember: (member: SetMember) => void
}): React.JSX.Element {
  // The name is edited in place and kept when the field loses focus or Enter is pressed.
  const [draft, setDraft] = useState(set.name)
  const [open, setOpen] = useState(false)
  const commit = (): void => {
    if (draft.trim() && draft.trim() !== set.name) onRename(draft)
    else setDraft(set.name)
  }
  return (
    <div className="visibility-set">
      <div className="visibility-set-row">
        <button
          type="button"
          className="visibility-set-caret"
          aria-expanded={open}
          aria-label={open ? `Hide what is in ${set.name}` : `Show what is in ${set.name}`}
          title={open ? 'Hide the list' : 'Show what is in this set'}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={open ? 'highlight-group-caret open' : 'highlight-group-caret'}>▸</span>
        </button>
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
          {members.length}
        </span>
        <button
          type="button"
          title="Put the selected elements in this set"
          aria-label={`Add the selection to ${set.name}`}
          disabled={!hasSelection}
          onClick={onAddSelection}
        >
          Add
        </button>
        <button
          type="button"
          title="Take the selected elements out of this set"
          aria-label={`Remove the selection from ${set.name}`}
          disabled={!hasSelection}
          onClick={onRemoveSelection}
        >
          Remove
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
      {open && (
        <ul className="visibility-set-members" aria-label={`In ${set.name}`}>
          {members.length === 0 && <li className="visibility-set-empty">Nothing in this set.</li>}
          {members.map((member) => (
            <li
              key={`${member.kind}-${member.id}`}
              className={member.shown ? 'visibility-set-member' : 'visibility-set-member is-hidden'}
            >
              <button
                type="button"
                className="visibility-set-member-label"
                disabled={!member.shown}
                title={member.shown ? 'Select it' : 'Hidden, so it cannot be selected'}
                onClick={() => onSelectMember(member)}
              >
                <span className="visibility-set-member-kind">
                  {member.kind === 'edge' ? 'Edge' : 'Element'}
                </span>
                {member.label}
              </button>
              <button
                type="button"
                className="highlight-row-remove"
                title="Take it out of this set"
                aria-label={`Take ${member.label} out of ${set.name}`}
                onClick={() => onRemoveMember(member)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// A floating panel next to the corner buttons, with the highlights (ADR 0194): the sets of the
// diagram, each shown or hidden with its checkbox, what is in each, and the means to make one and
// to put the selected elements in or out of it.
export default function VisibilitySetsPanel({
  sets,
  hiddenIds,
  members,
  selectionCount,
  anchorRect,
  onAdd,
  onRename,
  onDelete,
  onToggle,
  onAddSelection,
  onRemoveSelection,
  onRemoveMember,
  onSelectMember,
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
            members={members.get(set.id) ?? []}
            hasSelection={selectionCount > 0}
            onRename={(next) => onRename(set.id, next)}
            onDelete={() => onDelete(set.id)}
            onToggle={() => onToggle(set.id)}
            onAddSelection={() => onAddSelection(set.id)}
            onRemoveSelection={() => onRemoveSelection(set.id)}
            onRemoveMember={(member) => onRemoveMember(set.id, member)}
            onSelectMember={onSelectMember}
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
