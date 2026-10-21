// Run with `npm test`. The SVG export (ADR 0124): geometry shared with the canvas, the colour and
// text helpers that stand in for a browser, and the renderer over every diagram in the gallery.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readdirSync } from 'node:fs'
import { getBezierPath, getStraightPath, Position } from '@xyflow/system'
import { parseDiagram } from '../diagram/index.ts'
import { bezierPath, buildEdgePath } from '../geometry/edgePath.ts'
import { flattenPath, pointAtRatio } from '../geometry/pathSampling.ts'
import { flipRgbLightness, paintColor, parseCssColor } from './color.ts'
import { measureText, wrapText } from './textLayout.ts'
import {
  DEFAULT_SVG_EXPORT_OPTIONS,
  defaultLegendItems,
  renderDiagramSvg
} from './renderDiagram.ts'

const render = (diagram, extra = {}) =>
  renderDiagramSvg(diagram, { ...DEFAULT_SVG_EXPORT_OPTIONS, icons: new Map(), ...extra })

const diagramOf = (nodes, edges = [], extra = {}) => ({ version: 1, nodes, edges, ...extra })
const entity = (id, x, y, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  size: { width: 120, height: 60 },
  data: { label: id },
  ...extra
})

// ---- geometry shared with the canvas ----------------------------------------------------------

test('bezierPath matches React Flow getBezierPath on every side pairing', () => {
  const sides = ['top', 'right', 'bottom', 'left']
  const position = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left
  }
  const ends = [
    [
      { x: 0, y: 0 },
      { x: 200, y: 120 }
    ],
    [
      { x: 200, y: 120 },
      { x: 0, y: 0 }
    ],
    [
      { x: 10, y: 10 },
      { x: 10, y: 10 }
    ],
    [
      { x: 0, y: 50 },
      { x: 40, y: -90 }
    ]
  ]
  for (const [a, b] of ends) {
    for (const s of sides) {
      for (const t of sides) {
        const expected = getBezierPath({
          sourceX: a.x,
          sourceY: a.y,
          sourcePosition: position[s],
          targetX: b.x,
          targetY: b.y,
          targetPosition: position[t]
        })[0]
        assert.equal(bezierPath({ ...a, side: s }, { ...b, side: t }), expected)
      }
    }
  }
})

test('a straight edge matches React Flow getStraightPath', () => {
  const expected = getStraightPath({ sourceX: 1, sourceY: 2, targetX: 30, targetY: 40 })[0]
  const actual = buildEdgePath(
    'straight',
    { x: 1, y: 2, side: 'right' },
    { x: 30, y: 40, side: 'left' },
    [],
    8
  )
  assert.equal(actual, expected)
})

test('pointAtRatio finds the middle of a straight and of a curved path', () => {
  assert.deepEqual(pointAtRatio('M0,0 L100,0', 0.5), { x: 50, y: 0 })
  const mid = pointAtRatio('M0,0 C0,100 100,100 100,0', 0.5)
  assert.ok(Math.abs(mid.x - 50) < 0.01)
  assert.ok(Math.abs(mid.y - 75) < 0.5)
  assert.ok(flattenPath('M0,0 L10,0 Q20,0 20,10').length > 3)
})

// ---- colour -----------------------------------------------------------------------------------

test('parseCssColor reads hex, rgb, hsl and named colours, and rejects the rest', () => {
  assert.deepEqual(parseCssColor('#fff'), { r: 255, g: 255, b: 255, a: 1 })
  assert.deepEqual(parseCssColor('#11223344'), { r: 17, g: 34, b: 51, a: 68 / 255 })
  assert.deepEqual(parseCssColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 })
  assert.deepEqual(parseCssColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 })
  assert.deepEqual(parseCssColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0, a: 1 })
  assert.deepEqual(parseCssColor('Rebeccapurple'), { r: 102, g: 51, b: 153, a: 1 })
  assert.equal(parseCssColor('oklch(50% 0.1 20)'), null)
  assert.equal(parseCssColor('not a colour'), null)
})

test('the theme flip is its own inverse and leaves an unparseable colour alone', () => {
  const dark = flipRgbLightness({ r: 120, g: 100, b: 140 }, 'light')
  const back = flipRgbLightness(parseCssColor(dark), 'light')
  const original = parseCssColor(back)
  assert.ok(Math.abs(original.r - 120) <= 2 && Math.abs(original.g - 100) <= 2)
  assert.deepEqual(paintColor('oklch(50% 0.1 20)', 'light'), {
    color: 'oklch(50% 0.1 20)',
    opacity: 1
  })
})

