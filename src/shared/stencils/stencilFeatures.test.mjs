// Stencils in search, the legend, the draw.io export, the review of changes and conformance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSearchQuery, searchableFromData } from '../search/search.ts'
import { buildExportLegendItems, stencilLegendRows } from '../legend/legendItems.ts'
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
  const decision = { label: 'Approved?', kind: 'branch-exclusive' }
  assert.ok(found('approved', decision))
  assert.ok(found('gateway', decision))
  assert.ok(found('xor', decision))
  assert.ok(!found('gateway', { label: 'Do the work', kind: 'step' }))
  assert.ok(found('task', { label: 'Do the work', kind: 'step' }))
})

test('the legend lists the kinds a diagram uses, once each, in the order of the list', () => {
  const nodes = [
    stencil('a', 'event-end'),
    stencil('b', 'branch-exclusive'),
    stencil('c', 'branch-exclusive'),
    stencil('d', 'event-start'),
    { id: 'e', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'E' } }
  ]
  assert.deepEqual(
    stencilLegendRows(nodes).map((r) => r.kind),
    ['branch-exclusive', 'event-start', 'event-end']
  )
  const items = defaultLegendItems(diagram(nodes))
  assert.deepEqual(
    items.map((i) => i.label),
    ['Decision', 'Start', 'End']
  )
  assert.equal(items[0].swatch.kind, 'stencil')
  assert.deepEqual(stencilLegendRows([]), [])
  assert.equal(buildExportLegendItems([], [], new Set(), null).length, 0)
})

test('the SVG export draws the legend rows of the stencils in use', () => {
  const d = diagram([stencil('d', 'branch-exclusive')])
  const svg = renderDiagramSvg(d, {
    ...DEFAULT_SVG_EXPORT_OPTIONS,
    icons: new Map(),
    legend: { items: defaultLegendItems(d), corner: 'bottom-right' }
  })
  assert.match(svg, />Decision<\/tspan>/)
})

test('a legend swatch has the shape and the mark of its kind', () => {
  const colors = { fill: '#123456', stroke: '#abcdef', mark: '#ffffff' }
  assert.match(stencilSwatchSvg('event-start', colors), /<circle/)
  assert.match(
    stencilSwatchSvg('step', colors),
    /<rect[^>]*rx="2"[^]*<path d="M[^"]+Z" fill="#abcdef"/
  )
  assert.match(stencilSwatchSvg('branch-exclusive', colors), /<path/)
  assert.doesNotMatch(stencilSwatchSvg('event', colors), /<path/)
  assert.match(stencilSwatchSvg('event-start', colors), /<path d="M8 5l11 7-11 7z" fill="#ffffff"/)
})

test('the draw.io export keeps the shape and says the mark is lost', () => {
  const out = renderDiagramDrawio(
    diagram([stencil('s', 'event-start'), stencil('d', 'branch-exclusive'), stencil('w', 'step')]),
    { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() }
  )
  assert.match(out.xml, /ellipse;/)
  assert.match(out.xml, /rhombus;/)
  assert.match(out.xml, /verticalLabelPosition=bottom/)
  assert.ok(out.notes.some((n) => /mark inside its shape/.test(n)))
})

test('a change of kind is a change in what the element is', () => {
  const before = diagram([stencil('a', 'step')])
  const after = diagram([stencil('a', 'branch-exclusive')])
  const classified = classifyDiagrams(before, after)
  const fields = classified.nodes.get('a').fields.map((f) => f.field)
  assert.ok(fields.includes('kind'))
  assert.deepEqual(classified.nodes.get('a').fields.find((f) => f.field === 'kind').lines, [
    'kind: "step" → "branch-exclusive"'
  ])
})

test("where a small shape's label sits is a look in the review of changes, and goes to draw.io", () => {
  const before = diagram([stencil('a', 'event-start')])
  const after = diagram([
    {
      ...stencil('a', 'event-start'),
      data: { label: 'a', kind: 'event-start', labelPosition: 'above' }
    }
  ])
  const fields = classifyDiagrams(before, after).nodes.get('a').fields
  assert.deepEqual(
    fields.map((f) => f.field),
    ['label position']
  )
  const place = (data) => ({
    ...stencil('a', 'event-start'),
    data: { label: 'a', kind: 'event-start', ...data }
  })
  const xml = (data) =>
    renderDiagramDrawio(diagram([place(data)]), { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() })
  assert.match(xml({ labelPosition: 'above' }).xml, /verticalLabelPosition=top/)
  assert.match(xml({ labelPosition: 'left' }).xml, /labelPosition=left/)
  assert.match(xml({ labelPosition: 'right' }).xml, /labelPosition=right/)
  const free = xml({ labelPosition: 'free', labelOffset: { x: 50, y: 50 } })
  assert.match(free.xml, /verticalLabelPosition=bottom/)
  assert.ok(free.notes.some((n) => /placed freely/.test(n)))
})

test('the legend has a row for each way an end finishes that the diagram uses, in a fixed order', () => {
  const end = (id, data = {}) => ({
    ...stencil(id, 'event-end'),
    data: { label: id, kind: 'event-end', ...data }
  })
  const rows = stencilLegendRows([
    end('a', { outcome: 'aborted', reach: 'flow' }),
    end('b'),
    end('c', { outcome: 'failed' }),
    end('d', { outcome: 'failed' }),
    end('e', { outcome: 'from-the-future', reach: 'sideways' })
  ])
  assert.deepEqual(
    rows.map((r) => r.label),
    ['End', 'End: Failed', 'End: Aborted, the whole flow stops']
  )
  assert.deepEqual(rows[2].state, { outcome: 'aborted', reach: 'flow' })
  assert.deepEqual(
    stencilLegendRows([end('only')]).map((r) => r.label),
    ['End']
  )
  const items = defaultLegendItems(diagram([end('x', { outcome: 'warnings' })]))
  assert.deepEqual(items[0].swatch, {
    kind: 'stencil',
    stencilKind: 'event-end',
    state: { outcome: 'warnings', reach: 'path' }
  })
})

test('a legend swatch of an end shows its outcome and, for the whole flow, a solid disc', () => {
  const colors = { fill: '#123456', stroke: '#abcdef', mark: '#ffffff' }
  const circle = (svg) => svg.match(/<circle[^>]*>/)[0]
  const plain = stencilSwatchSvg('event-end', colors, { outcome: 'success', reach: 'path' })
  const failed = stencilSwatchSvg('event-end', colors, { outcome: 'failed', reach: 'path' })
  const solid = stencilSwatchSvg('event-end', colors, { outcome: 'failed', reach: 'flow' })
  assert.match(circle(plain), /fill="#123456"/)
  assert.notEqual(plain.match(/<path[^>]*>/)[0], failed.match(/<path[^>]*>/)[0])
  assert.match(circle(solid), /fill="#abcdef"/)
  assert.match(solid, /<path[^>]*stroke="#123456"/, 'the mark is cut out in the fill colour')
})

test('the SVG export draws a row for each way an end finishes', () => {
  const d = diagram([
    { ...stencil('a', 'event-end'), data: { label: 'a', kind: 'event-end', outcome: 'failed' } }
  ])
  const svg = renderDiagramSvg(d, {
    ...DEFAULT_SVG_EXPORT_OPTIONS,
    icons: new Map(),
    legend: { items: defaultLegendItems(d), corner: 'bottom-right' }
  })
  assert.match(svg, />End: Failed<\/tspan>/)
})
