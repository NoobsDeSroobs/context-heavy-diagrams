// The editing operations on stories (ADR 0195): make, rename and remove a story, and add, change and
// remove its steps. A story and a set are named by their names, as the editor shows them (the ids are
// hidden and an assistant never needs them); a story name is unique ignoring case, as the editor
// insists. Part of the same pure core as operations.ts.
import type { Story, StoryStep, VisibilitySet } from '../visibility/schema.ts'
import { newStoryId, withStepChange } from '../visibility/story.ts'
import { nameTaken } from '../visibility/visibility.ts'
import type { Model, OperationResult, Reader } from './model.ts'

const storiesOf = (model: Model): Story[] => model.diagram.stories ?? []
const setsOf = (model: Model): VisibilitySet[] => model.diagram.visibilitySets ?? []

function nameOf(reader: Reader, key: string): string {
  const name = reader.string(key).trim()
  if (name === '') reader.fail(`"${key}" must not be blank`)
  return name
}

// The story a name points at, ignoring case; the id works too, for a file that was written by a tool.
function storyNamed(model: Model, reader: Reader): Story {
  const wanted = reader.string('story').trim()
  const stories = storiesOf(model)
  const found =
    stories.find((s) => s.name.trim().toLowerCase() === wanted.toLowerCase()) ??
    stories.find((s) => s.id === wanted)
  if (!found) {
    reader.fail(
      stories.length === 0
        ? `there is no story "${wanted}": this diagram has none (make one with add_story)`
        : `there is no story "${wanted}" (the stories are ${stories.map((s) => `"${s.name}"`).join(', ')})`
    )
  }
  return found
}

// The ids of the sets a list of names points at, each once, in the order given.
function setIdsNamed(model: Model, reader: Reader, key: string): string[] | undefined {
  if (!reader.has(key)) return undefined
  const raw = reader.raw(key)
  if (!Array.isArray(raw) || !raw.every((n) => typeof n === 'string')) {
    reader.fail(`"${key}" must be a list of visibility set names`)
  }
  const sets = setsOf(model)
  const ids = (raw as string[]).map((name) => {
    const wanted = name.trim()
    const found =
      sets.find((s) => s.name.trim().toLowerCase() === wanted.toLowerCase()) ??
      sets.find((s) => s.id === wanted)
    if (!found) {
      reader.fail(
        sets.length === 0
          ? `there is no visibility set "${wanted}": this diagram has none (make one with add_visibility_set)`
          : `there is no visibility set "${wanted}" (the sets are ${sets.map((s) => `"${s.name}"`).join(', ')})`
      )
    }
    return found.id
  })
  return [...new Set(ids)]
}

// A step from the two lists an operation gave. A set named in both is refused: a step shows a set or
// hides it, and the order of the two lists must not be what decides.
function stepFrom(model: Model, reader: Reader): StoryStep {
  const show = setIdsNamed(model, reader, 'show') ?? []
  const hide = setIdsNamed(model, reader, 'hide') ?? []
  const both = show.filter((id) => hide.includes(id))
  if (both.length > 0) {
    const names = both.map((id) => `"${setsOf(model).find((s) => s.id === id)?.name}"`)
    reader.fail(`a step cannot both show and hide ${names.join(', ')}`)
  }
  let step: StoryStep = {}
  for (const id of show) step = withStepChange(step, id, 'show')
  for (const id of hide) step = withStepChange(step, id, 'hide')
  return step
}

// The story in the words an assistant can read back: each step by the names of its sets.
function describe(model: Model, story: Story): { name: string; steps: string[] } {
  const names = new Map(setsOf(model).map((s) => [s.id, s.name]))
  const list = (ids: string[] | undefined): string =>
    (ids ?? [])
      .flatMap((id) => names.get(id) ?? [])
      .map((n) => `"${n}"`)
      .join(', ')
  return {
    name: story.name,
    steps: story.steps.map((step) => {
      const parts = [
        list(step.hide) && `hide ${list(step.hide)}`,
        list(step.show) && `show ${list(step.show)}`
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(', ') : 'no change'
    })
  }
}

// One-based, as the editor numbers the steps.
function stepNumber(reader: Reader, story: Story, key = 'step', extra = 0): number {
  const n = reader.number(key)
  const last = story.steps.length + extra
  if (!Number.isInteger(n) || n < 1 || n > last) {
    reader.fail(
      last === 0
        ? `"${story.name}" has no steps yet (add one with add_story_step)`
        : `"${key}" must be a whole number from 1 to ${last}`
    )
  }
  return n
}

function replace(model: Model, story: Story): void {
  model.diagram.stories = storiesOf(model).map((s) => (s.id === story.id ? story : s))
}

function addStory(model: Model, reader: Reader): OperationResult {
  const name = nameOf(reader, 'name')
  if (nameTaken(storiesOf(model), name)) {
    reader.fail(`there is already a story named "${name}" (names are unique, ignoring case)`)
  }
  const story: Story = { id: newStoryId(storiesOf(model)), name, steps: [] }
  model.diagram.stories = [...storiesOf(model), story]
  return { op: 'add_story', story: describe(model, story) }
}

function renameStory(model: Model, reader: Reader): OperationResult {
  const current = storyNamed(model, reader)
  const name = nameOf(reader, 'name')
  if (nameTaken(storiesOf(model), name, current.id)) {
    reader.fail(`there is already a story named "${name}" (names are unique, ignoring case)`)
  }
  const renamed = { ...current, name }
  replace(model, renamed)
  return { op: 'rename_story', story: describe(model, renamed) }
}

function removeStory(model: Model, reader: Reader): OperationResult {
  const current = storyNamed(model, reader)
  const rest = storiesOf(model).filter((s) => s.id !== current.id)
  if (rest.length > 0) model.diagram.stories = rest
  else delete model.diagram.stories
  return { op: 'remove_story', removed: [current.id], story: describe(model, current) }
}

// Adds a step at the end, or at `at` (one-based) so the later steps move down.
function addStoryStep(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const step = stepFrom(model, reader)
  const at = reader.has('at') ? stepNumber(reader, story, 'at', 1) : story.steps.length + 1
  const steps = [...story.steps]
  steps.splice(at - 1, 0, step)
  const changed = { ...story, steps }
  replace(model, changed)
  return { op: 'add_story_step', story: describe(model, changed) }
}

// Replaces what a step does: both lists, so a list left out is emptied.
function setStoryStep(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const n = stepNumber(reader, story)
  const step = stepFrom(model, reader)
  const changed = { ...story, steps: story.steps.map((s, i) => (i === n - 1 ? step : s)) }
  replace(model, changed)
  return { op: 'set_story_step', story: describe(model, changed) }
}

function removeStoryStep(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const n = stepNumber(reader, story)
  const changed = { ...story, steps: story.steps.filter((_, i) => i !== n - 1) }
  replace(model, changed)
  return { op: 'remove_story_step', story: describe(model, changed) }
}

export const STORY_OPERATIONS: Record<string, (model: Model, reader: Reader) => OperationResult> = {
  add_story: addStory,
  rename_story: renameStory,
  remove_story: removeStory,
  add_story_step: addStoryStep,
  set_story_step: setStoryStep,
  remove_story_step: removeStoryStep
}
