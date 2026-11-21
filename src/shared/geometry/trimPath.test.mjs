// Run with `npm test`. A line stops short of the tip of a pointed arrowhead (ADR 0197).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trimPath } from './trimPath.ts'
import { markerTrim } from '../export/markerShapes.ts'

test('nothing to trim, or a string it cannot read, comes back unchanged', () => {
  assert.equal(trimPath('M0,0 L10,0', 0, 0), 'M0,0 L10,0')
  assert.equal(trimPath('M0,0 A5,5 0 0 1 10,0', 0, 2), 'M0,0 A5,5 0 0 1 10,0')
  assert.equal(trimPath('M0,0 L10,0 Z', 0, 2), 'M0,0 L10,0 Z')
  assert.equal(trimPath('', 0, 2), '')
})

test('a straight path is shortened at the end, the start, or both', () => {
  assert.equal(trimPath('M0,0 L10,0', 0, 2), 'M0,0 L8,0')
  assert.equal(trimPath('M0,0 L10,0', 3, 0), 'M3,0 L10,0')
  assert.equal(trimPath('M0,0L10,0', 1, 2), 'M1,0 L8,0')
  assert.equal(trimPath('M 0,0 L 0,10', 0, 4), 'M0,0 L0,6')
})

test('only the last piece is shortened, along its own direction', () => {
  assert.equal(trimPath('M0,0 L10,0 L10,10', 0, 4), 'M0,0 L10,0 L10,6')
  assert.equal(trimPath('M0,0 L10,0 L10,10', 4, 0), 'M4,0 L10,0 L10,10')
})

test('a curve is cut short and keeps its direction at the end', () => {
  const out = trimPath('M0,0 C10,0 20,0 30,0', 0, 6)
  assert.match(out, /^M0,0 C/)
  const nums = out.match(/-?\d+(\.\d+)?/g).map(Number)
  const end = nums.slice(-2)
  assert.ok(end[0] > 23 && end[0] < 25, `ends near 24, got ${end[0]}`)
  assert.equal(end[1], 0)
  // a quadratic as well, the smoothstep corner
  const q = trimPath('M0,0 Q10,0 10,10', 0, 3)
  assert.match(q, /^M0,0 Q/)
})

test('a trim longer than the piece leaves half of it', () => {
  assert.equal(trimPath('M0,0 L10,0', 0, 50), 'M0,0 L5,0')
})

test('markerTrim: pointed heads stop the line short in proportion to the width, others do not', () => {
  assert.equal(markerTrim('none', 2), 0)
  assert.equal(markerTrim(undefined, 2), 0)
  assert.equal(markerTrim('arrowOpen', 2), 0)
  assert.equal(markerTrim('circleFilled', 2), 0)
  const arrow2 = markerTrim('arrowClosed', 2)
  assert.ok(arrow2 > 0)
  assert.ok(Math.abs(markerTrim('arrowClosed', 4) - 2 * arrow2) < 1e-9)
  // at least as far as the head is as wide as the line: 1.25 units, 0.8 px a unit, per stroke width
  assert.ok(arrow2 >= 1.25 * 0.8 * 2)
  assert.ok(markerTrim('diamondFilled', 2) > 0)
})
