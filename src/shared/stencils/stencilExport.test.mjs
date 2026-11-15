// Stencils in the shared model and the SVG export (ADR 0180).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SVG_EXPORT_OPTIONS, renderDiagramSvg } from '../export/renderDiagram.ts'
import { layoutNodes } from '../export/model.ts'
import { layoutIssues } from '../edit/inspect.ts'

const render = (diagram) =>
  renderDiagramSvg(diagram, { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() })

const stencil = (id, kind, x, y, extra = {}) => ({
  id,
  type: 'stencil',
  position: { x, y },
  data: { label: id, kind },
  ...extra
})

const flow = () => ({
  version: 1,
  nodes: [
    stencil('begin', 'start', 0, 20),
    stencil('check', 'decision', 120, 16),
    stencil('work', 'step', 240, 8),
    stencil('stop', 'end', 440, 20),
    {
      id: 'pad',
      type: 'entity',
      position: { x: 120, y: 160 },
      size: { width: 120, height: 60 },
      data: { label: 'System' }
    }
  ],
  edges: [
    { id: 'e1', source: 'begin', target: 'check', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e2', source: 'check', target: 'work', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e3', source: 'work', target: 'stop', sourceHandle: 'right', targetHandle: 'left' }
  ]
})

test('a stencil takes the size of its kind when the file gives none', () => {
  const laid = layoutNodes(flow())
  assert.deepEqual([laid.get('begin').width, laid.get('begin').height], [40, 40])
  assert.deepEqual([laid.get('check').width, laid.get('check').height], [48, 48])
  assert.deepEqual([laid.get('work').width, laid.get('work').height], [140, 56])
  assert.equal(laid.get('check').kind, 'stencil')
})

test('the kinds are drawn as a circle, a square with a mark and a rounded rectangle', () => {
  const svg = render(flow())
  assert.match(svg, /class="chd-stencil" data-id="begin"[^]*?<circle/)
  assert.match(svg, /class="chd-stencil" data-id="check"[^]*?<rect[^]*?<path d="M[^"]+L[^"]+M/)
  assert.match(svg, /class="chd-stencil" data-id="work"[^]*?rx="12"/)
})

test('an end has a heavier border than a start', () => {
  const svg = render(flow())
  const width = (id) =>
    Number(new RegExp(`data-id="${id}"[^]*?stroke-width="([0-9.]+)"`).exec(svg)[1])
  assert.ok(width('stop') > width('begin') * 2)
})

test('the small shapes carry their label below, the step inside', () => {
  const svg = render(flow())
  const textY = (id) =>
    Number(new RegExp(`data-id="${id}"[^]*?<tspan[^>]* y="([0-9.\\-]+)"`).exec(svg)[1])
  assert.ok(textY('begin') > 20 + 40, 'start label is below its circle')
  assert.ok(textY('work') < 8 + 56, 'step label is inside its box')
})

test('an edge to a stencil is drawn', () => {
  const svg = render(flow())
  assert.match(svg, /data-id="e1"/)
  assert.match(svg, /data-id="e3"/)
})

test('a kind this version does not know is drawn as a step', () => {
  const svg = render({ version: 1, nodes: [stencil('x', 'from-the-future', 0, 0)], edges: [] })
  assert.match(svg, /data-id="x"[^]*?rx="12"/)
})

test('the layout check leaves a stencil label that sits outside its shape alone', () => {
  const issues = layoutIssues(flow())
  assert.equal(issues.filter((i) => i.kind === 'label-overflow').length, 0)
})
