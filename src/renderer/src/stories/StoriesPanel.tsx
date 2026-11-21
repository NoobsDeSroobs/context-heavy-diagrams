import { useState } from 'react'
import type { Story, VisibilitySet } from '@shared/diagram'
import { stepChangeOf, type StepChange } from '@shared/visibility/story'

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
  onChange: (index: number, setId: string, change: StepChange) => void
  onFromSets: () => void
  onPresent: () => void
  onClose: () => void
}

// What a step does, in words, for its row in the list.
function describe(step: Story['steps'][number], names: Map<string, string>): string {
  const list = (ids: string[] | undefined): string =>
    (ids ?? [])
      .map((id) => names.get(id))
      .filter((n): n is string => n !== undefined)
      .join(', ')
  const parts = [
    list(step.hide) && `Hide ${list(step.hide)}`,
    list(step.show) && `Show ${list(step.show)}`
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'No change'
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

const CHOICES: { change: StepChange; label: string; title: string }[] = [
  { change: 'show', label: 'Show', title: 'This step shows the set' },
  { change: 'hide', label: 'Hide', title: 'This step hides the set' },
  { change: 'none', label: '–', title: 'This step leaves the set as it was' }
]

// The right-hand dock panel for stories (ADR 0195), laid out like the slide list of a presentation
// program, simplified: the steps of the story in order, and for the step picked what it does to each
// set. Picking a step shows its state on the canvas, so the person sees what the audience will.
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
  onChange,
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

  const submit = (): void => {
    if (!newName.trim()) return
    const refused = onAddStory(newName)
    setMessage(refused)
    if (!refused) setNewName('')
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
          A story shows a diagram one step at a time. Each step shows or hides sets, on top of what
          the steps before it did. Before the first step, the sets the story names are hidden.
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
              <li>
                <button
                  type="button"
                  className={clamped === 0 ? 'stories-step is-current' : 'stories-step'}
                  aria-current={clamped === 0 ? 'step' : undefined}
                  onClick={() => onSelectStep(0)}
                >
                  <span className="stories-step-number">▸</span>
                  <span className="stories-step-text">Start</span>
                </button>
              </li>
              {story.steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={clamped === i + 1 ? 'stories-step is-current' : 'stories-step'}
                    aria-current={clamped === i + 1 ? 'step' : undefined}
                    onClick={() => onSelectStep(i + 1)}
                  >
                    <span className="stories-step-number">{i + 1}</span>
                    <span className="stories-step-text">{describe(s, names)}</span>
                  </button>
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

            {clamped >= 1 && story.steps[clamped - 1] && (
              <>
                <div className="stories-heading">Step {clamped}: what it does to each set</div>
                {sets.length === 0 && (
                  <p className="stories-panel-hint">
                    There are no visibility sets yet. Make some with the eye button in the bottom
                    left corner.
                  </p>
                )}
                {sets.map((set) => {
                  const current = stepChangeOf(story.steps[clamped - 1], set.id)
                  return (
                    <div className="stories-set" key={set.id}>
                      <span className="stories-set-name" title={set.name}>
                        {set.name}
                      </span>
                      <span className="stories-choices" role="group" aria-label={set.name}>
                        {CHOICES.map((c) => (
                          <button
                            key={c.change}
                            type="button"
                            title={c.title}
                            aria-pressed={current === c.change}
                            className={current === c.change ? 'is-on' : undefined}
                            onClick={() => onChange(clamped, set.id, c.change)}
                          >
                            {c.label}
                          </button>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </>
            )}

            <div className="stories-row">
              <button
                type="button"
                onClick={onFromSets}
                disabled={sets.length === 0}
                title="One step per set, in the order of the sets, each showing the next set"
              >
                Make steps from the sets
              </button>
            </div>
          </>
        )}
        {!story && <p className="stories-panel-hint">No story yet. Name one above to start.</p>}
      </div>
    </div>
  )
}
