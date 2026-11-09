// Run with `npm test`. The draw.io export (ADR 0167): a diagram turned into mxGraph XML, what each
// part of it becomes, what is reported as lost, and every diagram in the examples.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseDiagram } from '../diagram/index.ts'
import { DEFAULT_DRAWIO_EXPORT_OPTIONS, renderDiagramDrawio } from './drawio.ts'
import { collectIconRefs, iconKey } from './renderDiagram.ts'
import { highlightId } from '../tagging/highlights.ts'

const render = (diagram, extra = {}) =>
  renderDiagramDrawio(diagram, { ...DEFAULT_DRAWIO_EXPORT_OPTIONS, icons: new Map(), ...extra })

const diagramOf = (nodes, edges = [], extra = {}) => ({ version: 1, nodes, edges, ...extra })
const entity = (id, x, y, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  size: { width: 120, height: 60 },
  data: { label: id },
  ...extra
})
const edgeOf = (id, source, target, extra = {}) => ({ id, source, target, ...extra })

const unescapeXml = (text) =>
  text
    .replace(/&#xa;/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')

// The cells of an export, by id: an <object> wrapper carries the id and the tags, the <mxCell>
// inside it the geometry and style.
function cellsOf(xml) {
  const out = new Map()
  let pendingObject = null
  for (const match of xml.matchAll(/<(object|mxCell)\b([^>]*?)(\/?)>/g)) {
    const attrs = {}
    for (const [, name, value] of match[2].matchAll(/([\w.-]+)="([^"]*)"/g)) {
      attrs[name] = unescapeXml(value)
    }
    if (match[1] === 'object') {
      pendingObject = attrs
      continue
    }
    const merged = pendingObject ? { ...attrs, ...pendingObject, style: attrs.style } : attrs
    pendingObject = null
    out.set(merged.id, merged)
  }
  return out
}

const styleOf = (cell) =>
  Object.fromEntries(
    cell.style
      .split(';')
      .filter(Boolean)
      .map((pair) => (pair.includes('=') ? pair.split(/=(.*)/s).slice(0, 2) : [pair, true]))
  )

function assertBalanced(xml) {
  const stack = []
  for (const match of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = match
    if (selfClosing) continue
    if (closing) assert.equal(stack.pop(), name, `unbalanced </${name}>`)
    else stack.push(name)
  }
  assert.deepEqual(stack, [])
}

// ---- the file ---------------------------------------------------------------------------------

test('an empty diagram is a valid file with the two root cells', () => {
  const { xml, notes } = render(diagramOf([]))
  assertBalanced(xml)
  assert.match(xml, /^<mxfile host="Context-Heavy Diagrams">/)
  assert.deepEqual([...cellsOf(xml).keys()], ['0', '1'])
  assert.deepEqual(notes, [])
})

test('the dark theme sets the page background, the light theme leaves it', () => {
  assert.ok(
    render(diagramOf([entity('a', 0, 0)]), { theme: 'dark' }).xml.includes('background="#1b1b1f"')
  )
  assert.ok(!render(diagramOf([entity('a', 0, 0)])).xml.includes('background='))
})

test('an id of 0 or 1, or one used twice, gets a distinct cell id', () => {
  const diagram = diagramOf([entity('0', 0, 0), entity('1', 200, 0)], [edgeOf('1', '0', '1')])
  const cells = cellsOf(render(diagram).xml)
  assert.equal(cells.size, 5)
  const edge = [...cells.values()].find((c) => c.edge)
  assert.ok(cells.has(edge.source) && cells.has(edge.target))
  assert.notEqual(edge.id, '1')
})

// ---- nodes ------------------------------------------------------------------------------------

