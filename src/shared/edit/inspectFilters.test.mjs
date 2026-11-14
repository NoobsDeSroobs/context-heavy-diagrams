// What an inspection can be narrowed to (issues only, some ids, one container): the short answer an
// assistant needs after an edit, instead of the whole diagram again.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../diagram/index.ts'
import { inspectAnswer } from './answers.ts'
import { applyOperations } from './operations.ts'

let counter = 0
const build = () =>
  applyOperations(
    createEmptyDiagram(),
    [
      { op: 'add_container', id: 'zone', label: 'Zone', x: 0, y: 0, width: 500, height: 400 },
      { op: 'add_entity', id: 'a', label: 'A', x: 20, y: 60, parent: 'zone' },
      // Overlaps a, so there is one problem and it involves exactly a and b.
      { op: 'add_entity', id: 'b', label: 'B', x: 60, y: 90, parent: 'zone' },
      {
        op: 'add_container',
        id: 'inner',
        label: 'Inner',
        x: 250,
        y: 200,
        width: 220,
        height: 160,
        parent: 'zone'
      },
      { op: 'add_entity', id: 'c', label: 'C', x: 270, y: 240, parent: 'inner' },
      { op: 'add_entity', id: 'out', label: 'Out', x: 800, y: 0 },
      { op: 'add_entity', id: 'out2', label: 'Out 2', x: 800, y: 300 },
      { op: 'connect', id: 'ab', from: 'a', to: 'b' },
      { op: 'connect', id: 'bo', from: 'b', to: 'out' },
      { op: 'connect', id: 'co', from: 'c', to: 'out' },
      { op: 'connect', id: 'far', from: 'out', to: 'out2' }
    ],
    { newId: (prefix) => `${prefix}-${(counter += 1)}` }
  ).diagram

const ids = (list) => list.map((x) => x.id)

test('with no narrowing the answer is whole, as before', () => {
  const answer = inspectAnswer(build())
  assert.deepEqual(ids(answer.nodes), ['zone', 'a', 'b', 'inner', 'c', 'out', 'out2'])
  assert.deepEqual(ids(answer.edges), ['ab', 'bo', 'co', 'far'])
  assert.equal(answer.partial, undefined)
  assert.ok(answer.issues.some((line) => /overlap/.test(line)))
})

test('issuesOnly gives the problems and nothing else', () => {
  const answer = inspectAnswer(build(), { issuesOnly: true })
  assert.deepEqual(Object.keys(answer), ['issues'])
  assert.ok(answer.issues.some((line) => /overlap/.test(line)))
})

test('ids gives those elements and only the problems that involve them', () => {
  const some = inspectAnswer(build(), { ids: ['a', 'bo'] })
  assert.deepEqual(ids(some.nodes), ['a'])
  assert.deepEqual(ids(some.edges), ['bo'])
  assert.ok(
    some.issues.some((line) => /overlap/.test(line)),
    'the overlap involves a'
  )
  assert.match(some.partial, /left out/)

  const clear = inspectAnswer(build(), { ids: ['out'] })
  assert.deepEqual(clear.issues, [], 'the overlap does not involve out')
})

test('ids not in the diagram are listed as unknown, so a typo is not an empty answer', () => {
  const answer = inspectAnswer(build(), { ids: ['nope', 'a'] })
  assert.deepEqual(answer.unknown, ['nope'])
  assert.deepEqual(ids(answer.nodes), ['a'])
})

test('container gives everything inside it at any depth and the edges that touch it', () => {
  const answer = inspectAnswer(build(), { container: 'zone' })
  assert.deepEqual(ids(answer.nodes), ['zone', 'a', 'b', 'inner', 'c'])
  assert.deepEqual(ids(answer.edges), ['ab', 'bo', 'co'], 'far touches nothing inside')
  const inner = inspectAnswer(build(), { container: 'inner' })
  assert.deepEqual(ids(inner.nodes), ['inner', 'c'])
  assert.deepEqual(ids(inner.edges), ['co'])
  assert.deepEqual(inner.issues, [])
})

test('an unknown container is named and gives no elements', () => {
  const answer = inspectAnswer(build(), { container: 'zzz' })
  assert.deepEqual(answer.unknown, ['zzz'])
  assert.deepEqual(answer.nodes, [])
  assert.deepEqual(answer.edges, [])
})

test('ids and container together keep what satisfies both', () => {
  const answer = inspectAnswer(build(), { container: 'zone', ids: ['a', 'out', 'far', 'bo'] })
  assert.deepEqual(ids(answer.nodes), ['a'])
  assert.deepEqual(ids(answer.edges), ['bo'])
})

test('issuesOnly with ids gives only the problems that involve them, and says what was unknown', () => {
  const answer = inspectAnswer(build(), { issuesOnly: true, ids: ['out', 'nope'] })
  assert.deepEqual(answer, { unknown: ['nope'], issues: [] })
})
