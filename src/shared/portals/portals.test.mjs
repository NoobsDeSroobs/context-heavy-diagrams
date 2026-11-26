import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultPortal,
  duplicatePortalNumbers,
  mirrorEdgeStylePositions,
  movePortalEnd,
  numberPoint,
  pathLength,
  portalNotices,
  portalNumbers,
  readPortal,
  splitPath
} from './portals.ts'

test('a portal needs both ends, start before end, inside 0 to 1', () => {
  assert.equal(readPortal(undefined), undefined)
  assert.equal(readPortal({ portalStart: 0.4 }), undefined)
  assert.equal(readPortal({ portalStart: 0.6, portalEnd: 0.4 }), undefined)
  assert.equal(readPortal({ portalStart: -0.1, portalEnd: 0.4 }), undefined)
  assert.equal(readPortal({ portalStart: 0.4, portalEnd: 1.2 }), undefined)
  assert.deepEqual(readPortal({ portalStart: 0.4, portalEnd: 0.6 }), { start: 0.4, end: 0.6 })
  assert.deepEqual(readPortal({ portalStart: 0.4, portalEnd: 0.6, portalNumber: 7 }), {
    start: 0.4,
    end: 0.6,
    number: 7
  })
  // A typed number that is not a positive whole number is not read.
  assert.equal(readPortal({ portalStart: 0.4, portalEnd: 0.6, portalNumber: 0 }).number, undefined)
  assert.equal(
    readPortal({ portalStart: 0.4, portalEnd: 0.6, portalNumber: 1.5 }).number,
    undefined
  )
})

test('a new portal is 60 pixels wide in the middle, and short edges get none', () => {
  const portal = defaultPortal(300)
  assert.equal(Math.round((portal.end - portal.start) * 300), 60)
  assert.equal(Math.round(((portal.start + portal.end) / 2) * 1000), 500)
  assert.equal(defaultPortal(80), undefined)
})

test('moving an end keeps the other end, the minimum gap and a drawn part at each element', () => {
  const portal = { start: 0.4, end: 0.6 }
  assert.equal(movePortalEnd(portal, 'start', 0.9, 400).start, 0.54)
  assert.equal(movePortalEnd(portal, 'start', 0, 400).start, 0.035)
  assert.equal(movePortalEnd(portal, 'end', 0.1, 400).end, 0.46)
  assert.equal(movePortalEnd(portal, 'end', 1, 400).end, 0.965)
})

test('a straight edge is cut at the two ends of the gap', () => {
  const split = splitPath('M0,0 L400,0', { start: 0.4, end: 0.6 })
  assert.equal(split.lead, 'M0,0 L160,0')
  assert.equal(split.tail, 'M240,0 L400,0')
  assert.equal(split.gapPx, 80)
  assert.deepEqual([split.entry.x, split.entry.y, split.entry.angle], [160, 0, 0])
  assert.deepEqual([split.exit.x, split.exit.y, split.exit.angle], [240, 0, 0])
})

test('a path with a corner is cut across it and the direction follows the edge', () => {
  // 100 across, then 300 down: the length is 400.
  const split = splitPath('M0,0 L100,0 L100,300', { start: 0.4, end: 0.6 })
  assert.equal(split.lead, 'M0,0 L100,0 L100,60')
  assert.equal(split.tail, 'M100,140 L100,300')
  assert.equal(split.entry.angle, 90)
})

test('a curve is cut into curves of the same shape and measures about its own length', () => {
  const d = 'M0,0 C100,0 200,100 300,100'
  const split = splitPath(d, { start: 0.3, end: 0.6 })
  assert.match(split.lead, /^M0,0 C/)
  assert.match(split.tail, / C[^C]*$/)
  assert.ok(pathLength(d) > 300)
  assert.ok(split.gapPx > 0.29 * pathLength(d) && split.gapPx < 0.31 * pathLength(d))
})

test('an edge too short for its gap or its drawn parts is drawn whole', () => {
  assert.equal(splitPath('M0,0 L100,0', { start: 0.4, end: 0.5 }), undefined)
  assert.equal(splitPath('M0,0 L400,0', { start: 0.01, end: 0.5 }), undefined)
  assert.equal(splitPath('M0,0 L400,0', { start: 0.5, end: 0.99 }), undefined)
  assert.equal(splitPath('not a path', { start: 0.4, end: 0.6 }), undefined)
})

test('the number sits beside the mark on the side of the gap', () => {
  const mark = { x: 100, y: 50, angle: 0 }
  assert.deepEqual(numberPoint(mark, 1), { x: 119, y: 54 })
  assert.deepEqual(numberPoint(mark, -1), { x: 81, y: 54 })
})

test('numbers come from the file order and skip the ones typed', () => {
  const portal = { portalStart: 0.4, portalEnd: 0.6 }
  const edges = [
    { id: 'a', style: portal },
    { id: 'b' },
    { id: 'c', style: { ...portal, portalNumber: 1 } },
    { id: 'd', style: portal }
  ]
  assert.deepEqual(
    [...portalNumbers(edges)],
    [
      ['a', 2],
      ['c', 1],
      ['d', 3]
    ]
  )
  assert.deepEqual(duplicatePortalNumbers(edges), [])
})

test('a number typed twice is a duplicate', () => {
  const style = { portalStart: 0.4, portalEnd: 0.6, portalNumber: 4 }
  const edges = [
    { id: 'a', style },
    { id: 'b', style }
  ]
  assert.deepEqual(duplicatePortalNumbers(edges), [{ number: 4, edgeIds: ['a', 'b'] }])
})

test('a reversed edge mirrors its label and its portal, and twice is the original', () => {
  const style = { labelPosition: 0.3, portalStart: 0.4, portalEnd: 0.5, portalNumber: 2 }
  const mirrored = mirrorEdgeStylePositions(style)
  assert.deepEqual(mirrored, {
    labelPosition: 0.7,
    portalStart: 0.5,
    portalEnd: 0.6,
    portalNumber: 2
  })
  assert.deepEqual(mirrorEdgeStylePositions(mirrored), style)
})

test('the notices name a number used twice and a label hidden in a gap', () => {
  const style = { portalStart: 0.4, portalEnd: 0.6, portalNumber: 2 }
  const edges = [
    { id: 'a', label: 'orders', style },
    { id: 'b', style },
    // The label is in the middle by default, so it sits in this gap.
    { id: 'c', label: 'sync', style: { portalStart: 0.3, portalEnd: 0.7 } },
    // Moved to the end, it is drawn.
    { id: 'd', label: 'ack', style: { portalStart: 0.3, portalEnd: 0.7, labelPosition: 0.9 } },
    // No portal, nothing to say.
    { id: 'e', label: 'plain' }
  ]
  assert.deepEqual(portalNotices(edges), [
    'Portal number 2 is on 2 edges: "orders", b',
    'The label of "orders" is in the hidden part of its portal',
    'The label of "sync" is in the hidden part of its portal'
  ])
})
