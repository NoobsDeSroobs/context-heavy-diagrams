import { useState, type DragEvent } from 'react'
import type { Story, StoryAction, VisibilitySet } from '@shared/diagram'
import { ALL_SETS, describeStep, hiddenAtStep, STORY_ACTIONS } from '@shared/visibility/story'

interface StoriesPanelProps {
  stories: Story[]
  story: Story | null
  sets: VisibilitySet[]
  // The step the canvas shows: 0 is before the first step.
  step: number
  // Both return why a name was refused, or null.
  onAddStory: (name: string) => string | null
  onRenameStory: (id: string, name: string) => string | null
  onSelectStory: (id: string) => void
  onDeleteStory: (id: string) => void
  onSelectStep: (step: number) => void
  onAddStep: () => void
  onDuplicateStep: () => void
  onDeleteStep: () => void
  onMoveStep: (from: number, to: number) => void
  // The actions of a step (1 is the first); an action is told apart by its place, 0-based.
  onAddAction: (index: number) => void
  onChangeAction: (index: number, at: number, change: Partial<StoryAction>) => void
  onRemoveAction: (index: number, at: number) => void
  onMoveAction: (index: number, from: number, to: number) => void
  onFromSets: () => void
  onPresent: () => void
  onClose: () => void
}

// Drag to reorder a list: `handle(i)` goes on what is grabbed and `target(i)` on what it can be
// dropped on. The buttons beside each row do the same without a pointer drag.
function useReorder(onMove: (from: number, to: number) => void): {
  handle: (i: number) => React.HTMLAttributes<HTMLElement>
  target: (i: number) => React.HTMLAttributes<HTMLElement> & { 'data-drop'?: string }
} {
  const [from, setFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const end = (): void => {
    setFrom(null)
    setOver(null)
  }
  return {
    handle: (i) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setFrom(i)
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(i))
        }
      },
      onDragEnd: end
    }),
    target: (i) => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (from === null) return
        event.preventDefault()
        setOver(i)
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        if (from !== null && from !== i) onMove(from, i)
        end()
      },
      'data-drop': from !== null && over === i && from !== i ? 'true' : undefined
    })
  }
}

