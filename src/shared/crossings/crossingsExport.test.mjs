// Gates in the SVG export (ADR 0185).
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SVG_EXPORT_OPTIONS, renderDiagramSvg } from '../export/renderDiagram.ts'
import { GATE_LENGTH, GATE_WIDTH } from './crossings.ts'

const options = { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() }
const entity = (id, x, y, parentId) => ({
  id,
  type: 'entity',
  position: { x, y },
  size: { width: 80, height: 40 },
  data: { label: id },
  ...(parentId ? { parentId } : {})
})
const box = (id, x, y, width, height, parentId) => ({
  id,
  type: 'container',
  position: { x, y },
  size: { width, height },
  data: { label: id },
  ...(parentId ? { parentId } : {})
})
const edge = (id, source, target, extra = {}) => ({
  id,
  source,
  target,
  sourceHandle: 'bottom',
  targetHandle: 'top',
  ...extra
})

// Sales (top) holds Billing; Warehouse is below it. `a` is in Sales, `bill` in Billing, `pick` in
// Warehouse, `side` next to `a` in Sales.
const diagram = () => ({
  version: 1,
  nodes: [
    box('Sales', 0, 0, 400, 240),
    box('Billing', 220, 40, 160, 160, 'Sales'),
    box('Warehouse', 0, 300, 400, 200),
    entity('a', 20, 40, 'Sales'),
    entity('side', 20, 150, 'Sales'),
    entity('bill', 40, 60, 'Billing'),
    entity('pick', 20, 60, 'Warehouse')
  ],
  edges: [
    edge('cross', 'side', 'pick'),
    edge('within', 'a', 'side'),
    edge('nested', 'bill', 'pick')
  ]
})

const gates = (svg, id) =>
  [
    ...svg
      .split(`data-id="${id}"`)[1]
      .split('<g class="chd-edge"')[0]
      .matchAll(/<line class="chd-crossing-gate"[^>]*>/g)
  ].map((m) => m[0])

test('there are no gates unless asked for', () => {
  assert.doesNotMatch(renderDiagramSvg(diagram(), options), /chd-crossing-gate/)
})

test('an edge between two lanes has a gate on each border, and one inside a lane has none', () => {
  const svg = renderDiagramSvg(diagram(), { ...options, crossings: true })
  assert.equal(gates(svg, 'cross').length, 2)
  assert.equal(gates(svg, 'within').length, 0)
})

test('a gate lies along the border: a bar that is flat on the border an edge crosses downward', () => {
  const svg = renderDiagramSvg(diagram(), { ...options, crossings: true })
  for (const line of gates(svg, 'cross')) {
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) =>
      Number(new RegExp(` ${k}="([0-9.-]+)"`).exec(line)[1])
    )
    assert.equal(y1, y2, 'horizontal')
    assert.ok(x2 > x1)
  }
})

test('an edge out of a nested container has a gate for each border it crosses', () => {
  const svg = renderDiagramSvg(diagram(), { ...options, crossings: true })
  // Billing, Sales and Warehouse: out, out, in.
  assert.equal(gates(svg, 'nested').length, 3)
})

test('a gate has round ends and the length of GATE_LENGTH with them', () => {
  const svg = renderDiagramSvg(diagram(), { ...options, crossings: true })
  const line = gates(svg, 'cross')[0]
  assert.match(line, /stroke-linecap="round"/)
  const [x1, x2] = ['x1', 'x2'].map((k) => Number(new RegExp(` ${k}="([0-9.-]+)"`).exec(line)[1]))
  assert.ok(Math.abs(x2 - x1 + GATE_WIDTH - GATE_LENGTH) < 0.01)
})

test('the gate colour follows the theme', () => {
  const dark = renderDiagramSvg(diagram(), { ...options, theme: 'dark', crossings: true })
  const light = renderDiagramSvg(diagram(), { ...options, theme: 'light', crossings: true })
  assert.match(gates(dark, 'cross')[0], /stroke="#e0a43a"/)
  assert.match(gates(light, 'cross')[0], /stroke="#b8741a"/)
})
