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

function check(diagram) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-stories-'))
  try {
    const text = serializeDiagram(diagram)
    assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
    const file = join(dir, 'd.chd')
    writeFileSync(file, text)
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
    'set_story_step',
    'remove_story_step'
  ]) {
    assert.ok(OPERATION_NAMES.includes(name), name)
    assert.ok(OPERATIONS_HELP.includes(name), name)
  }
})

test('a story is made, given steps by set name, and read back', () => {
  const { diagram, results } = run(
    base(),
    { op: 'add_story', name: 'Integration' },
    { op: 'add_story_step', story: 'integration', show: ['today'] },
    { op: 'add_story_step', story: 'Integration', hide: ['Today'], show: ['Proposed'] }
  )
  assert.deepEqual(results[2].story, {
    name: 'Integration',
    steps: ['show "Today"', 'hide "Today", show "Proposed"']
  })
  const [today, proposed] = diagram.visibilitySets.map((s) => s.id)
  assert.deepEqual(diagram.stories[0].steps, [
    { show: [today] },
    { show: [proposed], hide: [today] }
  ])
  const { errors, warnings } = check(diagram)
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
})

test('a step is inserted, replaced and removed by its number', () => {
  const { diagram } = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S', show: ['Today'] },
    { op: 'add_story_step', story: 'S', show: ['Proposed'] },
    { op: 'add_story_step', story: 'S', at: 1, show: ['Proposed'], hide: ['Today'] },
    { op: 'set_story_step', story: 'S', step: 2, hide: ['Proposed'] },
    { op: 'remove_story_step', story: 'S', step: 3 }
  )
  const [today, proposed] = diagram.visibilitySets.map((s) => s.id)
  assert.deepEqual(diagram.stories[0].steps, [
    { show: [proposed], hide: [today] },
    { hide: [proposed] }
  ])
  assert.deepEqual(check(diagram).errors, [])
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

test('a duplicate story name, an unknown story or set, and a set in both lists are refused', () => {
  const made = run(base(), { op: 'add_story', name: 'S' }).diagram
  refused(made, { op: 'add_story', name: 's' }, /already a story named/)
  refused(made, { op: 'add_story_step', story: 'Nope', show: ['Today'] }, /no story "Nope"/)
  refused(made, { op: 'add_story_step', story: 'S', show: ['Nope'] }, /no visibility set "Nope"/)
  refused(
    made,
    { op: 'add_story_step', story: 'S', show: ['Today'], hide: ['today'] },
    /both show and hide/
  )
  refused(made, { op: 'set_story_step', story: 'S', step: 1, show: ['Today'] }, /no steps yet/)
  refused(
    run(made, { op: 'add_story_step', story: 'S' }).diagram,
    { op: 'remove_story_step', story: 'S', step: 2 },
    /from 1 to 1/
  )
  refused(createEmptyDiagram(), { op: 'add_story_step', story: 'S' }, /this diagram has none/)
})

test('inspect lists the stories with their steps by set name', () => {
  const { diagram } = run(
    base(),
    { op: 'add_story', name: 'S' },
    { op: 'add_story_step', story: 'S', show: ['Today'] },
    { op: 'add_story_step', story: 'S' }
  )
  assert.deepEqual(describeDiagram(diagram).stories, [
    { name: 'S', steps: ['show Today', 'no change'] }
  ])
  assert.equal('stories' in describeDiagram(base()), false)
})

test('the validator reports a malformed story and warns about ids that no set holds', () => {
  // written as raw text: the app's own writer would turn a string into a list
  const dir = mkdtempSync(join(tmpdir(), 'chd-stories-'))
  try {
    const file = join(dir, 'bad.chd')
    writeFileSync(
      file,
      JSON.stringify({ ...base(), stories: [{ id: 's', name: 'S', steps: [{ show: 'Today' }] }] })
    )
    assert.ok(validateFile(file).errors.some((e) => /show must be a list/.test(e)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const stray = { ...base(), stories: [{ id: 's', name: 'S', steps: [{ show: ['gone'] }] }] }
  const result = check(stray)
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w) => /stories list 1 visibility set id/.test(w)))
  const twice = {
    ...base(),
    stories: [
      { id: 'a', name: 'Same', steps: [] },
      { id: 'b', name: 'same', steps: [] }
    ]
  }
  assert.ok(check(twice).warnings.some((w) => /two stories are named/.test(w)))
})
