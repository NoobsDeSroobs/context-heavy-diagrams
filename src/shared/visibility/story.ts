// The state of a story at a step (ADR 0195), the one place that decides which sets a story hides.
// Words as in visibility.ts: a set is shown or hidden. The result feeds `visibleFilter`, so the rule
// of ADR 0194 is still the only thing that decides whether an element is visible.
import type { Story, StoryStep, VisibilitySet } from './schema.ts'

// The sets a story names in any step, each once. These are the sets the story controls.
export function storySetIds(story: Story): Set<string> {
  const ids = new Set<string>()
  for (const step of story.steps) {
    for (const id of step.hide ?? []) ids.add(id)
    for (const id of step.show ?? []) ids.add(id)
  }
  return ids
}

// One step applied to the hidden sets: the sets it hides, then the sets it shows. A new set; the
// argument is left alone.
export function applyStep(hidden: ReadonlySet<string>, step: StoryStep): Set<string> {
  const next = new Set(hidden)
  for (const id of step.hide ?? []) next.add(id)
  for (const id of step.show ?? []) next.delete(id)
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

// What a step does to one set, as the editor shows it.
export type StepChange = 'show' | 'hide' | 'none'

export function stepChangeOf(step: StoryStep, setId: string): StepChange {
  if (step.show?.includes(setId)) return 'show'
  if (step.hide?.includes(setId)) return 'hide'
  return 'none'
}

// The step after the person sets what it does to one set. A set is in one list at most, and an empty
// list is left out, so the file stays free of empty arrays.
export function withStepChange(step: StoryStep, setId: string, change: StepChange): StoryStep {
  const show = (step.show ?? []).filter((id) => id !== setId)
  const hide = (step.hide ?? []).filter((id) => id !== setId)
  if (change === 'show') show.push(setId)
  if (change === 'hide') hide.push(setId)
  const next: StoryStep = {}
  if (show.length > 0) next.show = show
  if (hide.length > 0) next.hide = hide
  return next
}

// The sets of a story with the ids that no longer belong to the catalogue taken out of every step.
// For the editor to show; the file keeps them.
export function stepsWithoutStray(story: Story, catalogue: readonly VisibilitySet[]): StoryStep[] {
  const known = new Set(catalogue.map((s) => s.id))
  return story.steps.map((step) => withKnown(step, known))
}

function withKnown(step: StoryStep, known: ReadonlySet<string>): StoryStep {
  const next: StoryStep = {}
  const show = (step.show ?? []).filter((id) => known.has(id))
  const hide = (step.hide ?? []).filter((id) => known.has(id))
  if (show.length > 0) next.show = show
  if (hide.length > 0) next.hide = hide
  return next
}

// The simplest story (ADR 0195): one step per set, in the order of the catalogue, each showing the
// next set and hiding nothing.
export function storyFromSets(catalogue: readonly VisibilitySet[]): StoryStep[] {
  return catalogue.map((set) => ({ show: [set.id] }))
}

// A new id, unique among the stories and the ids the file already uses. Opaque, like a set's.
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
