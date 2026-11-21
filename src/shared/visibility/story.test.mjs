// Run with `npm test`. The state of a story at a step (ADR 0195).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_SETS,
  applyStep,
  describeAction,
  describeStep,
  hiddenAtStep,
  namesAllSets,
  newStoryId,
  storyFromSets,
  storySetIds,
  storyStrayAdvisory,
  withAction,
  withActionChanged,
  withActionMoved,
  withoutAction
} from './story.ts'

const catalogue = [
  { id: 'today', name: 'Today' },
  { id: 'links', name: 'Links' },
  { id: 'proposed', name: 'Proposed' },
  { id: 'other', name: 'Other' }
]
const show = (set) => ({ action: 'show', set })
const hide = (set) => ({ action: 'hide', set })
const story = {
  id: 's1',
  name: 'Integration',
  steps: [
    { actions: [show('today')] },
    { actions: [show('links')] },
    { actions: [hide('today'), show('proposed')] }
  ]
}
const sorted = (set) => [...set].sort()

test('a story controls the sets its actions name, and no others', () => {
  assert.deepEqual(sorted(storySetIds(story)), ['links', 'proposed', 'today'])
})

test('before step 1 every set the story names is hidden and the others are shown', () => {
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 0)), ['links', 'proposed', 'today'])
})

test('the steps accumulate: each starts from what the one before left', () => {
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 1)), ['links', 'proposed'])
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 2)), ['proposed'])
})

test('one step can hide and show: today gives way to proposed', () => {
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 3)), ['today'])
})

test('going back or jumping is the same replay, so the state depends only on the step', () => {
  const forward = hiddenAtStep(story, catalogue, 2)
  hiddenAtStep(story, catalogue, 3)
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 2)), sorted(forward))
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 0)), ['links', 'proposed', 'today'])
})

test('inserting a step does not mean redoing the later ones', () => {
  const longer = { ...story, steps: [story.steps[0], {}, story.steps[1], story.steps[2]] }
  assert.deepEqual(
    sorted(hiddenAtStep(longer, catalogue, 4)),
    sorted(hiddenAtStep(story, catalogue, 3))
  )
})

test('a step beyond the ends is clamped to them', () => {
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 99)), ['today'])
  const start = ['links', 'proposed', 'today']
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, -3)), start)
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, Number.NaN)), start)
})

test('the actions of a step run in order, so the last one on a set wins', () => {
  assert.deepEqual([...applyStep(new Set(), { actions: [hide('a'), show('a')] })], [])
  assert.deepEqual([...applyStep(new Set(), { actions: [show('a'), hide('a')] })], ['a'])
})

test('applying a step leaves the sets it was given alone', () => {
  const before = new Set(['a'])
  applyStep(before, { actions: [show('a'), hide('b')] })
  assert.deepEqual([...before], ['a'])
})

test('an action this version does not know is ignored, and names no set', () => {
  const later = {
    id: 's',
    name: 'S',
    steps: [{ actions: [{ action: 'grow', set: 'other', factor: 2 }, show('today')] }]
  }
  assert.deepEqual(sorted(storySetIds(later)), ['today'])
  assert.deepEqual(sorted(hiddenAtStep(later, catalogue, 1)), [])
})

test('an id that is not in the catalogue is ignored, so a deleted set hides nothing', () => {
  const stray = {
    id: 's',
    name: 'S',
    steps: [{ actions: [show('gone')] }, { actions: [hide('gone'), hide('today')] }]
  }
  assert.deepEqual(sorted(hiddenAtStep(stray, catalogue, 0)), ['today'])
  assert.deepEqual(sorted(hiddenAtStep(stray, catalogue, 2)), ['today'])
})

test('a story with no steps hides nothing', () => {
  assert.deepEqual([...hiddenAtStep({ id: 's', name: 'S', steps: [] }, catalogue, 0)], [])
})

