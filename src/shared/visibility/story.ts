// The state of a story at a step (ADR 0195), the one place that decides which sets a story hides.
// Words as in visibility.ts: a set is shown or hidden. The result feeds `visibleFilter`, so the rule
// of ADR 0194 is still the only thing that decides whether an element is visible.
import type { Story, StoryAction, StoryStep, VisibilitySet } from './schema.ts'

// The actions this version knows, in the order a person is offered them. Each is about a set. An
// action that is not here is ignored when a story is played and kept in the file.
export const STORY_ACTIONS = [
  { id: 'show', label: 'Show' },
  { id: 'hide', label: 'Hide' }
] as const

export type StoryActionId = (typeof STORY_ACTIONS)[number]['id']

export const isKnownAction = (action: StoryAction): boolean =>
  STORY_ACTIONS.some((a) => a.id === action.action) && typeof action.set === 'string'

const actionsOf = (step: StoryStep): StoryAction[] => step.actions ?? []

// The sets a story shows or hides in any step, each once. These are the sets the story controls.
export function storySetIds(story: Story): Set<string> {
  const ids = new Set<string>()
  for (const step of story.steps) {
    for (const action of actionsOf(step)) if (isKnownAction(action)) ids.add(action.set as string)
  }
  return ids
}

// One step applied to the hidden sets, its actions in order: a hide adds the set, a show takes it
// out. A new set; the argument is left alone.
export function applyStep(hidden: ReadonlySet<string>, step: StoryStep): Set<string> {
  const next = new Set(hidden)
  for (const action of actionsOf(step)) {
    if (!isKnownAction(action)) continue
    if (action.action === 'hide') next.add(action.set as string)
    else next.delete(action.set as string)
  }
  return next
}

// The sets hidden at a step. Step 0 is before the first step: every set the story names is hidden
// and every other set is shown, so only the elements in no set and in sets the story leaves alone
// are visible. Step n is step n-1 with the nth step applied, so going back or jumping is the same
// replay from step 0. A step beyond the ends is clamped to them. Ids that are not in the catalogue
// are left out, like everywhere else (ADR 0194).
export function hiddenAtStep(
  story: Story,
  catalogue: readonly VisibilitySet[],
  step: number
): Set<string> {
  const known = new Set(catalogue.map((s) => s.id))
  let hidden = new Set([...storySetIds(story)].filter((id) => known.has(id)))
  const upTo = Math.max(0, Math.min(Math.trunc(step) || 0, story.steps.length))
  for (let i = 0; i < upTo; i += 1) hidden = applyStep(hidden, story.steps[i])
  for (const id of hidden) if (!known.has(id)) hidden.delete(id)
  return hidden
}

// A step after an action is added to it, at the end or at a place (0-based).
export function withAction(step: StoryStep, action: StoryAction, at?: number): StoryStep {
  const actions = [...actionsOf(step)]
  actions.splice(
    at === undefined ? actions.length : Math.max(0, Math.min(at, actions.length)),
    0,
    action
  )
  return { ...step, actions }
}

// A step after the action at a place is replaced by its change; the fields the change leaves out stay.
export function withActionChanged(
  step: StoryStep,
  at: number,
  change: Partial<StoryAction>
): StoryStep {
  return { ...step, actions: actionsOf(step).map((a, i) => (i === at ? { ...a, ...change } : a)) }
}

// A step after the action at a place is taken out; the field goes with the last action.
export function withoutAction(step: StoryStep, at: number): StoryStep {
  const actions = actionsOf(step).filter((_, i) => i !== at)
  if (actions.length > 0) return { ...step, actions }
  const rest = { ...step }
  delete rest.actions
  return rest
}

// A step after the action at `from` moves to `to` (both 0-based); the same step when either is out.
export function withActionMoved(step: StoryStep, from: number, to: number): StoryStep {
  const actions = [...actionsOf(step)]
  if (from < 0 || from >= actions.length || to < 0 || to >= actions.length || from === to) {
    return step
  }
  const [moved] = actions.splice(from, 1)
  actions.splice(to, 0, moved)
  return { ...step, actions }
}

// The action in words for the person: "Show Today". A set the catalogue no longer holds is named by
// what it is, and an action this version does not know is named as it was written.
export function describeAction(action: StoryAction, names: ReadonlyMap<string, string>): string {
  const known = STORY_ACTIONS.find((a) => a.id === action.action)
  if (!known || typeof action.set !== 'string') return String(action.action)
  return `${known.label} ${names.get(action.set) ?? '(deleted set)'}`
}

// The step in words: its actions one after the other, or "No actions".
export function describeStep(step: StoryStep, names: ReadonlyMap<string, string>): string {
  const actions = actionsOf(step)
  return actions.length > 0
    ? actions.map((a) => describeAction(a, names)).join(' · ')
    : 'No actions'
}

// The simplest story (ADR 0195): one step per set, in the order of the catalogue, each showing the
// next set and hiding nothing.
export function storyFromSets(catalogue: readonly VisibilitySet[]): StoryStep[] {
  return catalogue.map((set) => ({ actions: [{ action: 'show', set: set.id }] }))
}

// A new id, unique among the stories. Opaque, like a set's.
export function newStoryId(stories: readonly Story[]): string {
  const taken = new Set(stories.map((s) => s.id))
  let id: string
  do {
    id = `story-${Math.random().toString(36).slice(2, 8)}`
  } while (taken.has(id))
  return id
}

// The line Diagnostics shows for ids in stories that no set holds, or none: nothing is removed.
export function storyStrayAdvisory(
  stories: readonly Story[],
  catalogue: readonly VisibilitySet[]
): string[] {
  const known = new Set(catalogue.map((s) => s.id))
  const stray = new Set<string>()
  for (const story of stories) {
    for (const id of storySetIds(story)) if (!known.has(id)) stray.add(id)
  }
  if (stray.size === 0) return []
  return [
    `Stories: ${stray.size} id(s) in steps belong to no visibility set of this diagram (${[...stray].join(', ')}). They are ignored, and kept in the file.`
  ]
}
