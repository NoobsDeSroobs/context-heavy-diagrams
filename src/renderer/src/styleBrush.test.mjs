// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBrushToEdgeData,
  applyBrushToNodeData,
  brushAppliesToNode,
  captureEdgeBrush,
  captureNodeBrush
} from './styleBrush.ts'

const shape = (style, extra = {}) => ({
  type: 'entity',
  data: { label: 'A', style, ...extra }
})

test('only visual style crosses over; label, tags and details stay the target’s', () => {
  const brush = captureNodeBrush(shape({ fill: '#f00', strokeWidth: 3 }, { details: 'x.md' }))
  const target = {
    label: 'B',
    details: 'y.md',
    metadata: { k: { value: 1 } },
    style: { fill: '#0f0' }
  }
  const next = applyBrushToNodeData(brush, target)
  assert.deepEqual(next.style, { fill: '#f00', strokeWidth: 3 })
  assert.equal(next.label, 'B')
  assert.equal(next.details, 'y.md')
  assert.deepEqual(next.metadata, { k: { value: 1 } })
})

test('the target ends up matching the source, not a blend (unset fields are cleared)', () => {
  const brush = captureNodeBrush(shape({ fill: '#f00' }))
  const next = applyBrushToNodeData(brush, { style: { fill: '#0f0', stroke: '#00f' } })
  assert.deepEqual(next.style, { fill: '#f00' })
})

test('a source with no style resets the target to defaults', () => {
  const brush = captureNodeBrush({ type: 'entity', data: {} })
  const next = applyBrushToNodeData(brush, { style: { fill: '#0f0' } })
  assert.deepEqual(next.style, {})
})

test('capture takes a copy: later edits to the source do not leak into the brush', () => {
  const style = { fill: '#f00' }
  const brush = captureNodeBrush(shape(style))
  style.fill = '#000'
  assert.equal(brush.style.fill, '#f00')
})

test('applying does not share the brush’s object with the target', () => {
  const brush = captureNodeBrush(shape({ fill: '#f00' }))
  const next = applyBrushToNodeData(brush, {})
  next.style.fill = '#000'
  assert.equal(brush.style.fill, '#f00')
})

test('only the same node type accepts the brush', () => {
  const brush = captureNodeBrush(shape({ fill: '#f00' }))
  assert.equal(brushAppliesToNode(brush, { type: 'entity' }), true)
  assert.equal(brushAppliesToNode(brush, { type: 'container' }), false)
  assert.equal(brushAppliesToNode(brush, { type: 'text' }), false)
  assert.equal(brushAppliesToNode(brush, { type: 'line' }), false)
  // a node brush never applies where an edge brush was captured, and vice versa
  assert.equal(brushAppliesToNode(captureEdgeBrush({ data: {} }), { type: 'entity' }), false)
})

test('an untyped node counts as an entity; an unrecognized type cannot be a source', () => {
  assert.equal(captureNodeBrush({ data: {} })?.nodeType, 'entity')
  assert.equal(captureNodeBrush({ type: 'unknown-future-type', data: {} }), null)
})

test('edges: look is copied, label position and routing stay the target’s', () => {
  const brush = captureEdgeBrush({
    data: {
      style: {
        stroke: '#f00',
        strokeWidth: 4,
        lineStyle: 'dashed',
        labelPosition: 0.2,
        routingStyle: 'step'
      }
    }
  })
  assert.equal('labelPosition' in brush.style, false)
  assert.equal('routingStyle' in brush.style, false)
  const target = {
    points: [{ x: 1, y: 2 }],
    style: { stroke: '#0f0', labelPosition: 0.8, routingStyle: 'straight' }
  }
  const next = applyBrushToEdgeData(brush, target)
  assert.deepEqual(next.style, {
    stroke: '#f00',
    strokeWidth: 4,
    lineStyle: 'dashed',
    labelPosition: 0.8,
    routingStyle: 'straight'
  })
  assert.deepEqual(next.points, [{ x: 1, y: 2 }])
})

test('an edge with no data of its own still takes the style', () => {
  const brush = captureEdgeBrush({ data: { style: { stroke: '#f00' } } })
  assert.deepEqual(applyBrushToEdgeData(brush, undefined), { style: { stroke: '#f00' } })
})
