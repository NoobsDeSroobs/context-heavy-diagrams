// The operations on visibility sets (ADR 0194). Every result must be a file the app reads back
// unchanged and the validator accepts.
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
import { applyNamed } from './testNames.mjs'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}` }
const run = (diagram, ...ops) => applyNamed(applyOperations, diagram, ops, options)

function assertValid(diagram) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-sets-'))
  try {
    const text = serializeDiagram(diagram)
    assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
    const file = join(dir, 'd.chd')
    writeFileSync(file, text)
    assert.deepEqual(validateFile(file).errors, [])
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
    { op: 'add_entity', as: '$api', label: 'API', x: 0, y: 0 },
    { op: 'add_entity', as: '$db', label: 'DB', x: 300, y: 0 },
    { op: 'connect', as: '$e1', from: 'api', to: 'db', label: 'reads' }
  ).diagram

test('a set is made by name, and the answer says what it made', () => {
  const { diagram, results } = run(base(), { op: 'add_visibility_set', name: 'Today' })
  assert.equal(results[0].visibilitySet.name, 'Today')
  assert.deepEqual(results[0].members, [])
  assert.deepEqual(diagram.visibilitySets, [results[0].visibilitySet])
  assertValid(diagram)
})

test('elements are put in a set by id, nodes and edges alike, and taken out again', () => {
  const { diagram: a } = run(base(), { op: 'add_visibility_set', name: 'Today' })
  const { diagram: b, results } = run(a, {
    op: 'add_to_visibility_set',
    set: 'today',
    ids: ['api', 'e1']
  })
  assert.deepEqual(results[0].members, ['api', 'e1'])
  assert.deepEqual(b.nodes[0].visibilitySetIds, [a.visibilitySets[0].id])
  assert.deepEqual(b.edges[0].visibilitySetIds, [a.visibilitySets[0].id])
  assertValid(b)
  const { diagram: c, results: out } = run(b, {
    op: 'remove_from_visibility_set',
    set: 'Today',
    ids: ['api']
  })
  assert.deepEqual(out[0].members, ['e1'])
  assert.equal(c.nodes[0].visibilitySetIds, undefined)
  assertValid(c)
})

test('an element can be in several sets', () => {
  const { diagram } = run(
    base(),
    { op: 'add_visibility_set', name: 'Today' },
    { op: 'add_visibility_set', name: 'Proposed' },
    { op: 'add_to_visibility_set', set: 'Today', ids: ['api'] },
    { op: 'add_to_visibility_set', set: 'Proposed', ids: ['api'] }
  )
  assert.equal(diagram.nodes[0].visibilitySetIds.length, 2)
  assertValid(diagram)
})

test('a name is unique ignoring case, and a rename keeps the members', () => {
  const made = run(
    base(),
    { op: 'add_visibility_set', name: 'Today' },
    { op: 'add_to_visibility_set', set: 'Today', ids: ['api'] }
  ).diagram
  refused(made, { op: 'add_visibility_set', name: 'TODAY' }, /already a visibility set named/)
  refused(made, { op: 'add_visibility_set', name: '  ' }, /must not be blank/)
  const { diagram, results } = run(made, { op: 'rename_visibility_set', set: 'today', name: 'Now' })
  assert.equal(diagram.visibilitySets[0].name, 'Now')
  assert.deepEqual(results[0].members, ['api'])
  // renaming to its own name in another case is allowed
  run(diagram, { op: 'rename_visibility_set', set: 'Now', name: 'NOW' })
  assertValid(diagram)
})

test('removing a set takes its id off the elements and leaves the elements', () => {
  const made = run(
    base(),
    { op: 'add_visibility_set', name: 'Today' },
    { op: 'add_to_visibility_set', set: 'Today', ids: ['api', 'e1'] }
  ).diagram
  const { diagram, results } = run(made, { op: 'remove_visibility_set', set: 'Today' })
  assert.equal(results[0].removed.length, 1)
  assert.equal(diagram.visibilitySets, undefined)
  assert.equal(diagram.nodes[0].visibilitySetIds, undefined)
  assert.equal(diagram.edges[0].visibilitySetIds, undefined)
  assert.equal(diagram.nodes.length, 2)
  assertValid(diagram)
})

test('a mistake is refused with what to do about it', () => {
  refused(
    base(),
    { op: 'add_to_visibility_set', set: 'Today', ids: ['api'] },
    /this diagram has none/
  )
  const made = run(base(), { op: 'add_visibility_set', name: 'Today' }).diagram
  refused(made, { op: 'add_to_visibility_set', set: 'Later', ids: ['api'] }, /the sets are "Today"/)
  refused(made, { op: 'add_to_visibility_set', set: 'Today', ids: ['nope'] }, /not an element/)
  refused(made, { op: 'add_to_visibility_set', set: 'Today', ids: [] }, /at least one/)
  refused(
    made,
    { op: 'remove_from_visibility_set', set: 'Today', ids: ['api'] },
    /is not in the visibility set/
  )
})

test('inspect names the sets of each element and counts the members', () => {
  const { diagram } = run(
    base(),
    { op: 'add_visibility_set', name: 'Today' },
    { op: 'add_to_visibility_set', set: 'Today', ids: ['api', 'e1'] }
  )
  const described = describeDiagram(diagram)
  assert.deepEqual(described.visibilitySets, [{ name: 'Today', elements: 2 }])
  assert.deepEqual(described.nodes.find((n) => n.id === 'api').visibilitySets, ['Today'])
  assert.equal(described.nodes.find((n) => n.id === 'db').visibilitySets, undefined)
  assert.deepEqual(described.edges[0].visibilitySets, ['Today'])
})

test('the operations are in the help, so an assistant learns them from it', () => {
  for (const name of OPERATION_NAMES.filter((n) => n.includes('visibility_set'))) {
    assert.ok(OPERATIONS_HELP.includes(name), `the help does not describe ${name}`)
  }
})
