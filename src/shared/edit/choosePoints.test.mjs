// route_edges choosing the connection points of the edges it routes (ADR 0177).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../diagram/index.ts'
import { effectiveConnectionPoints } from '../geometry/connectionPoints.ts'
import { applyOperations } from './operations.ts'

const run = (diagram, ...ops) => applyOperations(diagram, ops, { newId: (p) => p })
const build = (...ops) => run(createEmptyDiagram(), ...ops).diagram
const entity = (id, x, y, extra = {}) => ({ op: 'add_entity', id, label: id, x, y, ...extra })
const connect = (id, from, to, extra = {}) => ({ op: 'connect', id, from, to, ...extra })
const nodeOf = (d, id) => d.nodes.find((n) => n.id === id)
const edgeOf = (d, id) => d.edges.find((e) => e.id === id)
const pointOf = (d, nodeId, handle) =>
  effectiveConnectionPoints(nodeOf(d, nodeId).connectionPoints ?? []).find((p) => p.id === handle)
const near = (a, b) => Math.abs(a - b) < 1e-9

// A wide hub with two elements below it, one left and one right.
const hub = (...edges) =>
  build(
    entity('hub', 200, 0, { width: 200, height: 60 }),
    entity('left', 0, 300),
    entity('right', 500, 300),
    ...edges
  )

test('each routed edge gets a point of its own on the side facing its other end, evenly spaced', () => {
  const { diagram, results } = run(hub(connect('a', 'hub', 'left'), connect('b', 'hub', 'right')), {
    op: 'route_edges',
    ids: ['a', 'b']
  })
  // `a` keeps the side's own point (its id), now beside `b`'s new one; only `b` changes handle.
  assert.deepEqual(results[0].movedToOtherPoints, ['b'])
  const [pa, pb] = [edgeOf(diagram, 'a'), edgeOf(diagram, 'b')].map((e) =>
    pointOf(diagram, 'hub', e.sourceHandle)
  )
  assert.equal(pa.side, 'bottom')
  assert.equal(pb.side, 'bottom')
  assert.ok(near(pa.offset, 1 / 3) && near(pb.offset, 2 / 3))
  assert.equal(pointOf(diagram, 'left', edgeOf(diagram, 'a').targetHandle).side, 'top')
})

test('the points follow the order of the targets, not the order the edges were made in', () => {
  const { diagram } = run(hub(connect('b', 'hub', 'right'), connect('a', 'hub', 'left')), {
    op: 'route_edges',
    ids: ['a', 'b']
  })
  const offsetOf = (id) => pointOf(diagram, 'hub', edgeOf(diagram, id).sourceHandle).offset
  assert.ok(offsetOf('a') < offsetOf('b'))
})

test('the answer is stable: running it again changes nothing', () => {
  const once = run(hub(connect('a', 'hub', 'left'), connect('b', 'hub', 'right')), {
    op: 'route_edges',
    ids: ['a', 'b']
  }).diagram
  const twice = run(once, { op: 'route_edges', ids: ['a', 'b'] }).diagram
  assert.deepEqual(twice, once)
})

test('connectionPoints "keep" leaves every connection point and handle alone', () => {
  const before = hub(connect('a', 'hub', 'left'), connect('b', 'hub', 'right'))
  const { diagram, results } = run(before, {
    op: 'route_edges',
    ids: ['a', 'b'],
    connectionPoints: 'keep'
  })
  assert.equal(results[0].movedToOtherPoints, undefined)
  assert.deepEqual(diagram.nodes, before.nodes)
  assert.equal(edgeOf(diagram, 'a').sourceHandle, edgeOf(before, 'a').sourceHandle)
})

test('a bad connectionPoints value is refused', () => {
  assert.throws(() =>
    run(hub(connect('a', 'hub', 'left')), { op: 'route_edges', connectionPoints: 'x' })
  )
})

test('an edge that is not routed keeps its point, and the routed ones fit round it', () => {
  const before = run(hub(connect('a', 'hub', 'left'), connect('b', 'hub', 'right')), {
    op: 'add_connection_point',
    id: 'hub',
    side: 'bottom',
    offset: 0.5,
    pointId: 'mine'
  }).diagram
  const set = run(before, { op: 'set_edge_handles', id: 'b', fromHandle: 'mine' }).diagram
  const { diagram } = run(set, { op: 'route_edges', ids: ['a'] })
  assert.equal(edgeOf(diagram, 'b').sourceHandle, 'mine')
  const bottom = (nodeOf(diagram, 'hub').connectionPoints ?? []).filter((p) => p.side === 'bottom')
  assert.equal(bottom.length, 2)
  // a is to the left of b's target, so it takes the point before.
  assert.ok(
    pointOf(diagram, 'hub', edgeOf(diagram, 'a').sourceHandle).offset <
      pointOf(diagram, 'hub', 'mine').offset
  )
})

test('an edge between elements stacked one above the other leaves by the facing sides', () => {
  const before = build(
    entity('top', 0, 0),
    entity('under', 0, 300),
    connect('e', 'top', 'under', { fromHandle: 'left', toHandle: 'left' })
  )
  const { diagram } = run(before, { op: 'route_edges', ids: ['e'] })
  const e = edgeOf(diagram, 'e')
  assert.equal(pointOf(diagram, 'top', e.sourceHandle).side, 'bottom')
  assert.equal(pointOf(diagram, 'under', e.targetHandle).side, 'top')
})

test('a side that is left with only its centre point stores nothing', () => {
  const { diagram } = run(build(entity('p', 0, 0), entity('q', 400, 0), connect('e', 'p', 'q')), {
    op: 'route_edges',
    ids: ['e']
  })
  assert.equal(nodeOf(diagram, 'p').connectionPoints, undefined)
  assert.equal(edgeOf(diagram, 'e').sourceHandle, 'right')
})

test('more edges than a side may hold share points, and it says so', () => {
  const before = build(
    entity('hub', 0, 0, { width: 400, height: 60 }),
    entity('t1', 0, 300),
    entity('t2', 150, 300),
    entity('t3', 300, 300),
    connect('a', 'hub', 't1'),
    connect('b', 'hub', 't2'),
    connect('c', 'hub', 't3')
  )
  before.maxConnectionPointsPerSide = 2
  const { diagram, results } = run(before, { op: 'route_edges', ids: ['a', 'b', 'c'] })
  const bottom = (nodeOf(diagram, 'hub').connectionPoints ?? []).filter((p) => p.side === 'bottom')
  assert.equal(bottom.length, 2)
  assert.ok(results[0].notices.some((n) => n.includes('share one')))
})
