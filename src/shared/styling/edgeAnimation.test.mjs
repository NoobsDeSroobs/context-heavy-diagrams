import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EDGE_ANIMATIONS,
  FLOW_MS_PER_UNIT,
  MAX_ANIMATION_SPEED,
  MIN_ANIMATION_SPEED,
  flowDurationMs,
  knownDirection,
  knownSpeed,
  flowDash,
  knownAnimation,
  pulseRadius,
  pulseSeconds
} from './edgeAnimation.ts'

test('a stored animation this build does not know is no animation', () => {
  for (const kind of EDGE_ANIMATIONS) assert.equal(knownAnimation(kind), kind)
  assert.equal(knownAnimation(undefined), undefined)
  assert.equal(knownAnimation('none'), undefined)
  assert.equal(knownAnimation('sparkle'), undefined)
  assert.equal(knownAnimation(3), undefined)
})

test('a flowing line is dashed even when its line style is solid, and the period is one repeat', () => {
  assert.deepEqual(flowDash(undefined), { dasharray: '8 6', period: 14 })
  assert.deepEqual(flowDash('solid'), { dasharray: '8 6', period: 14 })
  assert.deepEqual(flowDash('dashed'), { dasharray: '8 6', period: 14 })
  assert.deepEqual(flowDash('dotted'), { dasharray: '2 4', period: 6 })
})

test('a flowing dashed or dotted line keeps the pattern the edge already draws', () => {
  // LabeledEdge draws dashed as '8 6' and dotted as '2 4'; the flow must not change the look.
  assert.equal(flowDash('dashed').dasharray, '8 6')
  assert.equal(flowDash('dotted').dasharray, '2 4')
})

test('the pulse takes longer on a longer edge, within limits', () => {
  assert.equal(pulseSeconds(10), 1.5)
  assert.equal(pulseSeconds(600), 5)
  assert.equal(pulseSeconds(100000), 8)
  assert.ok(pulseSeconds(300) < pulseSeconds(600))
})

test('the pulse dot is never smaller than 3 and grows with the line', () => {
  assert.equal(pulseRadius(1), 3)
  assert.equal(pulseRadius(2), 3.5)
  assert.ok(pulseRadius(8) > pulseRadius(4))
})

test('a speed is a multiplier, drawn within 0.1 to 10, and anything else is normal speed', () => {
  assert.equal(knownSpeed(undefined), 1)
  assert.equal(knownSpeed('fast'), 1)
  assert.equal(knownSpeed(NaN), 1)
  assert.equal(knownSpeed(Infinity), 1)
  assert.equal(knownSpeed(2), 2)
  assert.equal(knownSpeed(0), MIN_ANIMATION_SPEED)
  assert.equal(knownSpeed(-3), MIN_ANIMATION_SPEED)
  assert.equal(knownSpeed(1e9), MAX_ANIMATION_SPEED)
})

test('a faster edge takes proportionally less time to go round', () => {
  const normal = flowDurationMs(14, 1)
  assert.equal(normal, 14 * FLOW_MS_PER_UNIT)
  assert.equal(flowDurationMs(14, 2), normal / 2)
  assert.equal(flowDurationMs(14, 0.5), normal * 2)
  // a speed of 0 does not stop the edge or divide by zero
  assert.equal(Number.isFinite(flowDurationMs(14, 0)), true)
  assert.equal(pulseSeconds(600, 2), pulseSeconds(600, 1) / 2)
  assert.equal(pulseSeconds(600), pulseSeconds(600, 1))
})

test('the direction is forward unless it says reverse', () => {
  assert.equal(knownDirection(undefined), 'forward')
  assert.equal(knownDirection('forward'), 'forward')
  assert.equal(knownDirection('reverse'), 'reverse')
  assert.equal(knownDirection('backwards'), 'forward')
})
