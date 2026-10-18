// Run with `npm test`. Covers where a paste lands: the pasted group should be
// centred on the paste point, not hang its top-left corner there.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { remapForPaste } from './clipboard.ts'

let counter = 0
const newId = (prefix) => `${prefix}-new-${++counter}`
const entity = (id, x, y, width, height, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  width,
  height,
  data: {},
  ...extra
})
const payload = (nodes, edges = []) => ({
  chdClipboard: true,
  version: 1,
  nodes,
  edges,
  sourceDiagramBaseName: null
})
const centreOf = (node) => ({
  x: node.position.x + node.width / 2,
  y: node.position.y + node.height / 2
})

test('a single pasted entity is centred on the paste point', () => {
  const { nodes } = remapForPaste(
    payload([entity('a', 10, 20, 112, 80)]),
    newId,
    { x: 1000, y: 500 },
    null
  )
  assert.deepEqual(centreOf(nodes[0]), { x: 1000, y: 500 })
})

test('a pasted group is centred on the paste point by its bounding box', () => {
  // Spans x 0..300, y 0..180, so its centre is (150, 90).
  const group = payload([entity('a', 0, 0, 100, 60), entity('b', 200, 100, 100, 80)])
  const { nodes } = remapForPaste(group, newId, { x: 1000, y: 500 }, null)
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const maxX = Math.max(...nodes.map((n) => n.position.x + n.width))
  const minY = Math.min(...nodes.map((n) => n.position.y))
  const maxY = Math.max(...nodes.map((n) => n.position.y + n.height))
  assert.deepEqual({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, { x: 1000, y: 500 })
})

test('the group keeps its internal layout', () => {
  const group = payload([entity('a', 0, 0, 100, 60), entity('b', 200, 100, 100, 80)])
  const { nodes } = remapForPaste(group, newId, { x: 1000, y: 500 }, null)
  assert.deepEqual(
    {
      dx: nodes[1].position.x - nodes[0].position.x,
      dy: nodes[1].position.y - nodes[0].position.y
    },
    { dx: 200, dy: 100 }
  )
})

test('a node without a recorded size counts as a point, as before', () => {
  const { nodes } = remapForPaste(
    payload([{ id: 'a', type: 'entity', position: { x: 40, y: 40 }, data: {} }]),
    newId,
    { x: 100, y: 100 },
    null
  )
  assert.deepEqual(nodes[0].position, { x: 100, y: 100 })
})

test('a child inside a copied container keeps its parent-relative position', () => {
  const group = payload([
    entity('c', 0, 0, 300, 200, { type: 'container' }),
    entity('k', 20, 30, 100, 60, { parentId: 'c' })
  ])
  const { nodes } = remapForPaste(group, newId, { x: 1000, y: 500 }, null)
  const child = nodes.find((n) => n.parentId)
  assert.deepEqual(child.position, { x: 20, y: 30 })
  assert.deepEqual(centreOf(nodes.find((n) => !n.parentId)), { x: 1000, y: 500 })
})
