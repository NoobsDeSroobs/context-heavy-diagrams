// Run with `npm test`. The state of a story at a step (ADR 0195).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyStep,
  hiddenAtStep,
  newStoryId,
  stepChangeOf,
  storyFromSets,
  storySetIds,
  storyStrayAdvisory,
  withStepChange
} from './story.ts'

const catalogue = [
  { id: 'today', name: 'Today' },
  { id: 'links', name: 'Links' },
  { id: 'proposed', name: 'Proposed' },
  { id: 'other', name: 'Other' }
]
const story = {
  id: 's1',
  name: 'Integration',
  steps: [{ show: ['today'] }, { show: ['links'] }, { hide: ['today'], show: ['proposed'] }]
}
const sorted = (set) => [...set].sort()

test('a story controls the sets its steps name, and no others', () => {
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
  const longer = {
    ...story,
    steps: [story.steps[0], {}, story.steps[1], story.steps[2]]
  }
  assert.deepEqual(
    sorted(hiddenAtStep(longer, catalogue, 4)),
    sorted(hiddenAtStep(story, catalogue, 3))
  )
})

test('a step beyond the ends is clamped to them', () => {
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, 99)), ['today'])
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, -3)), ['links', 'proposed', 'today'])
  assert.deepEqual(sorted(hiddenAtStep(story, catalogue, Number.NaN)), [
    'links',
    'proposed',
    'today'
  ])
})

test('a set in both lists of a step ends shown', () => {
  assert.deepEqual([...applyStep(new Set(), { hide: ['a'], show: ['a'] })], [])
})

test('applying a step leaves the sets it was given alone', () => {
  const before = new Set(['a'])
  applyStep(before, { show: ['a'], hide: ['b'] })
  assert.deepEqual([...before], ['a'])
})

test('an id that is not in the catalogue is ignored, so a deleted set hides nothing', () => {
  const stray = { id: 's', name: 'S', steps: [{ show: ['gone'] }, { hide: ['gone', 'today'] }] }
  assert.deepEqual(sorted(hiddenAtStep(stray, catalogue, 0)), ['today'])
  assert.deepEqual(sorted(hiddenAtStep(stray, catalogue, 2)), ['today'])
})

test('a story with no steps hides nothing', () => {
  assert.deepEqual([...hiddenAtStep({ id: 's', name: 'S', steps: [] }, catalogue, 0)], [])
})

test('the editor reads and writes what a step does to one set', () => {
  const step = { show: ['a'], hide: ['b'] }
  assert.equal(stepChangeOf(step, 'a'), 'show')
  assert.equal(stepChangeOf(step, 'b'), 'hide')
  assert.equal(stepChangeOf(step, 'c'), 'none')
  assert.deepEqual(withStepChange(step, 'a', 'hide'), { hide: ['b', 'a'] })
  assert.deepEqual(withStepChange(step, 'b', 'none'), { show: ['a'] })
  assert.deepEqual(withStepChange({ show: ['a'] }, 'a', 'none'), {})
})

test('the simplest story shows the next set at each step and hides nothing', () => {
  const steps = storyFromSets(catalogue)
  assert.deepEqual(steps, [
    { show: ['today'] },
    { show: ['links'] },
    { show: ['proposed'] },
    { show: ['other'] }
  ])
  const made = { id: 's', name: 'S', steps }
  assert.deepEqual(sorted(hiddenAtStep(made, catalogue, 0)), [
    'links',
    'other',
    'proposed',
    'today'
  ])
  assert.deepEqual([...hiddenAtStep(made, catalogue, 4)], [])
})

test('a new story id is not one that is taken', () => {
  const id = newStoryId([story])
  assert.notEqual(id, 's1')
  assert.match(id, /^story-/)
})

test('ids in steps that no set holds are listed once, and nothing else is', () => {
  assert.deepEqual(storyStrayAdvisory([story], catalogue), [])
  const lines = storyStrayAdvisory(
    [{ id: 'a', name: 'A', steps: [{ show: ['gone'] }, { hide: ['gone'] }] }],
    catalogue
  )
  assert.equal(lines.length, 1)
  assert.match(lines[0], /1 id/)
})
