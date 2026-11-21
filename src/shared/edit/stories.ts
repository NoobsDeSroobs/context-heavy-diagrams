// The editing operations on stories (ADR 0195): make, rename and remove a story, add and remove its
// steps, and add and remove the actions of a step. A story and a set are named by their names, as the
// editor shows them (the ids are hidden and an assistant never needs them); a story name is unique
// ignoring case, as the editor insists. Part of the same pure core as operations.ts.
import type { Story, StoryAction, StoryStep, VisibilitySet } from '../visibility/schema.ts'
import {
  ALL_SETS,
  describeStep,
  newStoryId,
  STORY_ACTIONS,
  withAction,
  withoutAction
} from '../visibility/story.ts'
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

// The set a name points at, ignoring case; the id works too.
function setNamed(model: Model, reader: Reader, wanted: string): VisibilitySet {
  const sets = setsOf(model)
  const found =
    sets.find((s) => s.name.trim().toLowerCase() === wanted.trim().toLowerCase()) ??
    sets.find((s) => s.id === wanted.trim())
  if (!found) {
    reader.fail(
      sets.length === 0
        ? `there is no visibility set "${wanted}": this diagram has none (make one with add_visibility_set)`
        : `there is no visibility set "${wanted}" (the sets are ${sets.map((s) => `"${s.name}"`).join(', ')})`
    )
  }
  return found
}

// An action from the name of what to do and the name of the set it is about, or `all: true` for the
// meta target "All sets" (every set the diagram has when the step runs).
function actionFrom(
  model: Model,
  reader: Reader,
  kind: unknown,
  setName: unknown,
  all: unknown
): StoryAction {
  const known = STORY_ACTIONS.map((a) => a.id)
  if (typeof kind !== 'string' || !known.some((id) => id === kind.toLowerCase())) {
    reader.fail(`"action" must be one of ${known.map((id) => `"${id}"`).join(', ')}`)
  }
  if (all === true) {
    if (setName !== undefined) reader.fail('give either "set" or "all": true, not both')
    return { action: kind.toLowerCase(), set: ALL_SETS }
  }
  if (typeof setName !== 'string') {
    reader.fail('"set" must be the name of a visibility set, or give "all": true for all sets')
  }
  return { action: kind.toLowerCase(), set: setNamed(model, reader, setName).id }
}

// The actions of an `actions` list, each `{ action, set }` by name, or `{ action, all: true }`.
function actionsFrom(model: Model, reader: Reader): StoryAction[] {
  if (!reader.has('actions')) return []
  const raw = reader.raw('actions')
  if (!Array.isArray(raw)) reader.fail('"actions" must be a list of { action, set }')
  return raw.map((item) => {
    if (typeof item !== 'object' || item === null) {
      reader.fail('each of "actions" must be { action: "show" | "hide", set: <set name> }')
    }
    const { action, set, all } = item as Record<string, unknown>
    return actionFrom(model, reader, action, set, all)
  })
}

// The story in the words an assistant can read back: each step by the names of its sets.
function describe(model: Model, story: Story): { name: string; steps: string[] } {
  const names = new Map(setsOf(model).map((s) => [s.id, s.name]))
  return { name: story.name, steps: story.steps.map((step) => describeStep(step, names)) }
}

// One-based, as the editor numbers the steps.
function numberOf(reader: Reader, key: string, last: number, empty: string): number {
  const n = reader.number(key)
  if (!Number.isInteger(n) || n < 1 || n > last) {
    reader.fail(last === 0 ? empty : `"${key}" must be a whole number from 1 to ${last}`)
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

// Adds a step at the end, or at `at` (one-based) so the later steps move down. It starts with the
// actions given, or empty.
function addStoryStep(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const actions = actionsFrom(model, reader)
  const at = reader.has('at')
    ? numberOf(reader, 'at', story.steps.length + 1, '')
    : story.steps.length + 1
  const step: StoryStep = actions.length > 0 ? { actions } : {}
  const steps = [...story.steps]
  steps.splice(at - 1, 0, step)
  const changed = { ...story, steps }
  replace(model, changed)
  return { op: 'add_story_step', story: describe(model, changed) }
}

function removeStoryStep(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const n = numberOf(
    reader,
    'step',
    story.steps.length,
    `"${story.name}" has no steps yet (add one with add_story_step)`
  )
  const changed = { ...story, steps: story.steps.filter((_, i) => i !== n - 1) }
  replace(model, changed)
  return { op: 'remove_story_step', story: describe(model, changed) }
}

// Adds an action to a step: at the end, or at `at` (one-based) among its actions.
function addStoryAction(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const n = numberOf(
    reader,
    'step',
    story.steps.length,
    `"${story.name}" has no steps yet (add one with add_story_step)`
  )
  const action = actionFrom(
    model,
    reader,
    reader.raw('action'),
    reader.has('set') ? reader.raw('set') : undefined,
    reader.has('all') ? reader.raw('all') : undefined
  )
  const inStep = story.steps[n - 1].actions?.length ?? 0
  const at = reader.has('at') ? numberOf(reader, 'at', inStep + 1, '') - 1 : undefined
  const steps = story.steps.map((s, i) => (i === n - 1 ? withAction(s, action, at) : s))
  const changed = { ...story, steps }
  replace(model, changed)
  return { op: 'add_story_action', story: describe(model, changed) }
}

// Takes one action out of a step, by its number among the step's actions (one-based).
function removeStoryAction(model: Model, reader: Reader): OperationResult {
  const story = storyNamed(model, reader)
  const n = numberOf(
    reader,
    'step',
    story.steps.length,
    `"${story.name}" has no steps yet (add one with add_story_step)`
  )
  const inStep = story.steps[n - 1].actions?.length ?? 0
  const number = numberOf(
    reader,
    'number',
    inStep,
    `step ${n} of "${story.name}" has no actions yet (add one with add_story_action)`
  )
  const steps = story.steps.map((s, i) => (i === n - 1 ? withoutAction(s, number - 1) : s))
  const changed = { ...story, steps }
  replace(model, changed)
  return { op: 'remove_story_action', story: describe(model, changed) }
}

export const STORY_OPERATIONS: Record<string, (model: Model, reader: Reader) => OperationResult> = {
  add_story: addStory,
  rename_story: renameStory,
  remove_story: removeStory,
  add_story_step: addStoryStep,
  remove_story_step: removeStoryStep,
  add_story_action: addStoryAction,
  remove_story_action: removeStoryAction
}
