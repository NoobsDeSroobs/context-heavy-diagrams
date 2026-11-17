// The label of a container on each side: the SVG export, draw.io and the layout check (ADR 0184).
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SVG_EXPORT_OPTIONS, renderDiagramSvg } from '../export/renderDiagram.ts'
import { renderDiagramDrawio } from '../export/drawio.ts'
import { layoutIssues } from '../edit/inspect.ts'

const options = { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map() }
const lane = (data = {}, style) => ({
  version: 1,
  nodes: [
    {
      id: 'lane',
      type: 'container',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      data: { label: 'Sales', ...data },
      ...(style ? { style } : {})
    }
  ],
  edges: []
})
const render = (data, style) => renderDiagramSvg(lane(data, style), options)
const group = (svg) => svg.split('data-id="lane"')[1].split('</g>')[0]
const spot = (svg) => {
  const t = /<tspan[^>]* x="([0-9.-]+)"[^>]* y="([0-9.-]+)"/.exec(svg)
  return { x: Number(t[1]), y: Number(t[2]) }
}

test('a label with no side is at the top left, as before', () => {
  const svg = render({})
  const at = spot(group(svg))
  assert.ok(at.x < 20 && at.y < 24)
  assert.doesNotMatch(group(svg), /rotate\(/)
})

test('the top of the text points at the side: turned left on the left, right on the right', () => {
  assert.match(render({ labelPosition: 'left' }), /<g transform="rotate\(-90 /)
  assert.match(render({ labelPosition: 'right' }), /<g transform="rotate\(90 /)
})

test('a label at the bottom stays upright, along the bottom edge', () => {
  const svg = render({ labelPosition: 'bottom' })
  assert.doesNotMatch(group(svg), /rotate\(/)
  assert.ok(spot(group(svg)).y > 170)
})

test('the text alignment lines the label up along its side', () => {
  const start = spot(group(render({}, { textAlign: 'start' }))).x
  const center = spot(group(render({}, { textAlign: 'center' }))).x
  const end = spot(group(render({}, { textAlign: 'end' }))).x
  assert.ok(start < center && center < end)
})

test('an unknown side is read as the top', () => {
  assert.deepEqual(spot(group(render({ labelPosition: 'diagonal' }))), spot(group(render({}))))
})

test('draw.io turns a left label, and says a right one reads the other way', () => {
  const left = renderDiagramDrawio(lane({ labelPosition: 'left' }), options)
  assert.match(left.xml, /horizontal=0/)
  const right = renderDiagramDrawio(lane({ labelPosition: 'right' }), options)
  assert.ok(right.notes.some((n) => /on the right drawn reading upward/.test(n)))
  const bottom = renderDiagramDrawio(lane({ labelPosition: 'bottom' }), options)
  assert.match(bottom.xml, /verticalAlign=bottom/)
  assert.doesNotMatch(bottom.xml, /horizontal=0/)
})

test('the layout check measures a turned label along the height of its container', () => {
  const tall = (side) => ({
    version: 1,
    nodes: [
      {
        id: 'lane',
        type: 'container',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 60 },
        data: { label: 'Unbreakable' + 'x'.repeat(40), labelPosition: side }
      }
    ],
    edges: []
  })
  // 60 px high: a long word does not fit along it when the label is turned, but fits across 400 px.
  assert.equal(layoutIssues(tall('top')).filter((i) => i.kind === 'label-overflow').length, 0)
  assert.equal(layoutIssues(tall('left')).filter((i) => i.kind === 'label-overflow').length, 1)
})
