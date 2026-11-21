// Run with `npm test`. The persisted form of visibility sets (ADR 0194): written when used, left out
// when empty, ids in a stable order, and read back unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagram, serializeDiagram } from './index.ts'

const node = (id, extra = {}) => ({ id, position: { x: 0, y: 0 }, data: { label: id }, ...extra })
const edge = (id, extra = {}) => ({ id, source: 'a', target: 'b', ...extra })
const file = (extra = {}) => ({ version: 1, nodes: [], edges: [], ...extra })

test('a catalogue and the sets of a node and an edge are written, and read back as written', () => {
  const diagram = file({
    visibilitySets: [
      { id: 'vis-2', name: 'Proposed' },
      { id: 'vis-1', name: 'Today' }
    ],
    nodes: [node('a', { visibilitySetIds: ['vis-1'] }), node('b')],
    edges: [edge('e', { visibilitySetIds: ['vis-2'] })]
  })
  const back = parseDiagram(serializeDiagram(diagram))
  assert.deepEqual(back.visibilitySets, diagram.visibilitySets)
  assert.deepEqual(back.nodes[0].visibilitySetIds, ['vis-1'])
  assert.equal(back.nodes[1].visibilitySetIds, undefined)
  assert.deepEqual(back.edges[0].visibilitySetIds, ['vis-2'])
})

test('the order of the catalogue is kept, since it is the order shown', () => {
  const sets = [
    { id: 'z', name: 'Last id, first set' },
    { id: 'a', name: 'First id, second set' }
  ]
  const back = parseDiagram(serializeDiagram(file({ visibilitySets: sets })))
  assert.deepEqual(
    back.visibilitySets.map((s) => s.id),
    ['z', 'a']
  )
})

test('the ids of an element are written sorted and without repeats', () => {
  const out = serializeDiagram(file({ nodes: [node('a', { visibilitySetIds: ['b', 'a', 'b'] })] }))
  assert.deepEqual(parseDiagram(out).nodes[0].visibilitySetIds, ['a', 'b'])
})

test('empty values are left out of the file', () => {
  const out = serializeDiagram(
    file({
      visibilitySets: [],
      nodes: [node('a', { visibilitySetIds: [] })],
      edges: [edge('e', { visibilitySetIds: [] })]
    })
  )
  assert.equal(out.includes('visibilitySet'), false)
})

test('a diagram that does not use the feature is written as before', () => {
  const out = serializeDiagram(file({ nodes: [node('a')], edges: [edge('e')] }))
  assert.equal(out.includes('visibilitySet'), false)
})

test('an id that is not in the catalogue is kept, not dropped on a save', () => {
  const diagram = file({ nodes: [node('a', { visibilitySetIds: ['gone'] })] })
  assert.deepEqual(parseDiagram(serializeDiagram(diagram)).nodes[0].visibilitySetIds, ['gone'])
})
