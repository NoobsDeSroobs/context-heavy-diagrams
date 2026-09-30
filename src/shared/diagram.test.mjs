// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
// Covers parseDiagram's legacy-field normalization (Shape -> Entity rename,
// epic 0076) — every other DiagramFile concern is exercised through the app
// itself, not unit-tested here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagram, serializeDiagram } from './diagram.ts'

const minimal = (extra = {}) => JSON.stringify({ version: 1, nodes: [], edges: [], ...extra })

test('a pre-rename node type is normalized to entity on load', () => {
  const file = parseDiagram(
    minimal({ nodes: [{ id: 'n1', type: 'shape', position: { x: 0, y: 0 }, data: { label: '' } }] })
  )
  assert.equal(file.nodes[0].type, 'entity')
})

test('an already-current node type is left untouched', () => {
  const file = parseDiagram(
    minimal({ nodes: [{ id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: '' } }] })
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
