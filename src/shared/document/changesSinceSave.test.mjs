// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffDiagrams, groupConnections, hasChanges, summarizeChanges } from './changesSinceSave.ts'

const node = (id, over = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label: `Node ${id}` },
  ...over
})
const edge = (id, source, target, over = {}) => ({ id, source, target, ...over })
const diagram = (nodes = [], edges = []) => ({ version: 1, nodes, edges })

test('no changes: empty diff', () => {
  const saved = diagram([node('a')], [])
  const current = diagram([node('a')], [])
  const diff = diffDiagrams(saved, current)
  assert.equal(hasChanges(diff), false)
  assert.deepEqual(diff, { added: [], removed: [], modified: [] })
})

test('added node: present only in current', () => {
  const saved = diagram([], [])
  const current = diagram([node('a')], [])
  const diff = diffDiagrams(saved, current)
  assert.equal(diff.added.length, 1)
  assert.equal(diff.added[0].id, 'a')
  assert.equal(diff.added[0].changeType, 'added')
})

test('removed node: present only in saved', () => {
  const saved = diagram([node('a')], [])
  const current = diagram([], [])
  const diff = diffDiagrams(saved, current)
  assert.equal(diff.removed.length, 1)
  assert.equal(diff.removed[0].id, 'a')
})

test('modified node: lists which fields differ, by human-readable name', () => {
  const saved = diagram([node('a', { position: { x: 0, y: 0 } })], [])
  const current = diagram(
    [node('a', { position: { x: 10, y: 0 }, data: { label: 'Renamed' } })],
    []
  )
  const diff = diffDiagrams(saved, current)
  assert.equal(diff.modified.length, 1)
  assert.deepEqual(diff.modified[0].changedFields.sort(), ['label', 'position'])
})

test('unrelated field untouched: no false positive', () => {
  const saved = diagram([node('a', { rotation: 5 })], [])
  const current = diagram([node('a', { rotation: 5 })], [])
  assert.equal(hasChanges(diffDiagrams(saved, current)), false)
})

test('deep-equal, not reference-equal: identical nested objects rebuilt fresh are not a change', () => {
  const saved = diagram([node('a', { style: { fill: '#fff', fontSize: 12 } })], [])
  const current = diagram([node('a', { style: { fontSize: 12, fill: '#fff' } })], [])
  assert.equal(hasChanges(diffDiagrams(saved, current)), false)
})

test('edge added/removed/modified, label falls back to source -> target when unlabeled', () => {
  const saved = diagram([node('a'), node('b')], [edge('e1', 'a', 'b')])
  const current = diagram([node('a'), node('b')], [edge('e1', 'a', 'b', { label: 'flows to' })])
  const diff = diffDiagrams(saved, current)
  assert.equal(diff.modified.length, 1)
  assert.deepEqual(diff.modified[0].changedFields, ['label'])
})

test('edge with no label uses endpoint labels', () => {
  const saved = diagram([], [])
  const current = diagram([node('a'), node('b')], [edge('e1', 'a', 'b')])
  const diff = diffDiagrams(saved, current)
  const addedEdge = diff.added.find((c) => c.kind === 'edge')
  assert.equal(addedEdge.label, 'Node a → Node b')
})

test('summarizeChanges: omits empty buckets, order modified/added/removed', () => {
  assert.equal(
    summarizeChanges({ added: [{}], removed: [], modified: [{}, {}] }),
    '2 modified, 1 added'
  )
  assert.equal(summarizeChanges({ added: [], removed: [], modified: [] }), '')
})

test('groupConnections: connections that went with an element are listed under it', () => {
  const saved = diagram(
    [node('a'), node('gone'), node('b')],
    [edge('e1', 'a', 'gone'), edge('e2', 'gone', 'b'), edge('lone', 'a', 'b')]
  )
  const current = diagram([node('a'), node('b')], [])
  const diff = diffDiagrams(saved, current)
  const groups = groupConnections(diff.removed)
  const gone = groups.find((g) => g.element.id === 'gone')
  assert.deepEqual(gone.connections.map((c) => c.id).sort(), ['e1', 'e2'])
  // A connection whose ends both survive is a decision of its own.
  const lone = groups.find((g) => g.element.id === 'lone')
  assert.deepEqual(lone.connections, [])
  assert.equal(
    groups.some((g) => g.element.id === 'e1'),
    false
  )
  // Modified rows are never grouped.
  const modified = groupConnections([
    { kind: 'node', id: 'n', label: 'n', changeType: 'modified' },
    { kind: 'edge', id: 'e', label: 'e', changeType: 'modified', source: 'n', target: 'x' }
  ])
  assert.equal(modified.length, 2)
})
