import test from 'node:test'
import assert from 'node:assert/strict'
import {
  moveOrthogonalSegment,
  nearestPointOnRoute,
  orthogonalRouteVertices,
  orthogonalSegments
} from './orthogonalPath.ts'

// B on the right (the source, attached on its right side), A on the left (the target, attached on
// its left side), level with each other: a backwards connection, a straight line through both.
const s = { x: 500, y: 100 }
const t = { x: 100, y: 100 }
const ends = { sourceSide: 'right', targetSide: 'left' }
const xy = (vs) => vs.map((p) => [p.x, p.y])
const route = (waypoints, from = s, to = t) =>
  orthogonalRouteVertices(from, 'right', waypoints, to, 'left')

test('no points, or a point on the line, stays a straight line', () => {
  assert.deepEqual(xy(route([])), [
    [500, 100],
    [100, 100]
  ])
  assert.deepEqual(xy(route([{ x: 300, y: 100 }])), [
    [500, 100],
    [300, 100],
    [100, 100]
  ])
})

test('one point above the line goes round both elements, not up and back down', () => {
  assert.deepEqual(xy(route([{ x: 300, y: 20 }])), [
    [500, 100],
    [520, 100],
    [520, 20],
    [300, 20],
    [80, 20],
    [80, 100],
    [100, 100]
  ])
})

test('a route that already leaves and arrives the right way is unchanged', () => {
  assert.deepEqual(
    xy(
      route([
        { x: 520, y: 20 },
        { x: 80, y: 20 }
      ])
    ),
    [
      [500, 100],
      [520, 100],
      [520, 20],
      [80, 20],
      [80, 100],
      [100, 100]
    ]
  )
  // Facing elements with a crossbar between them.
  assert.deepEqual(
    xy(
      orthogonalRouteVertices(
        { x: 0, y: 0 },
        'right',
        [{ x: 150, y: 80 }],
        { x: 300, y: 200 },
        'left'
      )
    ),
    [
      [0, 0],
      [150, 0],
      [150, 80],
      [150, 200],
      [300, 200]
    ]
  )
})

test('the stubs follow the sides on the vertical axis too', () => {
  // Source on its bottom side, target on its top side, the target above the source.
  const v = orthogonalRouteVertices(
    { x: 100, y: 400 },
    'bottom',
    [{ x: 40, y: 250 }],
    { x: 100, y: 100 },
    'top'
  )
  assert.deepEqual(xy(v), [
    [100, 400],
    [100, 420],
    [40, 420],
    [40, 250],
    [40, 80],
    [100, 80],
    [100, 100]
  ])
})

test('only segments between bends get a handle unless the sides are given', () => {
  assert.equal(orthogonalSegments(route([])).length, 0)
  assert.equal(orthogonalSegments(route([{ x: 300, y: 100 }])).length, 0)
})

test('with the sides, the segments that touch an end get handles too', () => {
  const straight = orthogonalSegments(route([]), ends)
  assert.equal(straight.length, 1)
  assert.deepEqual(straight[0].mid, { x: 300, y: 100 })
  // The two halves of a line with a point on it.
  assert.equal(orthogonalSegments(route([{ x: 300, y: 100 }]), ends).length, 2)
  // The 20 px stubs are too short to grab; the legs between them can be.
  const round = orthogonalSegments(
    route([
      { x: 520, y: 20 },
      { x: 80, y: 20 }
    ]),
    ends
  )
  assert.deepEqual(
    round.map((x) => x.index),
    [1, 2, 3]
  )
})

test('a segment that does not run along its end’s side gets no end handle', () => {
  // A vertical first leg from a right-side source.
  const v = [
    { x: 100, y: 100 },
    { x: 100, y: 300 },
    { x: 400, y: 300 }
  ]
  const found = orthogonalSegments(v, { sourceSide: 'right', targetSide: 'left' })
  assert.deepEqual(
    found.map((x) => x.index),
    [1]
  )
})

