// The operations on stories (ADR 0195). Every result must be a file the app reads back unchanged and
// the validator accepts.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../diagram/index.ts'
import { describeDiagram } from './inspect.ts'
import { OPERATIONS_HELP } from './help.ts'
import { applyOperations, OPERATION_NAMES, OperationError } from './operations.ts'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}` }
const run = (diagram, ...ops) => applyOperations(diagram, ops, options)

// Writes the diagram as text and validates that file; `raw` is written as it is, for what the app's
// own writer would repair.
function check(diagram, raw = false) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-stories-'))
  try {
    const file = join(dir, 'd.chd')
    if (raw) {
      writeFileSync(file, JSON.stringify(diagram))
    } else {
      const text = serializeDiagram(diagram)
      assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
      writeFileSync(file, text)
    }
    return validateFile(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const refused = (diagram, op, pattern) =>
  assert.throws(
    () => run(diagram, op),
    (error) => error instanceof OperationError && pattern.test(error.message)
  )

const base = () =>
  run(
    createEmptyDiagram(),
    { op: 'add_visibility_set', name: 'Today' },
    { op: 'add_visibility_set', name: 'Proposed' }
  ).diagram

test('the story operations are known and described in the help', () => {
  for (const name of [
    'add_story',
    'rename_story',
    'remove_story',
    'add_story_step',
    'remove_story_step',
    'add_story_action',
    'remove_story_action'
  ]) {
    assert.ok(OPERATION_NAMES.includes(name), name)
    assert.ok(OPERATIONS_HELP.includes(name), name)
  }
})

test('a story is made, given steps and actions by set name, and read back', () => {
  const { diagram, results } = run(
    base(),
    { op: 'add_story', name: 'Integration' },
    { op: 'add_story_step', story: 'integration', actions: [{ action: 'show', set: 'today' }] },
    { op: 'add_story_step', story: 'Integration' },
    { op: 'add_story_action', story: 'Integration', step: 2, action: 'Hide', set: 'Today' },
    { op: 'add_story_action', story: 'Integration', step: 2, action: 'show', set: 'Proposed' }
  )
  assert.deepEqual(results[4].story, {
    name: 'Integration',
    steps: ['Show Today', 'Hide Today · Show Proposed']
  })
  const [today, proposed] = diagram.visibilitySets.map((s) => s.id)
  assert.deepEqual(diagram.stories[0].steps, [
    { actions: [{ action: 'show', set: today }] },
    {
      actions: [
        { action: 'hide', set: today },
        { action: 'show', set: proposed }
      ]
    }
  ])
  const { errors, warnings } = check(diagram)
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
})

test('a step starts empty, and steps and actions are inserted and removed by number', () => {
  const { diagram } = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S' },
    { op: 'add_story_step', story: 'S', actions: [{ action: 'show', set: 'Proposed' }] },
    { op: 'add_story_step', story: 'S', at: 1, actions: [{ action: 'show', set: 'Today' }] },
    { op: 'add_story_action', story: 'S', step: 1, action: 'hide', set: 'Proposed', at: 1 },
    { op: 'add_story_action', story: 'S', step: 1, action: 'hide', set: 'Today' },
    { op: 'remove_story_action', story: 'S', step: 1, number: 2 },
    { op: 'remove_story_step', story: 'S', step: 3 }
  )
  const [today, proposed] = diagram.visibilitySets.map((s) => s.id)
  assert.deepEqual(diagram.stories[0].steps, [
    {
      actions: [
        { action: 'hide', set: proposed },
        { action: 'hide', set: today }
      ]
    },
    {}
  ])
  assert.deepEqual(check(diagram).errors, [])
})

test('the last action of a step takes the field with it', () => {
  const { diagram } = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S', actions: [{ action: 'show', set: 'Today' }] },
    { op: 'remove_story_action', story: 'S', step: 1, number: 1 }
  )
  assert.deepEqual(diagram.stories[0].steps, [{}])
})

test('a story is renamed and removed, and the last one takes the field with it', () => {
  const renamed = run(
    base(),
    { op: 'add_story', name: 'Old' },
    { op: 'rename_story', story: 'old', name: 'New' }
  ).diagram
  assert.equal(renamed.stories[0].name, 'New')
  const gone = run(renamed, { op: 'remove_story', story: 'New' }).diagram
  assert.equal('stories' in gone, false)
})

test('a duplicate name, an unknown story, set or action, and a bad number are refused', () => {
  const made = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S' }
  ).diagram
  refused(made, { op: 'add_story', name: 's' }, /already a story named/)
  refused(made, { op: 'add_story_step', story: 'Nope' }, /no story "Nope"/)
  refused(
    made,
    { op: 'add_story_action', story: 'S', step: 1, action: 'show', set: 'Nope' },
    /no visibility set "Nope"/
  )
  refused(
    made,
    { op: 'add_story_action', story: 'S', step: 1, action: 'grow', set: 'Today' },
    /"action" must be one of "show", "hide"/
  )
  refused(
    made,
    { op: 'add_story_action', story: 'S', step: 2, action: 'show', set: 'Today' },
    /from 1 to 1/
  )
  refused(made, { op: 'remove_story_action', story: 'S', step: 1, number: 1 }, /no actions yet/)
  refused(
    made,
    { op: 'add_story_step', story: 'S', actions: [{ action: 'show' }] },
    /"set" must be the name/
  )
  refused(
    run(createEmptyDiagram(), { op: 'add_story', name: 'T' }).diagram,
    { op: 'remove_story_step', story: 'T', step: 1 },
    /has no steps yet/
  )
  refused(createEmptyDiagram(), { op: 'add_story_step', story: 'S' }, /this diagram has none/)
})

test('inspect lists the stories with their steps by set name', () => {
  const { diagram } = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S', actions: [{ action: 'show', set: 'Today' }] },
    { op: 'add_story_step', story: 'S' }
  )
  assert.deepEqual(describeDiagram(diagram).stories, [
    { name: 'S', steps: ['Show Today', 'No actions'] }
  ])
  assert.equal('stories' in describeDiagram(base()), false)
})

test('the validator reports a malformed story, and warns about what it ignores', () => {
  const [today] = base().visibilitySets.map((s) => s.id)
  const story = (steps) => ({ ...base(), stories: [{ id: 's', name: 'S', steps }] })
  const errors = (steps) => check(story(steps), true).errors
  assert.ok(errors([{ actions: 'show' }]).some((e) => /actions must be a list/.test(e)))
  assert.ok(errors([{ actions: [{ action: 'show' }] }]).some((e) => /needs a 'set'/.test(e)))
  assert.ok(errors([{ actions: [{ set: today }] }]).some((e) => /'action' name/.test(e)))
  const later = check(story([{ actions: [{ action: 'grow', set: today, factor: 2 }] }]), true)
  assert.deepEqual(later.errors, [])
  assert.ok(later.warnings.some((w) => /does not know/.test(w)))
  const stray = check(story([{ actions: [{ action: 'show', set: 'gone' }] }]))
  assert.deepEqual(stray.errors, [])
  assert.ok(stray.warnings.some((w) => /stories list 1 visibility set id/.test(w)))
  const twice = {
    ...base(),
    stories: [
      { id: 'a', name: 'Same', steps: [] },
      { id: 'b', name: 'same', steps: [] }
    ]
  }
  assert.ok(check(twice).warnings.some((w) => /two stories are named/.test(w)))
})
