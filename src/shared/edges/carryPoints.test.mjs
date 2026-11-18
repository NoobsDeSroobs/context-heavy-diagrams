import test from 'node:test'
import assert from 'node:assert/strict'
import {
  absoluteBoxes,
  edgeShift,
  nearestEnds,
  nodeShifts,
  shiftNearestEnds,
  shiftPoints
} from './carryPoints.ts'

const node = (id, x, y, extra = {}) => ({
  id,
  position: { x, y },
  width: 100,
  height: 50,
  ...extra
})

test('a container drag moves its children by the same amount, so an edge between them is carried', () => {
  const before = [
    node('box', 100, 100),
    node('a', 10, 10, { parentId: 'box' }),
    node('b', 150, 10, { parentId: 'box' })
  ]
  const after = [
    node('box', 130, 90),
    node('a', 10, 10, { parentId: 'box' }),
    node('b', 150, 10, { parentId: 'box' })
  ]
  const shifts = nodeShifts(before, after)
  assert.deepEqual(edgeShift(shifts, 'a', 'b'), { dx: 30, dy: -10 })
  assert.deepEqual(shiftPoints([{ x: 5, y: 7, gravity: 2 }], { dx: 30, dy: -10 }), [
    { x: 35, y: -3, gravity: 2 }
  ])
})

test('moving two nodes by the same amount carries the edge between them', () => {
  const shifts = nodeShifts(
    [node('a', 0, 0), node('b', 300, 0)],
    [node('a', 20, 5), node('b', 320, 5)]
  )
  assert.deepEqual(edgeShift(shifts, 'a', 'b'), { dx: 20, dy: 5 })
})

test('one end moving, or the ends moving differently, carries nothing', () => {
  assert.equal(
    edgeShift(
      nodeShifts([node('a', 0, 0), node('b', 300, 0)], [node('a', 20, 0), node('b', 300, 0)]),
      'a',
      'b'
    ),
    null
  )
  assert.equal(
    edgeShift(
      nodeShifts([node('a', 0, 0), node('b', 300, 0)], [node('a', 20, 0), node('b', 330, 0)]),
      'a',
      'b'
    ),
    null
  )
})

test('an edge from an element to itself is carried when that element moves', () => {
  const shifts = nodeShifts([node('a', 0, 0)], [node('a', 40, 0)])
  assert.deepEqual(edgeShift(shifts, 'a', 'a'), { dx: 40, dy: 0 })
})

test('moving into a container without changing the place on the canvas is no move', () => {
  const before = [node('box', 100, 100), node('a', 150, 150)]
  const after = [node('box', 100, 100), node('a', 50, 50, { parentId: 'box' })]
  assert.equal(nodeShifts(before, after).size, 0)
})

test('a resized node is not counted as moved', () => {
  const shifts = nodeShifts([node('a', 0, 0)], [node('a', 10, 10, { width: 200 })])
  assert.equal(shifts.size, 0)
})

test('nodes in only one of the two states are ignored', () => {
  const shifts = nodeShifts([node('a', 0, 0)], [node('a', 10, 0), node('c', 5, 5)])
  assert.deepEqual([...shifts.keys()], ['a'])
})

test('each point is tied to the end whose box it is nearest, and a tie belongs to neither', () => {
  const boxes = absoluteBoxes([node('a', 0, 0), node('b', 400, 0)])
  const a = boxes.get('a')
  const b = boxes.get('b')
  const ends = nearestEnds(
    [
      { x: 110, y: 25 },
      { x: 390, y: 25 },
      { x: 250, y: 25 }
    ],
    a,
    b
  )
  assert.deepEqual(ends, ['source', 'target', null])
})

test('distance is measured to the box, not its corner', () => {
  const boxes = absoluteBoxes([node('a', 0, 0), node('b', 400, 0)])
  // 10 px below the left box, 340 px from the right one.
  assert.deepEqual(nearestEnds([{ x: 60, y: 60 }], boxes.get('a'), boxes.get('b')), ['source'])
})

test('nearest-end carrying moves only the points tied to an end that moved', () => {
  const points = [
    { x: 110, y: 25, gravity: 1 },
    { x: 390, y: 25 }
  ]
  const ends = ['source', 'target']
  assert.deepEqual(shiftNearestEnds(points, ends, { source: { dx: 0, dy: 50 } }), [
    { x: 110, y: 75, gravity: 1 },
    { x: 390, y: 25 }
  ])
  assert.deepEqual(shiftNearestEnds(points, [null, null], { source: { dx: 5, dy: 5 } }), points)
})
