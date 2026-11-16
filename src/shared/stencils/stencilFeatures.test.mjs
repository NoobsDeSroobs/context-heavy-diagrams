// Stencils in search, the legend, the draw.io export, the review of changes and conformance (ADR 0180).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSearchQuery, searchableFromData } from '../search/search.ts'
import { buildExportLegendItems, stencilKindsUsed } from '../legend/legendItems.ts'
import {
  DEFAULT_SVG_EXPORT_OPTIONS,
  defaultLegendItems,
  renderDiagramSvg
} from '../export/renderDiagram.ts'
import { renderDiagramDrawio } from '../export/drawio.ts'
import { classifyDiagrams } from '../compare/classify.ts'
import { stencilSwatchSvg } from './swatch.ts'

const stencil = (id, kind, label = id, extra = {}) => ({
  id,
  type: 'stencil',
  position: { x: 0, y: 0 },
  data: { label, kind },
  ...extra
})
const diagram = (nodes, edges = [], extra = {}) => ({ version: 1, nodes, edges, ...extra })

test('a stencil is found by its label, its kind and the terms the kind is known by', () => {
  const found = (query, data) => matchesSearchQuery(query, searchableFromData('c', data))
  const decision = { label: 'Approved?', kind: 'decision' }
  assert.ok(found('approved', decision))
  assert.ok(found('gateway', decision))
  assert.ok(found('xor', decision))
  assert.ok(!found('gateway', { label: 'Do the work', kind: 'step' }))
  assert.ok(found('task', { label: 'Do the work', kind: 'step' }))
})

test('the legend lists the kinds a diagram uses, once each, in the order of the list', () => {
  const nodes = [
    stencil('a', 'end'),
    stencil('b', 'decision'),
    stencil('c', 'decision'),
    stencil('d', 'start'),
    { id: 'e', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'E' } }
  ]
  assert.deepEqual(stencilKindsUsed(nodes), ['decision', 'start', 'end'])
  const items = defaultLegendItems(diagram(nodes))
  assert.deepEqual(
    items.map((i) => i.label),
    ['Decision', 'Start', 'End']
  )
  assert.equal(items[0].swatch.kind, 'stencil')
  assert.deepEqual(stencilKindsUsed([]), [])
  assert.equal(buildExportLegendItems([], [], new Set(), null).length, 0)
})

test('the SVG export draws the legend rows of the stencils in use', () => {
  const d = diagram([stencil('d', 'decision')])
  const svg = renderDiagramSvg(d, {
    ...DEFAULT_SVG_EXPORT_OPTIONS,
    icons: new Map(),
    legend: { items: defaultLegendItems(d), corner: 'bottom-right' }
  })
  assert.match(svg, />Decision<\/tspan>/)
})

test('a legend swatch has the shape and the mark of its kind', () => {
  const colors = { fill: '#123456', stroke: '#abcdef', mark: '#ffffff' }
  assert.match(stencilSwatchSvg('start', colors), /<circle/)
  assert.match(
    stencilSwatchSvg('step', colors),
    /<rect[^>]*rx="2"[^]*<path d="M[^"]+Z" fill="#abcdef"/
  )
  assert.match(stencilSwatchSvg('decision', colors), /<path/)
  assert.doesNotMatch(stencilSwatchSvg('start', colors), /<path/)
})

test('the draw.io export keeps the shape and says the mark is lost', () => {
  const out = renderDiagramDrawio(
    diagram([stencil('s', 'start'), stencil('d', 'decision'), stencil('w', 'step')]),
    { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() }
  )
  assert.match(out.xml, /ellipse;/)
  assert.match(out.xml, /rhombus;/)
  assert.match(out.xml, /verticalLabelPosition=bottom/)
  assert.ok(out.notes.some((n) => /mark inside its shape/.test(n)))
})

test('a change of kind is a change in what the element is', () => {
  const before = diagram([stencil('a', 'step')])
  const after = diagram([stencil('a', 'decision')])
  const classified = classifyDiagrams(before, after)
  const fields = classified.nodes.get('a').fields.map((f) => f.field)
  assert.ok(fields.includes('kind'))
  assert.deepEqual(classified.nodes.get('a').fields.find((f) => f.field === 'kind').lines, [
    'kind: "step" → "decision"'
  ])
})