test('an entity becomes a rounded, wrapping vertex with its colours and font', () => {
  const diagram = diagramOf([
    entity('a', 10, 20, {
      data: { label: 'Orders & <Items>\nsecond line' },
      style: {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3,
        fontSize: 18,
        fontWeight: 'bold'
      }
    })
  ])
  const cell = cellsOf(render(diagram, { theme: 'dark' }).xml).get('a')
  const style = styleOf(cell)
  assert.equal(cell.vertex, '1')
  assert.equal(cell.parent, '1')
  assert.equal(cell.value, 'Orders &amp; &lt;Items&gt;<br>second line')
  assert.equal(style.rounded, '1')
  assert.equal(style.whiteSpace, 'wrap')
  assert.equal(style.strokeWidth, '3')
  assert.equal(style.fontSize, '18')
  assert.equal(style.fontStyle, '1')
  assert.match(style.fillColor, /^#[0-9a-f]{6}$/)
  assert.match(cell.style, /^[^]*;$/)
})

test('a node with no fill or border is drawn with none', () => {
  const diagram = diagramOf([
    entity('a', 0, 0, { style: { fill: '#336699', fillOpacity: 0, strokeWidth: 0 } })
  ])
  const style = styleOf(cellsOf(render(diagram).xml).get('a'))
  assert.equal(style.fillColor, 'none')
  assert.equal(style.strokeColor, 'none')
})

test('a partly transparent fill keeps its opacity', () => {
  const diagram = diagramOf([entity('a', 0, 0, { style: { fill: '#336699', fillOpacity: 40 } })])
  assert.equal(styleOf(cellsOf(render(diagram).xml).get('a')).fillOpacity, '40')
})

test('children sit inside their container at positions relative to it', () => {
  const diagram = diagramOf([
    entity('box', 100, 50, { type: 'container', size: { width: 400, height: 300 } }),
    entity('in', 20, 30, { parentId: 'box' })
  ])
  const cells = cellsOf(render(diagram).xml)
  const box = cells.get('box')
  const child = cells.get('in')
  assert.equal(styleOf(box).container, '1')
  assert.equal(styleOf(box).dashed, '1')
  assert.equal(styleOf(box).verticalAlign, 'top')
  assert.equal(child.parent, 'box')
  assert.match(
    render(diagram).xml,
    /<mxCell id="in"[^>]*><mxGeometry x="20" y="30" width="120" height="60" as="geometry"\/>/
  )
})

test('a node whose container is missing, or part of a cycle, is placed on the page', () => {
  const diagram = diagramOf([
    entity('orphan', 5, 6, { parentId: 'gone' }),
    entity('a', 0, 0, { parentId: 'b' }),
    entity('b', 40, 0, { parentId: 'a' })
  ])
  const { xml } = render(diagram)
  const cells = cellsOf(xml)
  for (const id of ['orphan', 'a', 'b']) assert.equal(cells.get(id).parent, '1', id)
  assert.match(xml, /<mxCell id="orphan"[^>]*><mxGeometry x="5" y="6"/)
})

test('a rotated text node keeps its rotation', () => {
  const diagram = diagramOf([
    entity('t', 0, 0, { type: 'text', rotation: 30, data: { label: 'tilted' } })
  ])
  const cell = cellsOf(render(diagram).xml).get('t')
  assert.ok(cell.style.startsWith('text;'))
  assert.equal(styleOf(cell).rotation, '30')
  assert.equal(styleOf(cell).rounded, '0')
})

test('tags become attributes of an object, with a name draw.io can read', () => {
  const diagram = diagramOf([
    entity('a', 0, 0, {
      metadata: {
        owner: { value: 'platform team' },
        'data class': { value: 'PII', lock: 'lockedEditable' },
        label: { value: 7 },
        list: { value: ['a', 'b'] }
      }
    })
  ])
  const { xml, notes } = render(diagram)
  const cell = cellsOf(xml).get('a')
  assert.equal(cell.owner, 'platform team')
  assert.equal(cell.data_class, 'PII')
  assert.equal(cell.tag_label, '7')
  assert.equal(cell.list, '["a","b"]')
  assert.equal(cell.label, 'a')
  assert.ok(notes.some((n) => n.includes('1 locked tag exported as plain data')))
})

test('an icon is an image cell inside the node, in the slot it has', () => {
  const diagram = diagramOf([
    entity('a', 0, 0, {
      data: { label: 'a', icons: { topRight: { source: 'builtin', id: 'cloud' } } }
    })
  ])
  const icons = new Map([
    [
      iconKey({ source: 'builtin', id: 'cloud' }),
      {
        kind: 'svg',
        markup: '<svg viewBox="0 0 24 24"><path d="M0 0" stroke="currentColor"/></svg>'
      }
    ]
  ])
  const { xml } = render(diagram, { icons })
  const icon = cellsOf(xml).get('a-icon-topRight')
  assert.equal(icon.parent, 'a')
  assert.match(icon.style, /^shape=image;aspect=fixed;image=data:image\/svg\+xml,[A-Za-z0-9+/=]+;$/)
  assert.ok(!icon.style.includes(';base64'))
  const svg = Buffer.from(icon.style.split(',')[1].replace(/;$/, ''), 'base64').toString()
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'))
  assert.ok(!svg.includes('currentColor'))
  // 120 wide, 2 inside the border (1.5) and 18 wide
  assert.match(
    xml,
    /id="a-icon-topRight"[^>]*><mxGeometry x="98\.5" y="3\.5" width="18" height="18"/
  )
})

test('a custom icon is passed on as a data URL without its ;base64', () => {
  const ref = { source: 'custom', path: 'assets/x.png' }
  const diagram = diagramOf([entity('a', 0, 0, { data: { label: 'a', icons: { topLeft: ref } } })])
  const icons = new Map([[iconKey(ref), { kind: 'image', dataUrl: 'data:image/png;base64,QUJD' }]])
  const icon = cellsOf(render(diagram, { icons }).xml).get('a-icon-topLeft')
  assert.equal(styleOf(icon).image, 'data:image/png,QUJD')
})

test('a line node becomes a free edge through its points', () => {
  const diagram = diagramOf([
    {
      id: 'ln',
      type: 'line',
      position: { x: 100, y: 100 },
      data: {
        label: '',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 20 },
          { x: 100, y: 0 }
        ]
      },
      style: { stroke: '#ff0000', endMarker: 'arrowClosed' }
    },
    {
      id: 'short',
      type: 'line',
      position: { x: 0, y: 0 },
      data: { label: '', points: [{ x: 0, y: 0 }] }
    }
  ])
  const { xml, notes } = render(diagram)
  const cells = cellsOf(xml)
  assert.equal(cells.get('ln').edge, '1')
  assert.ok(!cells.has('short'))
  assert.match(xml, /<mxPoint x="100" y="100" as="sourcePoint"\/>/)
  assert.match(xml, /<mxPoint x="200" y="100" as="targetPoint"\/>/)
  assert.match(xml, /<Array as="points"><mxPoint x="150" y="120"\/><\/Array>/)
  assert.equal(styleOf(cells.get('ln')).endArrow, 'block')
  assert.ok(notes.some((n) => n.includes('1 line was left out')))
})

