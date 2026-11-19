// Stencils in the shared model and the SVG export (ADR 0180).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SVG_EXPORT_OPTIONS, renderDiagramSvg } from '../export/renderDiagram.ts'
import { layoutNodes } from '../export/model.ts'
import { layoutIssues } from '../edit/inspect.ts'
import { STENCIL_KINDS, STENCIL_MARK_PATHS } from './kinds.ts'

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
    stencil('begin', 'event-start', 0, 20),
    stencil('check', 'branch-exclusive', 120, 16),
    stencil('work', 'step', 240, 8),
    stencil('stop', 'event-end', 440, 20),
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
  assert.deepEqual([laid.get('work').width, laid.get('work').height], [150, 56])
  assert.equal(laid.get('check').kind, 'stencil')
})

test('the kinds are drawn as a circle, a square with a mark and a rectangle with an arrow band', () => {
  const svg = render(flow())
  assert.match(svg, /class="chd-stencil" data-id="begin"[^]*?<circle/)
  assert.match(svg, /class="chd-stencil" data-id="check"[^]*?<rect[^]*?<path d="M[^"]+L[^"]+M/)
  assert.match(svg, /class="chd-stencil" data-id="work"[^]*?rx="4"[^]*?<path d="M[^"]+Z"/)
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
  assert.match(svg, /data-id="x"[^]*?rx="4"[^]*?<path d="M[^"]+Z"/)
})

test('the layout check leaves a stencil label that sits outside its shape alone', () => {
  const issues = layoutIssues(flow())
  assert.equal(issues.filter((i) => i.kind === 'label-overflow').length, 0)
})

test('every kind is drawn, with its mark from the shared table and a second ring where it has one', () => {
  for (const kind of STENCIL_KINDS) {
    const svg = render({ version: 1, nodes: [stencil('k', kind.id, 0, 0)], edges: [] })
    assert.match(svg, /class="chd-stencil" data-id="k"/, kind.id)
    if (kind.mark) assert.ok(svg.includes(STENCIL_MARK_PATHS[kind.mark]), `${kind.id} mark`)
    if (kind.shape === 'circle') {
      const circles = svg
        .split('class="chd-stencil"')[1]
        .split('</g>')[0]
        .match(/<circle/g)
      assert.equal(circles.length, kind.doubleBorder ? 2 : 1, kind.id)
    }
  }
})

test('the label of a step with a mark keeps clear of the mark', () => {
  const svg = render({
    version: 1,
    nodes: [{ ...stencil('u', 'step-human', 0, 0), data: { label: 'Review', kind: 'step-human' } }],
    edges: []
  })
  const tx = Number(/data-id="u"[^]*?<tspan[^>]* x="([0-9.-]+)"/.exec(svg)[1])
  const width = 150
  assert.ok(tx > 28 && tx < width - 28 - 10, 'the text starts between the band and the mark')
})

const labelOf = (svg, id) => {
  const group = svg.split(`data-id="${id}"`)[1].split('</g>')[0]
  const tspan = /<tspan[^>]* x="([0-9.-]+)"[^>]* y="([0-9.-]+)"/.exec(group)
  return { x: Number(tspan[1]), y: Number(tspan[2]) }
}
const one = (extra) => ({
  version: 1,
  nodes: [
    {
      ...stencil('s', 'event', 200, 200),
      data: { label: 'Begin', kind: 'event', ...extra }
    }
  ],
  edges: []
})

test('a label sits where its position says, and a free one is tied to its shape by a dotted line', () => {
  const below = labelOf(render(one({})), 's')
  const above = labelOf(render(one({ labelPosition: 'above' })), 's')
  const left = labelOf(render(one({ labelPosition: 'left' })), 's')
  const right = labelOf(render(one({ labelPosition: 'right' })), 's')
  assert.ok(above.y < 200 && below.y > 240, 'above and below')
  assert.ok(left.x < 200, 'left of the shape (its text ends at the shape)')
  assert.ok(right.x >= 240, 'right of the shape')
  assert.doesNotMatch(render(one({ labelPosition: 'above' })), /chd-label-leader/)
  const free = render(one({ labelPosition: 'free', labelOffset: { x: 90, y: -60 } }))
  assert.match(free, /class="chd-label-leader"/)
  assert.match(free, /stroke-dasharray="2 3"/)
  // A free label right beside its shape needs no line.
  assert.doesNotMatch(
    render(one({ labelPosition: 'free', labelOffset: { x: 0, y: 36 } })),
    /chd-label-leader/
  )
})

test('an unknown label position is read as below, and a step ignores the position', () => {
  assert.deepEqual(
    labelOf(render(one({ labelPosition: 'diagonal' })), 's'),
    labelOf(render(one({})), 's')
  )
  const step = {
    version: 1,
    nodes: [
      {
        ...stencil('w', 'step', 0, 0),
        data: { label: 'Work', kind: 'step', labelPosition: 'left' }
      }
    ],
    edges: []
  }
  assert.doesNotMatch(render(step), /chd-label-leader/)
  assert.ok(labelOf(render(step), 'w').x > 28, 'the label stays inside the step')
})

test('an end that stops the whole flow is a solid disc with its mark cut out; the outcome sets the mark', () => {
  const end = (extra) => ({
    version: 1,
    nodes: [
      { ...stencil('e', 'event-end', 0, 0), data: { label: 'e', kind: 'event-end', ...extra } }
    ],
    edges: []
  })
  const circle = (svg) => /<circle[^>]*fill="(#[0-9a-f]{6})"[^>]*stroke="(#[0-9a-f]{6})"/.exec(svg)
  const path = (svg) => /<g transform="translate[^"]*"><path d="([^"]+)"/.exec(svg)[1]
  const hollow = render(end({}))
  assert.notEqual(circle(hollow)[1], circle(hollow)[2], 'a path that ends is hollow')
  assert.equal(path(hollow), STENCIL_MARK_PATHS.check, 'success is a tick')
  const solid = render(end({ outcome: 'failed', reach: 'flow' }))
  assert.equal(circle(solid)[1], circle(solid)[2], 'the border colour fills the disc')
  assert.equal(path(solid), STENCIL_MARK_PATHS.cross)
  assert.equal(path(render(end({ outcome: 'aborted' }))), STENCIL_MARK_PATHS.stop)
  assert.equal(path(render(end({ outcome: 'warnings' }))), STENCIL_MARK_PATHS['check-warn'])
})

test('an event that starts a flow is drawn with one ring, one in the flow with two', () => {
  const rings = (extra) => {
    const svg = render({
      version: 1,
      nodes: [
        {
          ...stencil('t', 'event-timer', 0, 0),
          data: { label: 't', kind: 'event-timer', ...extra }
        }
      ],
      edges: []
    })
    return svg
      .split('class="chd-stencil"')[1]
      .split('</g>')[0]
      .match(/<circle/g).length
  }
  assert.equal(rings({}), 2)
  assert.equal(rings({ flowPosition: 'in-flow' }), 2)
  assert.equal(rings({ flowPosition: 'start' }), 1)
  assert.equal(rings({ flowPosition: 'from-the-future' }), 2)
})
