// Run with `npm test`. What a focus frames (ADR 0194).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { focusedNodeIds } from './focus.ts'
import { ALL_SETS } from './story.ts'

const catalogue = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' }
]
const nodes = [
  { id: 'n1', setIds: ['a'] },
  { id: 'n2', setIds: ['a'] },
  { id: 'n3', setIds: ['b'] },
  { id: 'n4' }
]
const edges = [
  { source: 'n1', target: 'n3', setIds: ['a'] },
  { source: 'n3', target: 'n4', setIds: ['b'] }
]
const ids = (list) => [...list].sort()

test('a focus frames the visible nodes of its set', () => {
  assert.deepEqual(ids(focusedNodeIds('a', nodes, [], catalogue, new Set())), ['n1', 'n2'])
  assert.deepEqual(ids(focusedNodeIds('b', nodes, [], catalogue, new Set())), ['n3'])
})

test('what the set hides at that point is not framed', () => {
  assert.deepEqual(ids(focusedNodeIds('a', nodes, [], catalogue, new Set(['a']))), [])
  // a node in two sets is visible while either is shown, and is still a member of both
  const both = [{ id: 'x', setIds: ['a', 'b'] }]
  assert.deepEqual(focusedNodeIds('a', both, [], catalogue, new Set(['a'])), ['x'])
  assert.deepEqual(focusedNodeIds('a', both, [], catalogue, new Set(['a', 'b'])), [])
})

test('an edge of the set frames its visible ends', () => {
  assert.deepEqual(ids(focusedNodeIds('a', nodes, edges, catalogue, new Set())), ['n1', 'n2', 'n3'])
  // an end that is hidden is left out
  assert.deepEqual(ids(focusedNodeIds('a', nodes, edges, catalogue, new Set(['b']))), ['n1', 'n2'])
})

test('all sets frames everything that is visible, nodes in no set included', () => {
  assert.deepEqual(ids(focusedNodeIds(ALL_SETS, nodes, edges, catalogue, new Set())), [
    'n1',
    'n2',
    'n3',
    'n4'
  ])
  assert.deepEqual(ids(focusedNodeIds(ALL_SETS, nodes, edges, catalogue, new Set(['a', 'b']))), [
    'n4'
  ])
})

test('a set the diagram does not have frames nothing', () => {
  assert.deepEqual(focusedNodeIds('gone', nodes, edges, catalogue, new Set()), [])
})
