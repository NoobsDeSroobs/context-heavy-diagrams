// The editing operations and the questions about a diagram (the proof of concept for building one
// step by step).
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../diagram/index.ts'
import { describeDiagram, layoutIssues, roomForLabel } from './inspect.ts'
import { applyOperations, OperationError } from './operations.ts'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}` }
const run = (diagram, ...ops) => applyOperations(diagram, ops, options)
const start = () => createEmptyDiagram()

// The result of a build is a valid file: serialised as the app does, it passes the validator.
function assertValid(diagram) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-edit-'))
  try {
    const file = join(dir, 'd.chd')
    const text = serializeDiagram(diagram)
    assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
    writeFileSync(file, text)
    const { errors } = validateFile(file)
    assert.deepEqual(errors, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('add_entity, add_container and add_text make elements with the editor defaults, and say what they made', () => {
  const { diagram, results } = run(
    start(),
    { op: 'add_entity', label: 'API', x: 10, y: 20 },
    { op: 'add_container', label: 'Billing', x: 200, y: 0 },
    { op: 'add_text', label: 'Note', x: 0, y: 300 }
  )
  assert.deepEqual(
    results.map((r) => [r.element.type, r.element.width, r.element.height]),
    [
      ['entity', 120, 80],
      ['container', 320, 180],
      ['text', 120, 48]
    ]
  )
  assert.deepEqual(results[0].element.handles, ['top', 'right', 'bottom', 'left'])
  assert.deepEqual(results[2].element.handles, [], 'text has no connection points')
  assert.equal(diagram.nodes.length, 3)
  assertValid(diagram)
})

test('a child is given in absolute coordinates and stored relative to its container', () => {
  const { diagram, results } = run(
    start(),
    { op: 'add_container', id: 'box', label: 'Box', x: 100, y: 50 },
    { op: 'add_entity', id: 'in', label: 'In', x: 130, y: 90, parent: 'box' }
  )
  assert.deepEqual(diagram.nodes[1].position, { x: 30, y: 40 })
  assert.equal(diagram.nodes[1].parentId, 'box')
  assert.equal(results[1].element.x, 130, 'the answer is absolute again')
  assert.equal(results[1].element.parent, 'box')
  assertValid(diagram)
})

test('connect picks the facing sides, checks handles and writes a labelled edge', () => {
  const base = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', id: 'b', label: 'B', x: 300, y: 0 },
    { op: 'add_entity', id: 'c', label: 'C', x: 0, y: 300 }
  ).diagram
  const { diagram, results } = run(
    base,
    { op: 'connect', from: 'a', to: 'b', label: 'requests', style: { lineStyle: 'dashed' } },
    { op: 'connect', from: 'a', to: 'c' }
  )
  assert.deepEqual([results[0].element.fromHandle, results[0].element.toHandle], ['right', 'left'])
  assert.deepEqual([results[1].element.fromHandle, results[1].element.toHandle], ['bottom', 'top'])
  assert.equal(diagram.edges[0].type, 'labeled')
  assert.equal(diagram.edges[0].style.lineStyle, 'dashed')
  assert.throws(
    () => run(base, { op: 'connect', from: 'a', to: 'b', fromHandle: 'cp-9' }),
    (error) =>
      error instanceof OperationError && /cp-9.*top, right, bottom, left/.test(error.message)
  )
  assert.throws(() => run(base, { op: 'connect', from: 'a', to: 'a' }), /two different/)
  assertValid(diagram)
})

test('a text or a line cannot be connected', () => {
  const base = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_text', id: 't', label: 'T', x: 200, y: 0 }
  ).diagram
  assert.throws(
    () => run(base, { op: 'connect', from: 'a', to: 't' }),
    /text, which edges cannot join/
  )
})

test('add_connection_point keeps the side name valid for edges that already use it', () => {
  const base = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', id: 'b', label: 'B', x: 300, y: 0 },
    { op: 'connect', from: 'a', to: 'b' }
  ).diagram
  const { diagram, results } = run(base, {
    op: 'add_connection_point',
    id: 'a',
    side: 'right',
    offset: 0.2
  })
  assert.equal(results[0].pointId, 'cp-1')
  assert.deepEqual(
    results[0].element.handles.filter((h) => h === 'right' || h === 'cp-1'),
    ['right', 'cp-1']
  )
  assertValid(diagram)
  const moved = run(diagram, { op: 'connect', from: 'a', to: 'b', fromHandle: 'cp-1' })
  assert.equal(moved.results[0].element.fromHandle, 'cp-1')
})

test('move and reparent keep the absolute place, and a parent stays before its children', () => {
  const base = run(
    start(),
    { op: 'add_entity', id: 'e', label: 'E', x: 120, y: 120 },
    { op: 'add_container', id: 'c', label: 'C', x: 100, y: 100 }
  ).diagram
  const { diagram, results } = run(base, { op: 'reparent', id: 'e', parent: 'c' })
  assert.deepEqual(
    diagram.nodes.map((n) => n.id),
    ['c', 'e'],
    'the container now comes first'
  )
  assert.equal(results[0].element.x, 120, 'it did not jump')
  assert.deepEqual(diagram.nodes[1].position, { x: 20, y: 20 })
  const moved = run(diagram, { op: 'move', id: 'e', x: 150, y: 140 })
  assert.deepEqual(moved.diagram.nodes[1].position, { x: 50, y: 40 })
  const out = run(moved.diagram, { op: 'reparent', id: 'e', parent: null })
  assert.equal(out.diagram.nodes[1].parentId, undefined)
  assert.deepEqual(out.diagram.nodes[1].position, { x: 150, y: 140 })
  assert.throws(() => run(base, { op: 'reparent', id: 'c', parent: 'c' }), /inside itself/)
  assertValid(diagram)
})

test('remove drops the edges with an element and lifts what was inside a container', () => {
  const base = run(
    start(),
    { op: 'add_container', id: 'c', label: 'C', x: 100, y: 100 },
    { op: 'add_entity', id: 'in', label: 'In', x: 130, y: 130, parent: 'c' },
    { op: 'add_entity', id: 'out', label: 'Out', x: 600, y: 130 },
    { op: 'connect', id: 'e1', from: 'in', to: 'out' }
  ).diagram
  const { diagram, results } = run(base, { op: 'remove', id: 'c' })
  assert.deepEqual(results[0].removed, ['c'])
  const inside = diagram.nodes.find((n) => n.id === 'in')
  assert.equal(inside.parentId, undefined)
  assert.deepEqual(inside.position, { x: 130, y: 130 })
  const gone = run(base, { op: 'remove', id: 'out' })
  assert.deepEqual(gone.results[0].removed, ['out', 'e1'])
  assert.equal(gone.diagram.edges.length, 0)
  assertValid(diagram)
})

test('set_label and set_style change nodes and edges, check the fields and null removes one', () => {
  const base = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0, style: { fill: '#112233' } },
    { op: 'add_entity', id: 'b', label: 'B', x: 300, y: 0 },
    { op: 'connect', id: 'e', from: 'a', to: 'b' }
  ).diagram
  const { diagram } = run(
    base,
    { op: 'set_label', id: 'a', label: 'Alpha' },
    { op: 'set_label', id: 'e', label: 'reads' },
    { op: 'set_style', id: 'a', style: { stroke: '#abcdef', fill: null } },
    { op: 'set_style', id: 'e', style: { endMarker: 'diamond', animation: 'flow' } }
  )
  assert.equal(diagram.nodes[0].data.label, 'Alpha')
  assert.equal(diagram.edges[0].label, 'reads')
  assert.deepEqual(diagram.nodes[0].style, { stroke: '#abcdef' })
  assert.equal(diagram.edges[0].style.endMarker, 'diamond')
  assert.throws(
    () => run(base, { op: 'set_style', id: 'a', style: { animation: 'flow' } }),
    /not a style field/
  )
  assert.throws(
    () => run(base, { op: 'set_style', id: 'e', style: { endMarker: 'star' } }),
    /one of none/
  )
  assert.throws(
    () => run(base, { op: 'set_style', id: 'a', style: { fillOpacity: 200 } }),
    /at most 100/
  )
  assertValid(diagram)
})

test('add_line stores the points relative to the line and its bounding box', () => {
  const { diagram, results } = run(start(), {
    op: 'add_line',
    points: [
      { x: 100, y: 200 },
      { x: 160, y: 150, gravity: 0 },
      { x: 220, y: 200 }
    ]
  })
  assert.deepEqual(diagram.nodes[0].position, { x: 100, y: 150 })
  assert.deepEqual(diagram.nodes[0].data.points[0], { x: 0, y: 50 })
  assert.equal(results[0].element.x, 100)
  assert.throws(() => run(start(), { op: 'add_line', points: [{ x: 0, y: 0 }] }), /at least two/)
  assertValid(diagram)
})

test('set_edge_points replaces, clears and explains when the routing would ignore the points', () => {
  const { diagram, results } = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', id: 'b', label: 'B', x: 400, y: 300 },
    { op: 'connect', id: 'e', from: 'a', to: 'b' },
    {
      op: 'set_edge_points',
      id: 'e',
      points: [
        { x: 300, y: 40.12345 },
        { x: 300, y: 340, gravity: 0 }
      ]
    }
  )
  const edge = diagram.edges[0]
  assert.deepEqual(edge.points, [
    { x: 300, y: 40.123 },
    { x: 300, y: 340, gravity: 0 }
  ])
  assert.match(results[3].notices[0], /ignored while the edge is routed as a plain curve/)
  assert.equal(results[3].element.points.length, 2)

  const routed = run(diagram, {
    op: 'set_edge_points',
    id: 'e',
    routing: 'smoothstep',
    points: [{ x: 300, y: 40 }]
  })
  assert.equal(routed.diagram.edges[0].style.routingStyle, 'smoothstep')
  assert.equal(routed.results[0].notices, undefined)
  assert.equal(routed.results[0].element.routing, 'smoothstep')
  assertValid(routed.diagram)

  const cleared = run(routed.diagram, { op: 'set_edge_points', id: 'e', points: [] })
  assert.equal('points' in cleared.diagram.edges[0], false)
  assert.equal('points' in cleared.results[0].element, false)
  assert.equal(describeDiagram(routed.diagram).edges[0].points.length, 1)

  assert.throws(() => run(diagram, { op: 'set_edge_points', id: 'a', points: [] }), /not an edge/)
  assert.throws(
    () => run(diagram, { op: 'set_edge_points', id: 'e', points: [{ x: 1 }] }),
    /numeric x and y/
  )
  assert.throws(() => run(diagram, { op: 'set_edge_points', id: 'e', points: 5 }), /must be a list/)
  assert.throws(
    () => run(diagram, { op: 'set_edge_points', id: 'e', points: [], routing: 'zigzag' }),
    /"routing" must be one of/
  )
})

test('a batch is all or nothing and the error names the operation', () => {
  const base = run(start(), { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 }).diagram
  const before = JSON.stringify(base)
  assert.throws(
    () =>
      run(
        base,
        { op: 'add_entity', id: 'b', label: 'B', x: 5, y: 5 },
        { op: 'move', id: 'nope', x: 1, y: 1 }
      ),
    (error) =>
      error instanceof OperationError &&
      error.index === 1 &&
      /operation 2: "nope"/.test(error.message)
  )
  assert.equal(JSON.stringify(base), before, 'the diagram it was given is untouched')
  assert.throws(() => run(base, { op: 'add_entity', id: 'a', x: 1, y: 1 }), /already an id/)
  assert.throws(() => run(base, { op: 'dance' }), /unknown op "dance"/)
  assert.throws(() => run(base, { op: 'add_entity', label: 'X' }), /"x" must be a number/)
})

test('describeDiagram lists elements in absolute coordinates', () => {
  const { diagram } = run(
    start(),
    { op: 'add_container', id: 'c', label: 'C', x: 100, y: 100 },
    { op: 'add_entity', id: 'e', label: 'E', x: 140, y: 150, parent: 'c' }
  )
  const { nodes } = describeDiagram(diagram)
  assert.deepEqual(
    nodes.map((n) => [n.id, n.x, n.y, n.parent]),
    [
      ['c', 100, 100, null],
      ['e', 140, 150, 'c']
    ]
  )
})

test('roomForLabel gives the minimum and the target, by direction and end graphics', () => {
  const horizontal = roomForLabel({ label: 'reads from', direction: 'horizontal' })
  assert.deepEqual([horizontal.minimum, horizontal.target], [98, 114])
  const vertical = roomForLabel({ label: 'reads from', direction: 'vertical' })
  assert.ok(vertical.minimum < horizontal.minimum)
  const plain = roomForLabel({ label: 'reads from', direction: 'horizontal', endMarker: 'none' })
  assert.ok(plain.minimum < horizontal.minimum, 'no arrowhead needs less')
  const bold = roomForLabel({ label: 'reads from', direction: 'horizontal', bold: true })
  assert.ok(bold.minimum > horizontal.minimum)
})

test('layoutIssues finds a label without room, an overlap, an element sticking out and an edge over an element', () => {
  const { diagram } = run(
    start(),
    { op: 'add_container', id: 'c', label: 'C', x: 0, y: 400, width: 200, height: 100 },
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', id: 'dup', label: 'Dup', x: 60, y: 30 },
    { op: 'add_entity', id: 'b', label: 'B', x: 150, y: 0 },
    { op: 'add_entity', id: 'mid', label: 'Mid', x: 400, y: 0 },
    { op: 'add_entity', id: 'far', label: 'Far', x: 700, y: 0 },
    { op: 'add_entity', id: 'out', label: 'Out', x: 150, y: 450, parent: 'c' },
    { op: 'connect', id: 'near', from: 'a', to: 'b', label: 'reads from' },
    { op: 'connect', id: 'over', from: 'b', to: 'far', fromHandle: 'right', toHandle: 'left' }
  )
  const kinds = layoutIssues(diagram).map((issue) => issue.kind)
  assert.ok(kinds.includes('label-room'))
  assert.ok(kinds.includes('overlap'))
  assert.ok(kinds.includes('outside-container'))
  assert.ok(kinds.includes('edge-through-element'))
  const clean = run(
    start(),
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', id: 'b', label: 'B', x: 320, y: 0 },
    { op: 'connect', from: 'a', to: 'b', label: 'reads from' }
  ).diagram
  assert.deepEqual(layoutIssues(clean), [])
})