// ---- edges ------------------------------------------------------------------------------------

test('an edge names its ends, keeps its attachment points and puts its label along the line', () => {
  const diagram = diagramOf(
    [entity('a', 0, 0), entity('b', 300, 0)],
    [
      edgeOf('e', 'a', 'b', {
        label: 'calls',
        sourceHandle: 'right',
        targetHandle: 'left',
        style: { labelPosition: 0.25 }
      })
    ]
  )
  const cell = cellsOf(render(diagram).xml).get('e')
  const style = styleOf(cell)
  assert.equal(cell.edge, '1')
  assert.equal(cell.source, 'a')
  assert.equal(cell.target, 'b')
  assert.equal(cell.value, 'calls')
  assert.equal(style.exitX, '1')
  assert.equal(style.exitY, '0.5')
  assert.equal(style.entryX, '0')
  assert.equal(style.entryY, '0.5')
  assert.equal(style.exitPerimeter, '0')
  assert.match(render(diagram).xml, /<mxGeometry x="-0\.5" relative="1"/)
})

test('an extra connection point is kept as an exact attachment on the edge', () => {
  const diagram = diagramOf(
    [
      entity('a', 0, 0, { connectionPoints: [{ id: 'cp1', side: 'bottom', offset: 0.25 }] }),
      entity('b', 0, 200)
    ],
    [edgeOf('e', 'a', 'b', { sourceHandle: 'cp1', targetHandle: 'top' })]
  )
  const { xml, notes } = render(diagram)
  const style = styleOf(cellsOf(xml).get('e'))
  assert.equal(style.exitX, '0.25')
  assert.equal(style.exitY, '1')
  assert.ok(notes.some((n) => n.startsWith('1 element has extra connection points')))
})