// The name of the story picked, edited in place and kept when the field loses focus or Enter is
// pressed. A refused name (empty, or taken by another story) puts the old one back.
function StoryNameField({
  name,
  onRename
}: {
  name: string
  onRename: (name: string) => string | null
}): React.JSX.Element {
  const [draft, setDraft] = useState(name)
  return (
    <input
      className="stories-name"
      value={draft}
      aria-label="Story name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== name && onRename(draft) !== null) setDraft(name)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

// One action of a step: what to do, and to which set. An action this version does not know is shown
// as it was written and can only be moved or removed, so it survives an edit.
function ActionRow({
  action,
  sets,
  index,
  count,
  handle,
  onChange,
  onMove,
  onRemove
}: {
  action: StoryAction
  sets: VisibilitySet[]
  index: number
  count: number
  handle: React.HTMLAttributes<HTMLElement>
  onChange: (change: Partial<StoryAction>) => void
  onMove: (to: number) => void
  onRemove: () => void
}): React.JSX.Element {
  const known = STORY_ACTIONS.some((a) => a.id === action.action)
  const set = typeof action.set === 'string' ? action.set : ''
  return (
    <>
      <span
        className="stories-handle"
        title="Drag to move the action"
        aria-hidden="true"
        {...handle}
      >
        ⋮⋮
      </span>
      {known ? (
        <>
          <select
            value={action.action}
            aria-label="Action"
            onChange={(event) => onChange({ action: event.target.value })}
          >
            {STORY_ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={set}
            aria-label="Set"
            onChange={(event) => onChange({ set: event.target.value })}
          >
            {set !== ALL_SETS && !sets.some((s) => s.id === set) && (
              <option value={set}>(deleted set)</option>
            )}
            {/* the meta choice, apart from the real sets so it cannot be taken for one */}
            <option value={ALL_SETS} className="stories-option-meta">
              All sets
            </option>
            <option disabled>──────────</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="stories-action-unknown" title="A later version made this action">
          {action.action} (not known to this version)
        </span>
      )}
      <button
        type="button"
        title="Move the action up"
        aria-label="Move the action up"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        title="Move the action down"
        aria-label="Move the action down"
        disabled={index >= count - 1}
        onClick={() => onMove(index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        title="Remove the action"
        aria-label="Remove the action"
        onClick={onRemove}
      >
        ×
      </button>
    </>
  )
}

// The right-hand dock panel for stories (ADR 0195), laid out like the slide list of a presentation
// program, simplified: the steps of the story in order, and for the step picked its actions, one
// row each. Picking a step shows its state on the canvas, so the person sees what the audience will.
export default function StoriesPanel({
  stories,
  story,
  sets,
  step,
  onAddStory,
  onRenameStory,
  onSelectStory,
  onDeleteStory,
  onSelectStep,
  onAddStep,
  onDuplicateStep,
  onDeleteStep,
  onMoveStep,
  onAddAction,
  onChangeAction,
  onRemoveAction,
  onMoveAction,
  onFromSets,
  onPresent,
  onClose
}: StoriesPanelProps): React.JSX.Element {
  const [newName, setNewName] = useState('')
  // Why the last name was refused; cleared by the next one that is taken.
  const [message, setMessage] = useState<string | null>(null)
  const names = new Map(sets.map((s) => [s.id, s.name]))
  const count = story?.steps.length ?? 0
  const clamped = Math.min(step, count)
  const current = clamped >= 1 ? story?.steps[clamped - 1] : undefined
  const actions = current?.actions ?? []
  const stepOrder = useReorder((from, to) => onMoveStep(from + 1, to + 1))
  const actionOrder = useReorder((from, to) => onMoveAction(clamped, from, to))

  // What the audience sees after a step, for its tooltip: which sets are shown, out of how many.
  const shownAfter = (at: number): { text: string; title: string } => {
    if (!story || sets.length === 0) return { text: '', title: '' }
    const hidden = hiddenAtStep(story, sets, at)
    const shown = sets.filter((s) => !hidden.has(s.id)).map((s) => s.name)
    return {
      text: `${shown.length}/${sets.length}`,
      title:
        shown.length === 0
          ? 'Nothing from the sets is shown'
          : `Shown: ${shown.join(', ')}${
              hidden.size > 0
                ? `. Hidden: ${sets
                    .filter((s) => hidden.has(s.id))
                    .map((s) => s.name)
                    .join(', ')}`
                : ''
            }`
    }
  }

  const submit = (): void => {
    if (!newName.trim()) return
    const refused = onAddStory(newName)
    setMessage(refused)
    if (!refused) setNewName('')
  }

  const renderStepButton = (at: number, label: string, text: string): React.JSX.Element => {
    const shown = shownAfter(at)
    return (
      <button
        type="button"
        className={clamped === at ? 'stories-step is-current' : 'stories-step'}
        aria-current={clamped === at ? 'step' : undefined}
        title={shown.title}
        onClick={() => onSelectStep(at)}
      >
        <span className="stories-step-number">{label}</span>
        <span className="stories-step-text">{text}</span>
        <span className="stories-step-count">{shown.text}</span>
      </button>
    )
  }

  return (
    <div className="stories-panel">
      <div className="stories-panel-toolbar">
        <span className="stories-panel-title">Stories</span>
        <div className="notes-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="stories-panel-body">
        <p className="stories-panel-hint">
          A story shows a diagram one step at a time. A step has actions, such as show a set or hide
          one, run in order on top of what the steps before it did. Before the first step, the sets
          the story names are hidden. Only while this panel is open does the canvas show the step
          picked; elements in no set are always shown.
        </p>

        {story && (
          <div className="stories-row">
            {stories.length > 1 && (
              <select
                value={story.id}
                aria-label="Story"
                onChange={(event) => onSelectStory(event.target.value)}
              >
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <StoryNameField
              key={story.id}
              name={story.name}
              onRename={(next) => {
                const refused = onRenameStory(story.id, next)
                setMessage(refused)
                return refused
              }}
            />
            <button
              type="button"
              className="stories-present"
              title="Present this story (F5)"
              disabled={count === 0}
              onClick={onPresent}
            >
              ▶ Present
            </button>
            <button
              type="button"
              title="Delete this story"
              aria-label={`Delete ${story.name}`}
              onClick={() => onDeleteStory(story.id)}
            >
              ×
            </button>
          </div>
        )}

        <div className="stories-row">
          <input
            className="stories-name"
            placeholder={story ? 'Another story' : 'New story, for example Integration'}
            value={newName}
            aria-label="New story name"
            onChange={(event) => {
              setNewName(event.target.value)
              setMessage(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <button type="button" onClick={submit} disabled={!newName.trim()}>
            Add story
          </button>
        </div>
        {message && (
          <p className="stories-message" role="alert">
            {message}
          </p>
        )}

        {story && (
          <>
            <div className="stories-heading">Steps</div>
            <ol className="stories-steps" aria-label="Steps">
              <li>{renderStepButton(0, '▸', 'Start')}</li>
              {story.steps.map((s, i) => (
                <li
                  key={i}
                  className="stories-step-item"
                  {...stepOrder.target(i)}
                  {...stepOrder.handle(i)}
                >
                  {renderStepButton(i + 1, String(i + 1), describeStep(s, names))}
                </li>
              ))}
            </ol>
            <div className="stories-row">
              <button type="button" onClick={onAddStep} title="Add a step after the one picked">
                + Step
              </button>
              <button
                type="button"
                onClick={onDuplicateStep}
                disabled={clamped < 1}
                title="Copy the step picked"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => onMoveStep(clamped, clamped - 1)}
                disabled={clamped < 2}
                title="Move the step picked up"
                aria-label="Move the step up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMoveStep(clamped, clamped + 1)}
                disabled={clamped < 1 || clamped >= count}
                title="Move the step picked down"
                aria-label="Move the step down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={onDeleteStep}
                disabled={clamped < 1}
                title="Delete the step picked"
                aria-label="Delete the step"
              >
                ×
              </button>
            </div>

            {current && (
              <>
                <div className="stories-heading">Step {clamped}: actions</div>
                {actions.length === 0 && <p className="stories-panel-hint">No actions yet.</p>}
                <ul className="stories-actions" aria-label={`Actions of step ${clamped}`}>
                  {actions.map((action, i) => (
                    <li key={i} className="stories-action" {...actionOrder.target(i)}>
                      <ActionRow
                        action={action}
                        sets={sets}
                        index={i}
                        count={actions.length}
                        handle={actionOrder.handle(i)}
                        onChange={(change) => onChangeAction(clamped, i, change)}
                        onMove={(to) => onMoveAction(clamped, i, to)}
                        onRemove={() => onRemoveAction(clamped, i)}
                      />
                    </li>
                  ))}
                </ul>
                <div className="stories-row">
                  <button
                    type="button"
                    onClick={() => onAddAction(clamped)}
                    disabled={sets.length === 0}
                    title={
                      sets.length === 0
                        ? 'Make a visibility set first: the eye button in the bottom left corner'
                        : 'Add an action to this step'
                    }
                  >
                    + Add action
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {!story && <p className="stories-panel-hint">No story yet. Name one above to start.</p>}
      </div>
      {story && (
        <div className="stories-panel-footer">
          <button
            type="button"
            onClick={onFromSets}
            disabled={sets.length === 0}
            title="One step per set, in the order of the sets, each showing the next set"
          >
            Make steps from the sets
          </button>
        </div>
      )}
    </div>
  )
}