test('opacity becomes a number, not a colour function', () => {
  assert.deepEqual(paintColor('#000000', 'dark', 40), { color: '#000000', opacity: 0.4 })
})

// ---- text -------------------------------------------------------------------------------------

test('wrapText breaks at spaces, keeps newlines and splits a word wider than the line', () => {
  const font = { size: 13, weight: 'normal' }
  assert.deepEqual(wrapText('one\ntwo', 1000, font), ['one', 'two'])
  const lines = wrapText(
    'alpha beta gamma delta epsilon',
    measureText('alpha beta', font) + 1,
    font
  )
  assert.ok(lines.length >= 3)
  assert.ok(lines.every((line) => measureText(line, font) <= measureText('alpha beta', font) + 1))
  const broken = wrapText('Supercalifragilisticexpialidocious', 60, font)
  assert.ok(broken.length > 1)
  assert.equal(broken.join(''), 'Supercalifragilisticexpialidocious')
  assert.deepEqual(wrapText('no wrapping at zero', 0, font), ['no wrapping at zero'])
})

test('bold text is estimated wider, and monospace is a fixed advance', () => {
  const normal = measureText('Hello', { size: 10, weight: 'normal' })
  assert.ok(measureText('Hello', { size: 10, weight: 'bold' }) > normal)
  assert.equal(
    measureText('iiii', { size: 10, weight: 'normal', family: 'monospace' }),
    measureText('WWWW', { size: 10, weight: 'normal', family: 'monospace' })
  )
})

// ---- the renderer -----------------------------------------------------------------------------

// A minimal well-formedness check: every opened element is closed in order.
function assertBalanced(svg) {
  const stack = []
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = match
    if (selfClosing) continue
    if (closing) assert.equal(stack.pop(), name, `unbalanced </${name}>`)
    else stack.push(name)
  }
  assert.deepEqual(stack, [])
}

test('an empty diagram is a valid, tiny image', () => {
  const svg = render(diagramOf([]))
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="48" height="48"/)
  assertBalanced(svg)
})

test('the same diagram always gives the same bytes', () => {
  const diagram = diagramOf(
    [entity('a', 0, 0), entity('b', 300, 0)],
    [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        sourceHandle: 'right',
        targetHandle: 'left',
        label: 'calls'
      }
    ]
  )
  assert.equal(render(diagram), render(structuredClone(diagram)))
})

test('labels are escaped and control characters dropped', () => {
  const svg = render(diagramOf([entity('a', 0, 0, { data: { label: 'A&B <x> "q"\u0001' } })]))
  assert.ok(svg.includes('A&amp;B &lt;x&gt; &quot;q&quot;'))
  assert.ok(!svg.includes('\u0001'))
  assertBalanced(svg)
})

