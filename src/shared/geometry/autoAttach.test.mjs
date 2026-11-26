// Automatic attachment: an edge end that names no point takes a facing side and a point on it.
import assert from 'node:assert/strict'
import test from 'node:test'
import { AXIS_MARGIN, automaticHandles } from './autoAttach.ts'

const box = (id, x, y, points = [], width = 100, height = 60) => ({
  id,
  x,
  y,
  width,
  height,
  points
})
const edge = (id, source, target, sourceHandle, targetHandle) => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle
})

test('an edge with no handles leaves by the sides that face, across the wider gap', () => {
  const nodes = [box('a', 0, 0), box('b', 300, 0), box('c', 0, 300)]
  const got = automaticHandles(nodes, [edge('e', 'a', 'b'), edge('f', 'a', 'c')])
  assert.deepEqual(got.get('e'), { sourceHandle: 'right', targetHandle: 'left' })
  assert.deepEqual(got.get('f'), { sourceHandle: 'bottom', targetHandle: 'top' })
})

test('it follows the other element when that moves', () => {
  const edges = [edge('e', 'a', 'b')]
  assert.equal(
    automaticHandles([box('a', 0, 0), box('b', 300, 0)], edges).get('e').sourceHandle,
    'right'
  )
  assert.equal(
    automaticHandles([box('a', 0, 0), box('b', -300, 0)], edges).get('e').sourceHandle,
    'left'
  )
  assert.equal(
    automaticHandles([box('a', 0, 0), box('b', 0, -300)], edges).get('e').sourceHandle,
    'top'
  )
})

test('an end that names a point is left alone; only the other end is chosen', () => {
  const got = automaticHandles([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b', 'top')])
  assert.deepEqual(got.get('e'), { targetHandle: 'left' })
})

test('edges that name both ends are not listed', () => {
  const got = automaticHandles(
    [box('a', 0, 0), box('b', 300, 0)],
    [edge('e', 'a', 'b', 'right', 'left')]
  )
  assert.equal(got.size, 0)
})

test('free points are taken first, in the order of where the other ends are', () => {
  const hubPoints = [
    { id: 'p1', side: 'bottom', offset: 0.25 },
    { id: 'p2', side: 'bottom', offset: 0.5 },
    { id: 'p3', side: 'bottom', offset: 0.75 }
  ]
  const nodes = [box('hub', 100, 0, hubPoints, 300), box('l', 0, 300), box('r', 400, 300)]
  // The right-hand edge is listed first, but its target is further right, so it takes the later point.
  const got = automaticHandles(nodes, [edge('toR', 'hub', 'r'), edge('toL', 'hub', 'l')])
  assert.ok(got.get('toL').sourceHandle < got.get('toR').sourceHandle)
  assert.notEqual(got.get('toL').sourceHandle, 'p2')
  // A point another edge names is not taken while a free one is left.
  const named = automaticHandles(nodes, [
    edge('x', 'hub', 'l', 'p1', 'top'),
    edge('toR', 'hub', 'r')
  ])
  assert.ok(!['p1'].includes(named.get('toR').sourceHandle))
})

test('with more edges than points they share, in order', () => {
  const nodes = [
    box('hub', 0, 0, [], 400),
    box('a', 0, 300),
    box('b', 150, 300),
    box('c', 300, 300)
  ]
  const got = automaticHandles(nodes, [
    edge('1', 'hub', 'a'),
    edge('2', 'hub', 'b'),
    edge('3', 'hub', 'c')
  ])
  assert.deepEqual(
    [1, 2, 3].map((n) => got.get(String(n)).sourceHandle),
    ['bottom', 'bottom', 'bottom']
  )
})

test('nearly diagonal elements keep the axis they had until one is clearly wider', () => {
  const edges = [edge('e', 'a', 'b')]
  const memory = new Map()
  // Clearly across: right.
  automaticHandles([box('a', 0, 0), box('b', 300, 100)], edges, memory)
  assert.equal(memory.get('e'), 'x')
  // Nearly diagonal now (gaps within the margin of each other): it stays across.
  const gap = 150
  const near = [box('a', 0, 0), box('b', 100 + gap, 60 + gap - AXIS_MARGIN / 2)]
  assert.equal(automaticHandles(near, edges, memory).get('e').sourceHandle, 'right')
  // Clearly above and below: it changes.
  const below = [box('a', 0, 0), box('b', 100 + 20, 60 + 200)]
  assert.equal(automaticHandles(below, edges, memory).get('e').sourceHandle, 'bottom')
  assert.equal(memory.get('e'), 'y')
})

test('overlapping elements, an edge to itself and unknown elements are left to the fallback', () => {
  const got = automaticHandles(
    [box('a', 0, 0), box('b', 50, 20)],
    [edge('e', 'a', 'b'), edge('s', 'a', 'a'), edge('u', 'a', 'zz')]
  )
  assert.equal(got.size, 0)
})