test('the editor adds, changes, moves and removes the actions of a step', () => {
  let step = withAction({}, show('a'))
  step = withAction(step, hide('b'))
  step = withAction(step, show('c'), 0)
  assert.deepEqual(step.actions, [show('c'), show('a'), hide('b')])
  step = withActionChanged(step, 1, { action: 'hide' })
  assert.deepEqual(step.actions[1], hide('a'))
  step = withActionMoved(step, 0, 2)
  assert.deepEqual(step.actions, [hide('a'), hide('b'), show('c')])
  assert.equal(withActionMoved(step, 0, 9), step)
  step = withoutAction(step, 0)
  assert.deepEqual(step.actions, [hide('b'), show('c')])
})

test('the actions field goes with the last action, so no empty list is left', () => {
  const step = withoutAction({ actions: [show('a')] }, 0)
  assert.deepEqual(step, {})
  assert.equal('actions' in step, false)
})

test('a step is described in words by the names of its sets', () => {
  const names = new Map(catalogue.map((s) => [s.id, s.name]))
  assert.equal(describeStep(story.steps[2], names), 'Hide Today · Show Proposed')
  assert.equal(describeStep({}, names), 'No actions')
  assert.equal(describeAction(show('gone'), names), 'Show (deleted set)')
  assert.equal(describeAction({ action: 'grow', set: 'today' }, names), 'grow')
})

test('the simplest story shows the next set at each step and hides nothing', () => {
  const steps = storyFromSets(catalogue)
  assert.deepEqual(
    steps.map((s) => s.actions),
    [[show('today')], [show('links')], [show('proposed')], [show('other')]]
  )
  const made = { id: 's', name: 'S', steps }
  const all = ['links', 'other', 'proposed', 'today']
  assert.deepEqual(sorted(hiddenAtStep(made, catalogue, 0)), all)
  assert.deepEqual([...hiddenAtStep(made, catalogue, 4)], [])
})

test('a new story id is not one that is taken', () => {
  const id = newStoryId([story])
  assert.notEqual(id, 's1')
  assert.match(id, /^story-/)
})

test('ids in actions that no set holds are listed once, and nothing else is', () => {
  assert.deepEqual(storyStrayAdvisory([story], catalogue), [])
  const lines = storyStrayAdvisory(
    [{ id: 'a', name: 'A', steps: [{ actions: [show('gone'), hide('gone')] }] }],
    catalogue
  )
  assert.equal(lines.length, 1)
  assert.match(lines[0], /1 id/)
})

test('"All sets" in an action is every set of the catalogue, so a hide-all starts a story blank', () => {
  const blank = {
    id: 's2',
    name: 'Blank',
    steps: [{ actions: [hide(ALL_SETS), show('today')] }, { actions: [show(ALL_SETS)] }]
  }
  // it is not a set of its own, and a story that uses it names every set
  assert.deepEqual([...storySetIds(blank)], ['today'])
  assert.equal(namesAllSets(blank), true)
  assert.equal(namesAllSets(story), false)
  assert.deepEqual(sorted(hiddenAtStep(blank, catalogue, 0)), [
    'links',
    'other',
    'proposed',
    'today'
  ])
  assert.deepEqual(sorted(hiddenAtStep(blank, catalogue, 1)), ['links', 'other', 'proposed'])
  assert.deepEqual([...hiddenAtStep(blank, catalogue, 2)], [])
  // the last action wins, as with any set
  assert.deepEqual(
    sorted(applyStep(new Set(), { actions: [show('today'), hide(ALL_SETS)] }, ['today', 'links'])),
    ['links', 'today']
  )
})

test('a set added later is included by "All sets"', () => {
  const blank = { id: 's2', name: 'Blank', steps: [{ actions: [hide(ALL_SETS), show('today')] }] }
  const later = [...catalogue, { id: 'new', name: 'New' }]
  assert.deepEqual(sorted(hiddenAtStep(blank, later, 1)), ['links', 'new', 'other', 'proposed'])
})

test('"All sets" is described in words and is never a stray id', () => {
  const names = new Map(catalogue.map((s) => [s.id, s.name]))
  assert.equal(describeAction(hide(ALL_SETS), names), 'Hide All sets')
  assert.deepEqual(
    storyStrayAdvisory(
      [{ id: 's2', name: 'B', steps: [{ actions: [hide(ALL_SETS)] }] }],
      catalogue
    ),
    []
  )
})