test('an arrowhead is a plain shape turned along the line, with no <marker>', () => {
  const edges = [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' }]
  const svg = render(diagramOf([entity('a', 0, 0), entity('b', 300, 0)], edges), {
    paddingPx: 0
  })
  assert.ok(!svg.includes('context-stroke') && !svg.includes('<marker') && !svg.includes('marker-'))
  // The default end is a closed arrow, pointing right (0 degrees) into the left side of b.
  assert.match(svg, /class="chd-arrowhead" transform="translate\(300 30\) rotate\(0\)/)
  const upward = render(
    diagramOf(
      [entity('a', 0, 0), entity('b', 0, 300)],
      [{ id: 'e', source: 'b', target: 'a', sourceHandle: 'top', targetHandle: 'bottom' }]
    ),
    { paddingPx: 0 }
  )
  assert.match(upward, /class="chd-arrowhead" transform="translate\(60 60\) rotate\(-90\)/)
})

test('a start marker points back out of the line', () => {
  const svg = render(
    diagramOf(
      [entity('a', 0, 0), entity('b', 300, 0)],
      [
        {
          id: 'e',
          source: 'a',
          target: 'b',
          sourceHandle: 'right',
          targetHandle: 'left',
          style: { startMarker: 'diamond', endMarker: 'none' }
        }
      ]
    ),
    { paddingPx: 0 }
  )
  assert.match(svg, /class="chd-arrowhead" transform="translate\(120 30\) rotate\(180\)/)
  assert.equal(svg.split('chd-arrowhead').length - 1, 1)
})

test('an edge to a connection point the node does not have is not drawn, as on the canvas', () => {
  const svg = render(
    diagramOf(
      [entity('a', 0, 0), entity('b', 300, 0)],
      [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'nope', targetHandle: 'left' }]
    )
  )
  assert.ok(!svg.includes('chd-edge'))
})

test('an edge with no handle uses the first connection point, on top', () => {
  const svg = render(
    diagramOf([entity('a', 0, 0), entity('b', 300, 0)], [{ id: 'e', source: 'a', target: 'b' }]),
    { paddingPx: 0 }
  )
  assert.ok(svg.includes('M60,0'))
})

test('a container is dashed and a text node rotates about its centre', () => {
  const svg = render(
    diagramOf([
      {
        id: 'c',
        type: 'container',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        data: { label: 'Box' }
      },
      {
        id: 't',
        type: 'text',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 40 },
        rotation: 90,
        data: { label: 'note' }
      }
    ])
  )
  assert.match(svg, /class="chd-container"[^>]*>\s*<rect[^>]*stroke-dasharray/)
  assert.match(svg, /class="chd-text"[^>]*transform="rotate\(90 60 30\)"/)
})

test('a child is placed relative to its parent and paints above it', () => {
  const svg = render(
    diagramOf([
      entity('child', 20, 20, { parentId: 'parent' }),
      {
        id: 'parent',
        type: 'container',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 },
        data: { label: 'P' }
      }
    ]),
    { paddingPx: 0 }
  )
  assert.ok(svg.indexOf('data-id="parent"') < svg.indexOf('data-id="child"'))
  assert.match(svg, /data-id="child"[^>]*><rect x="120\.75" y="120\.75"/)
})

test('a single matching highlight overrides the border; two make chips', () => {
  const diagram = diagramOf(
    [
      entity('a', 0, 0, { metadata: { risk: { value: 'high' } } }),
      entity('b', 200, 0, { metadata: { risk: { value: 'high' }, tier: { value: 1 } } })
    ],
    [],
    {
      highlights: [
        { key: 'risk', value: 'high', color: '#ff0000' },
        { key: 'tier', value: 1, color: '#00ff00' }
      ]
    }
  )
  const off = render(diagram)
  assert.ok(!off.includes('#ff0000'))
  const on = render(diagram, { enabledHighlightIds: ['risk::"high"', 'tier::1'] })
  assert.match(on, /data-id="a"[^>]*><rect[^>]*stroke="#ff0000" stroke-width="3"/)
  assert.ok(on.includes('fill="#00ff00"'))
})

test('the legend adds a box and grows the image only when its corner is occupied', () => {
  const diagram = diagramOf([entity('a', 0, 0)], [], {
    legend: [{ id: 'l', kind: 'entity', label: 'Systems', color: '#336699' }]
  })
  const plain = render(diagram)
  const withLegend = render(diagram, {
    legend: { items: defaultLegendItems(diagram), corner: 'bottom-left' }
  })
  assert.ok(withLegend.includes('Systems'))
  assert.ok(!plain.includes('chd-legend'))
  assertBalanced(withLegend)
})

test('background: transparent has no background rectangle; an explicit colour fills it', () => {
  const diagram = diagramOf([entity('a', 0, 0)])
  assert.ok(!render(diagram, { background: 'transparent' }).includes('width="100%"'))
  assert.ok(render(diagram, { background: { color: '#123456' } }).includes('fill="#123456"'))
})

// Every diagram in the gallery and the examples renders to a balanced document with no NaN, and
// every id it references (clip paths) is defined.
function chdFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? chdFiles(join(dir, entry.name))
      : entry.name.endsWith('.chd')
        ? [join(dir, entry.name)]
        : []
  )
}

const examples = join(import.meta.dirname, '..', '..', '..', 'examples')
for (const file of chdFiles(examples)) {
  for (const theme of ['light', 'dark']) {
    test(`renders ${relative(examples, file)} (${theme})`, () => {
      const diagram = parseDiagram(readFileSync(file, 'utf-8'))
      const svg = render(diagram, {
        theme,
        legend: { items: defaultLegendItems(diagram), corner: 'bottom-left' }
      })
      assertBalanced(svg)
      assert.ok(!/NaN|undefined|Infinity/.test(svg))
      for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) {
        assert.ok(svg.includes(`id="${id}"`), `${id} is not defined`)
      }
      assert.equal(
        svg,
        render(parseDiagram(readFileSync(file, 'utf-8')), {
          theme,
          legend: { items: defaultLegendItems(diagram), corner: 'bottom-left' }
        })
      )
    })
  }
}
