// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
// Covers parseDiagram's legacy-field normalization (Shape -> Entity rename, details -> notes) — every other DiagramFile concern is exercised through the app
// itself, not unit-tested here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagram, serializeDiagram } from './index.ts'

const minimal = (extra = {}) => JSON.stringify({ version: 1, nodes: [], edges: [], ...extra })

test('a pre-rename node type is normalized to entity on load', () => {
  const file = parseDiagram(
    minimal({ nodes: [{ id: 'n1', type: 'shape', position: { x: 0, y: 0 }, data: { label: '' } }] })
  )
  assert.equal(file.nodes[0].type, 'entity')
})

test('an already-current node type is left untouched', () => {
  const file = parseDiagram(
    minimal({
      nodes: [{ id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: '' } }]
    })
  )
  assert.equal(file.nodes[0].type, 'entity')
})

test('a pre-rename legend entry kind is normalized to entity on load', () => {
  const file = parseDiagram(minimal({ legend: [{ id: 'l1', kind: 'shape', label: 'x' }] }))
  assert.equal(file.legend[0].kind, 'entity')
})

test('pre-rename security id lists (matrixShapeIds/hiddenShapeIds) fold into the current field names', () => {
  const file = parseDiagram(
    minimal({
      security: { threats: [], matrixShapeIds: ['n1'], hiddenShapeIds: ['n1'] }
    })
  )
  assert.deepEqual(file.security.matrixEntityIds, ['n1'])
  assert.deepEqual(file.security.hiddenEntityIds, ['n1'])
  assert.equal(file.security.matrixShapeIds, undefined)
})

test('current field names win over legacy ones if a file somehow has both', () => {
  const file = parseDiagram(
    minimal({
      security: { threats: [], matrixEntityIds: ['current'], matrixShapeIds: ['legacy'] }
    })
  )
  assert.deepEqual(file.security.matrixEntityIds, ['current'])
})

test('a file with none of the legacy fields round-trips untouched', () => {
  const raw = minimal({
    nodes: [{ id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: '' } }]
  })
  const file = parseDiagram(raw)
  assert.equal(file.nodes[0].type, 'entity')
})

test('serializeDiagram never writes the legacy names, even for a freshly-normalized legacy load', () => {
  const file = parseDiagram(
    minimal({
      nodes: [{ id: 'n1', type: 'shape', position: { x: 0, y: 0 }, data: { label: '' } }],
      security: { threats: [{ id: 't1', name: 'T' }], matrixShapeIds: ['n1'] }
    })
  )
  const out = serializeDiagram(file)
  assert.ok(out.includes('"entity"'))
  assert.ok(!out.includes('"shape"'))
  assert.ok(out.includes('matrixEntityIds'))
  assert.ok(!out.includes('matrixShapeIds'))
})

const noteNode = (data) => ({ id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data })

test('a note path stored as details is read as notes', () => {
  const file = parseDiagram(
    minimal({ nodes: [noteNode({ label: 'A', details: 'd/details/a.md' })] })
  )
  assert.equal(file.nodes[0].data.notes, 'd/details/a.md')
  assert.ok(!('details' in file.nodes[0].data))
})

test('notes wins when a node has both notes and details', () => {
  const file = parseDiagram(
    minimal({ nodes: [noteNode({ label: 'A', notes: 'n/a.md', details: 'd/a.md' })] })
  )
  assert.equal(file.nodes[0].data.notes, 'n/a.md')
  assert.ok(!('details' in file.nodes[0].data))
})

test('a file saved after reading details writes notes only', () => {
  const out = serializeDiagram(
    parseDiagram(minimal({ nodes: [noteNode({ label: 'A', details: 'd/details/a.md' })] }))
  )
  assert.ok(out.includes('"notes": "d/details/a.md"'))
  assert.ok(!out.includes('"details"'))
})

test('a node without a note gets neither key', () => {
  const file = parseDiagram(minimal({ nodes: [noteNode({ label: 'A' })] }))
  assert.ok(!('notes' in file.nodes[0].data))
})

test('an edge animation survives a save and a load, and no animation writes no key', () => {
  const edge = (id, style) => ({ id, source: 'a', target: 'b', style })
  const file = parseDiagram(
    minimal({
      edges: [
        edge('e1', { animation: 'pulse', animationSpeed: 2, animationDirection: 'reverse' }),
        edge('e2', { stroke: '#f00' })
      ]
    })
  )
  const out = JSON.parse(serializeDiagram(file))
  assert.deepEqual(out.edges[0].style, {
    animation: 'pulse',
    animationSpeed: 2,
    animationDirection: 'reverse'
  })
  assert.equal('animation' in out.edges[1].style, false)
})
