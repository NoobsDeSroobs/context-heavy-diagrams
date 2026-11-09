// Run with `npm test`. Projecting a point onto an edge path, the inverse of pointAtRatio (ADR 0164).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pointAtRatio, ratioNearest } from './pathSampling.ts'

const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} vs ${expected}`)

test('a point beside a straight path projects onto its foot', () => {
  const d = 'M 0 0 L 100 0'
  near(ratioNearest(d, { x: 25, y: 40 }), 0.25)
  near(ratioNearest(d, { x: 80, y: -10 }), 0.8)
})

test('a point past either end clamps to 0 or 1', () => {
  const d = 'M 0 0 L 100 0'
  near(ratioNearest(d, { x: -50, y: 5 }), 0)
  near(ratioNearest(d, { x: 400, y: 5 }), 1)
})

test('the fraction follows the length round a corner', () => {
  // 100 right, then 100 down: halfway along is the corner.
  const d = 'M 0 0 L 100 0 L 100 100'
  near(ratioNearest(d, { x: 100, y: 0 }), 0.5)
  near(ratioNearest(d, { x: 130, y: 50 }), 0.75)
  near(ratioNearest(d, { x: 50, y: -20 }), 0.25)
})

test('it inverts pointAtRatio on a curve', () => {
  const d = 'M 0 0 C 0 100 200 100 200 0'
  for (const ratio of [0, 0.1, 0.33, 0.5, 0.8, 1]) {
    const back = ratioNearest(d, pointAtRatio(d, ratio))
    assert.ok(Math.abs(back - ratio) < 1e-3, `${ratio} came back as ${back}`)
  }
})

test('a path with no length answers the middle', () => {
  near(ratioNearest('M 5 5 L 5 5', { x: 9, y: 9 }), 0.5)
  near(ratioNearest('', { x: 1, y: 1 }), 0.5)
})
