import test from 'node:test'
import assert from 'node:assert/strict'
import { pointSlides, slideKey, SLIDE_RANGE } from './springPoints.ts'

const node = (id, x, y, points = []) => ({ id, x, y, width: 100, height: 40, points })
const down = (source, target, sourceHandle = 'bottom', targetHandle = 'top') => ({
  source,
  target,
  sourceHandle,
  targetHandle
})

test('two ends a little out of line each move half the way, so the edge runs straight', () => {
  // a's bottom point is at x=50, b's top point at x=64: 14 apart.
  const slides = pointSlides([node('a', 0, 0), node('b', 14, 200)], [down('a', 'b')])
  const a = slides.get(slideKey('a', 'bottom')) ?? 0
  const b = slides.get(slideKey('b', 'top')) ?? 0
  assert.ok(Math.abs(50 + a - (64 + b)) < 0.2, `ends line up (${a}, ${b})`)
})

test('past the range the edge bends: nothing slides', () => {
  const slides = pointSlides(
    [node('a', 0, 0), node('b', 2 * SLIDE_RANGE + 5, 200)],
    [down('a', 'b')]
  )
  assert.equal(slides.size, 0)
})

test('an edge with bend points of its own, or no handles, or two sides that do not face, is left alone', () => {
  const nodes = [node('a', 0, 0), node('b', 8, 200)]
  assert.equal(pointSlides(nodes, [{ ...down('a', 'b'), bent: true }]).size, 0)
  assert.equal(pointSlides(nodes, [{ source: 'a', target: 'b' }]).size, 0)
  assert.equal(pointSlides(nodes, [down('a', 'b', 'bottom', 'left')]).size, 0)
})

test('left and right sides slide up and down', () => {
  const slides = pointSlides(
    [node('a', 0, 0), node('b', 300, 10)],
    [down('a', 'b', 'right', 'left')]
  )
  const a = slides.get(slideKey('a', 'right')) ?? 0
  const b = slides.get(slideKey('b', 'left')) ?? 0
  assert.ok(Math.abs(20 + a - (30 + b)) < 0.2)
})

test('a point slides on its own: the others on its side stay in their slots, in order', () => {
  // a has three points on the bottom (slots 25, 50, 75); only the middle one has an edge, 18 off.
  const points = [
    { id: 'p1', side: 'bottom', offset: 0.25 },
    { id: 'p2', side: 'bottom', offset: 0.5 },
    { id: 'p3', side: 'bottom', offset: 0.75 }
  ]
  const slides = pointSlides(
    [node('a', 0, 0, points), node('b', 18, 200)],
    [down('a', 'b', 'p2', 'top')]
  )
  assert.ok(Math.abs((slides.get(slideKey('a', 'p2')) ?? 0) - 9) < 0.01, 'half the way')
  assert.equal(slides.get(slideKey('a', 'p1')), undefined)
  assert.equal(slides.get(slideKey('a', 'p3')), undefined)
})

test('two points that would meet keep their room', () => {
  // slots 25 and 75 on a 100 wide node are far apart; on a 30 wide node they are 10 apart.
  const points = [
    { id: 'p1', side: 'bottom', offset: 1 / 3 },
    { id: 'p2', side: 'bottom', offset: 2 / 3 }
  ]
  const narrow = { id: 'a', x: 0, y: 0, width: 30, height: 40, points }
  const slides = pointSlides(
    [
      narrow,
      { id: 'b', x: 8, y: 200, width: 100, height: 40, points: [] },
      { id: 'c', x: -20, y: 200, width: 100, height: 40, points: [] }
    ],
    [down('a', 'b', 'p1', 'top'), down('a', 'c', 'p2', 'top')]
  )
  const p1 = 10 + (slides.get(slideKey('a', 'p1')) ?? 0)
  const p2 = 20 + (slides.get(slideKey('a', 'p2')) ?? 0)
  assert.ok(p2 - p1 >= 6 - 0.01, `room kept (${p1}, ${p2})`)
})

test('the same diagram slides the same way twice', () => {
  const nodes = [node('a', 0, 0), node('b', 14, 200)]
  const edges = [down('a', 'b')]
  assert.deepEqual([...pointSlides(nodes, edges)], [...pointSlides(nodes, edges)])
})