test('dragging the one segment of a straight edge makes a stub at each end', () => {
  const [seg] = orthogonalSegments(route([]), ends)
  const points = moveOrthogonalSegment(route([]), seg.index, seg.axis, 20, true, ends)
  assert.deepEqual(points, [
    { x: 520, y: 20 },
    { x: 80, y: 20 }
  ])
  // And the route those points make goes round both elements.
  assert.deepEqual(xy(route(points)), [
    [500, 100],
    [520, 100],
    [520, 20],
    [80, 20],
    [80, 100],
    [100, 100]
  ])
})

test('dragging it back onto the line takes the points away again', () => {
  const v = route([])
  const [seg] = orthogonalSegments(v, ends)
  assert.deepEqual(moveOrthogonalSegment(v, seg.index, seg.axis, 103, true, ends), [])
})

test('mid-drag the points are not simplified, so a handle keeps its meaning', () => {
  const v = route([])
  const points = moveOrthogonalSegment(v, 0, 'h', 103, false, ends)
  assert.equal(points.length, 2)
})

test('dragging a segment that touches the source moves the rest of the route with it', () => {
  // Source level with the first bend of a crossbar, a long way from the target.
  const v = orthogonalRouteVertices(
    { x: 0, y: 0 },
    'right',
    [{ x: 200, y: 150 }],
    { x: 400, y: 300 },
    'left'
  )
  const first = orthogonalSegments(v, { sourceSide: 'right', targetSide: 'left' })[0]
  assert.equal(first.index, 0)
  const points = moveOrthogonalSegment(v, 0, 'h', -50, true, {
    sourceSide: 'right',
    targetSide: 'left'
  })
  // Out of the source by a stub, along the moved row to the old bend, then on as before.
  assert.deepEqual(points[0], { x: 20, y: -50 })
  assert.deepEqual(points[1], { x: 200, y: -50 })
  // The column down to the target's row is drawn by the route and is not stored.
  assert.equal(points.length, 2)
})

test('dragging the last segment makes a stub into the target', () => {
  const v = orthogonalRouteVertices(
    { x: 0, y: 0 },
    'right',
    [{ x: 200, y: 150 }],
    { x: 400, y: 300 },
    'left'
  )
  const lastIndex = v.length - 2
  const points = moveOrthogonalSegment(v, lastIndex, 'h', 340, true, {
    sourceSide: 'right',
    targetSide: 'left'
  })
  assert.deepEqual(points[points.length - 1], { x: 380, y: 340 })
})

test('a point on a straight run splits it in two, and each half moves on its own with a bridge at the point', () => {
  const v = route([{ x: 300, y: 100 }])
  assert.equal(orthogonalSegments(v, ends).length, 2)
  // The half next to the source goes up; the half next to the target stays, joined by a bridge at the point.
  const points = moveOrthogonalSegment(v, 0, 'h', 20, true, ends)
  assert.deepEqual(points, [
    { x: 520, y: 20 },
    { x: 300, y: 20 },
    { x: 300, y: 100 }
  ])
  assert.deepEqual(xy(route(points)), [
    [500, 100],
    [520, 100],
    [520, 20],
    [300, 20],
    [300, 100],
    [100, 100]
  ])
  // Likewise the half next to the target.
  const other = moveOrthogonalSegment(v, 1, 'h', 20, true, ends)
  assert.deepEqual(other, [
    { x: 300, y: 100 },
    { x: 300, y: 20 },
    { x: 80, y: 20 }
  ])
})

test('moving the second half too leaves one run: the bridge and the extra points collapse', () => {
  const v = route([{ x: 300, y: 100 }])
  const first = moveOrthogonalSegment(v, 0, 'h', 20, true, ends)
  const next = route(first)
  const last = next.length - 2
  const both = moveOrthogonalSegment(next, last, 'h', 20, true, ends)
  assert.deepEqual(both, [
    { x: 520, y: 20 },
    { x: 80, y: 20 }
  ])
})

test('a new point is put on the drawn route, not beside it', () => {
  assert.deepEqual(nearestPointOnRoute(route([]), { x: 300, y: 97 }), { x: 300, y: 100 })
  // Past the end of a segment it lands on the end.
  assert.deepEqual(nearestPointOnRoute(route([]), { x: 90, y: 90 }), { x: 100, y: 100 })
})