test('routing styles map to draw.io edge styles', () => {
  const route = (routingStyle) => {
    const diagram = diagramOf(
      [entity('a', 0, 0), entity('b', 300, 100)],
      [edgeOf('e', 'a', 'b', { style: routingStyle ? { routingStyle } : undefined })]
    )
    return styleOf(cellsOf(render(diagram).xml).get('e'))
  }
  assert.equal(route('straight').edgeStyle, undefined)
  assert.equal(route('step').edgeStyle, 'orthogonalEdgeStyle')
  assert.equal(route('step').rounded, '0')
  assert.equal(route('smoothstep').rounded, '1')
  assert.equal(route('catmullRom').curved, '1')
  assert.equal(route(undefined).curved, '1')
})

test('bend points become waypoints', () => {
  const diagram = diagramOf(
    [entity('a', 0, 0), entity('b', 300, 100)],
    [
      edgeOf('e', 'a', 'b', {
        points: [
          { x: 150, y: -40 },
          { x: 250, y: 60.5 }
        ]
      })
    ]
  )
  assert.match(
    render(diagram).xml,
    /<Array as="points"><mxPoint x="150" y="-40"\/><mxPoint x="250" y="60\.5"\/><\/Array>/
  )
})

test('markers, dashes and animation map to their draw.io keys', () => {
  const diagram = diagramOf(
    [entity('a', 0, 0), entity('b', 300, 0)],
    [
      edgeOf('e', 'a', 'b', {
        style: {
          startMarker: 'crowsFootOneOrMany',
          endMarker: 'diamondFilled',
          lineStyle: 'dashed',
          animation: 'flow'
        }
      }),
      edgeOf('p', 'a', 'b', { style: { endMarker: 'none', animation: 'pulse' } })
    ]
  )
  const { xml, notes } = render(diagram)
  const cells = cellsOf(xml)
  const style = styleOf(cells.get('e'))
  assert.equal(style.startArrow, 'ERoneToMany')
  assert.equal(style.endArrow, 'diamond')
  assert.equal(style.endFill, '1')
  assert.equal(style.dashed, '1')
  assert.equal(style.fixDash, '1')
  assert.equal(style.dashPattern, '8 6')
  assert.equal(style.flowAnimation, '1')
  assert.equal(styleOf(cells.get('p')).endArrow, 'none')
  assert.equal(styleOf(cells.get('p')).flowAnimation, undefined)
  assert.ok(notes.some((n) => n.includes('1 connection has a pulse animation')))
})

test('the oriented edges of the active direction set are exported', () => {
  const diagram = diagramOf(
    [entity('a', 0, 0), entity('b', 300, 0)],
    [
      edgeOf('e', 'a', 'b', {
        directionSets: { two: { source: 'b', target: 'a' } }
      })
    ],
    {
      edgeDirectionSets: [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' }
      ],
      activeEdgeDirectionSetId: 'two'
    }
  )
  const cell = cellsOf(render(diagram).xml).get('e')
  assert.equal(cell.source, 'b')
  assert.equal(cell.target, 'a')
})

