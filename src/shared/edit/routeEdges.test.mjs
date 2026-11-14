// route_edges: a right-angled route round the elements an edge does not join (ADR 0174).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../diagram/index.ts'
import { layoutEdges, layoutNodes } from '../export/model.ts'
import { buildEdgePath } from '../geometry/edgePath.ts'
import { flattenPath } from '../geometry/pathSampling.ts'
import { segmentHits } from './edgeRouting.ts'
import { layoutIssues } from './inspect.ts'
import { applyOperations } from './operations.ts'

const run = (diagram, ...ops) => applyOperations(diagram, ops, { newId: (p) => p })
const build = (...ops) => run(createEmptyDiagram(), ...ops).diagram
const entity = (id, x, y, extra = {}) => ({ op: 'add_entity', id, label: id, x, y, ...extra })
const across = { fromHandle: 'right', toHandle: 'left' }
const kinds = (diagram, kind) => layoutIssues(diagram).filter((i) => i.kind === kind)
const edgeOf = (diagram, id) => diagram.edges.find((e) => e.id === id)

// a and b with a wall between them, so the straight way is blocked.
const walled = () =>
  build(
    entity('a', 0, 100),
    entity('b', 500, 100),
    entity('wall', 240, 0, { width: 20, height: 300 }),
    { op: 'connect', id: 'e', from: 'a', to: 'b', ...across }
  )

test('an edge drawn across an element is routed round it, with right angles', () => {
  const before = walled()
  assert.equal(kinds(before, 'edge-through-element').length, 1)
  const { diagram, results } = run(before, { op: 'route_edges' })
  assert.deepEqual(results[0].routed, ['e'])
  assert.deepEqual(kinds(diagram, 'edge-through-element'), [])
  const edge = edgeOf(diagram, 'e')
  assert.equal(edge.style.routingStyle, 'step')
  assert.ok(edge.points.length >= 2)
  // The source and target stay joined as they were.
  assert.deepEqual([edge.source, edge.target, edge.sourceHandle], ['a', 'b', 'right'])
})

test('only the edges named are routed when ids are given', () => {
  const two = run(walled(), entity('c', 0, 400), entity('d', 500, 400), {
    op: 'connect',
    id: 'e2',
    from: 'c',
    to: 'd',
    ...across
  }).diagram
  const { diagram, results } = run(two, { op: 'route_edges', ids: ['e2'] })
  assert.deepEqual(results[0].routed, ['e2'])
  assert.equal(edgeOf(diagram, 'e').points, undefined)
})

test('an edge that is already clear is left as it is', () => {
  const clear = build(entity('a', 0, 0), entity('b', 300, 0), {
    op: 'connect',
    id: 'e',
    from: 'a',
    to: 'b',
    ...across
  })
  const { diagram, results } = run(clear, { op: 'route_edges', ids: ['e'] })
  assert.deepEqual(results[0].routed, ['e'])
  assert.equal(edgeOf(diagram, 'e').points, undefined)
  assert.deepEqual(run(clear, { op: 'route_edges' }).results[0].routed, [])
})

test('an edge to a container, an unknown id and an edge to itself are not routed', () => {
  const diagram = build(
    entity('a', 0, 0),
    { op: 'add_container', id: 'zone', label: 'Zone', x: 400, y: 0, width: 300, height: 200 },
    { op: 'connect', id: 'toZone', from: 'a', to: 'zone', ...across }
  )
  const { results } = run(diagram, { op: 'route_edges', ids: ['toZone'] })
  assert.deepEqual(results[0].routed, [])
  assert.match(results[0].notices[0], /toZone was not routed: joins a container/)
  assert.throws(() => run(diagram, { op: 'route_edges', ids: ['nope'] }), /not an edge/)
  assert.throws(() => run(diagram, { op: 'route_edges', ids: 'e' }), /list of edge ids/)
})

test("a route never runs through the edge's own elements", () => {
  // The target lies behind the source: the plain right-angled way would cross the source box.
  const diagram = build(entity('a', 300, 0), entity('b', 0, 0), {
    op: 'connect',
    id: 'e',
    from: 'a',
    to: 'b',
    fromHandle: 'right',
    toHandle: 'left'
  })
  const routed = run(diagram, { op: 'route_edges', ids: ['e'] }).diagram
  const nodes = layoutNodes(routed)
  const [laid] = layoutEdges(routed.edges, nodes)
  const path = flattenPath(
    buildEdgePath('step', laid.from, laid.to, routed.edges[0].points ?? [], 12)
  )
  for (const id of ['a', 'b']) {
    const n = nodes.get(id)
    const room = { x: n.x + 2, y: n.y + 2, width: n.width - 4, height: n.height - 4 }
    for (let k = 1; k < path.length; k += 1) {
      assert.equal(segmentHits(path[k - 1], path[k], room), false, `runs through ${id}`)
    }
  }
})

test('edges sharing one gap get lanes of their own', () => {
  const diagram = build(
    entity('a', 0, 0),
    entity('b', 500, 0),
    entity('c', 0, 120),
    entity('d', 500, 120),
    entity('wall', 240, -60, { width: 20, height: 360 }),
    { op: 'connect', id: 'e1', from: 'a', to: 'b', ...across },
    { op: 'connect', id: 'e2', from: 'c', to: 'd', ...across }
  )
  const { diagram: routed } = run(diagram, { op: 'route_edges' })
  const nodes = layoutNodes(routed)
  const paths = layoutEdges(routed.edges, nodes).map((laid) =>
    flattenPath(buildEdgePath('step', laid.from, laid.to, laid.edge.points ?? [], 12))
  )
  // How far two paths run along the same line (a shared lane), in pixels.
  const shared = (p, q) => {
    let total = 0
    for (let i = 1; i < p.length; i += 1) {
      for (let j = 1; j < q.length; j += 1) {
        const [a, b, c, d] = [p[i - 1], p[i], q[j - 1], q[j]]
        const vertical =
          Math.abs(a.x - b.x) < 0.5 && Math.abs(c.x - d.x) < 0.5 && Math.abs(a.x - c.x) < 0.5
        const horizontal =
          Math.abs(a.y - b.y) < 0.5 && Math.abs(c.y - d.y) < 0.5 && Math.abs(a.y - c.y) < 0.5
        const span = (u, v, w, x) =>
          Math.min(Math.max(u, v), Math.max(w, x)) - Math.max(Math.min(u, v), Math.min(w, x))
        if (vertical) total += Math.max(0, span(a.y, b.y, c.y, d.y))
        if (horizontal) total += Math.max(0, span(a.x, b.x, c.x, d.x))
      }
    }
    return total
  }
  // They share their leads out of the boxes at most; nowhere else do they run along each other.
  assert.ok(
    shared(paths[0], paths[1]) <= 30,
    `they run along each other for ${shared(paths[0], paths[1])}px`
  )
  assert.deepEqual(kinds(routed, 'edge-through-element'), [])
})

test('the answer is stable: the same diagram routes the same way twice', () => {
  const first = run(walled(), { op: 'route_edges' }).diagram
  const second = run(walled(), { op: 'route_edges' }).diagram
  assert.deepEqual(edgeOf(first, 'e').points, edgeOf(second, 'e').points)
})