test('an edge to a missing node is left out and reported', () => {
  const diagram = diagramOf([entity('a', 0, 0)], [edgeOf('e', 'a', 'gone')])
  const { xml, notes } = render(diagram)
  assert.ok(!cellsOf(xml).has('e'))
  assert.ok(notes.some((n) => n.startsWith('1 connection was left out')))
})

// ---- highlights -------------------------------------------------------------------------------

test('a single matching highlight recolours the border, only when it is switched on', () => {
  const diagram = diagramOf([entity('a', 0, 0, { metadata: { team: { value: 'red' } } })], [], {
    highlights: [{ key: 'team', value: 'red', color: '#ff0000' }]
  })
  assert.notEqual(styleOf(cellsOf(render(diagram).xml).get('a')).strokeColor, '#ff0000')
  const on = render(diagram, {
    enabledHighlightIds: [highlightId({ key: 'team', value: 'red' })]
  }).xml
  assert.equal(styleOf(cellsOf(on).get('a')).strokeColor, '#ff0000')
  assert.equal(styleOf(cellsOf(on).get('a')).strokeWidth, '3')
})

// ---- what is reported -------------------------------------------------------------------------

test('what draw.io cannot hold is listed, once per kind', () => {
  const diagram = diagramOf(
    [
      entity('a', 0, 0, {
        data: { label: 'a', notes: 'a.md', linkedDiagram: 'other.chd', references: ['r.png'] }
      }),
      entity('b', 300, 0)
    ],
    [edgeOf('e', 'a', 'b')],
    { legend: [{ id: 'l', label: 'x', kind: 'color', color: '#fff' }], security: { threats: [] } }
  )
  const { notes } = render(diagram)
  for (const part of [
    "drawn with draw.io's own routing",
    '1 note not exported',
    '1 link to another diagram not exported',
    'reference images on 1 element not exported',
    'the legend is not exported',
    'the threat matrix is not exported'
  ]) {
    assert.ok(
      notes.some((n) => n.includes(part)),
      `missing: ${part}\n${notes.join('\n')}`
    )
  }
})

// ---- the examples -----------------------------------------------------------------------------

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
    test(`exports ${relative(examples, file)} (${theme})`, () => {
      const diagram = parseDiagram(readFileSync(file, 'utf-8'))
      const icons = new Map()
      for (const icon of collectIconRefs(diagram, [])) {
        icons.set(iconKey(icon), {
          kind: 'svg',
          markup: '<svg viewBox="0 0 24 24"><path d="M0 0h24" stroke="currentColor"/></svg>'
        })
      }
      const { xml, notes } = render(diagram, { theme, icons })
      assertBalanced(xml)
      assert.ok(!/NaN|undefined|Infinity/.test(xml))
      assert.ok(notes.every((n) => typeof n === 'string' && n !== ''))
      const cells = cellsOf(xml)
      for (const cell of cells.values()) {
        if (cell.id !== '0') assert.ok(cells.has(cell.parent), `${cell.id}: parent ${cell.parent}`)
        for (const ref of [cell.source, cell.target]) {
          if (ref !== undefined) assert.ok(cells.has(ref), `${cell.id}: ends at missing ${ref}`)
        }
        if (cell.style) {
          assert.ok(!cell.style.includes(';;'), `${cell.id}: empty style entry`)
          assert.ok(!cell.style.includes(';base64'), `${cell.id}: ;base64 in a style`)
        }
      }
      // Every vertex a container holds comes after it, as the file is read in order.
      const order = [...cells.keys()]
      for (const cell of cells.values()) {
        if (cell.parent !== '0' && cell.parent !== '1') {
          assert.ok(
            order.indexOf(cell.parent) < order.indexOf(cell.id),
            `${cell.id} before its parent`
          )
        }
      }
      assert.equal(xml, render(parseDiagram(readFileSync(file, 'utf-8')), { theme, icons }).xml)
    })
  }
}
