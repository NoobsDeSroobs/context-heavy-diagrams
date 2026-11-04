import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EDGE_ANIMATIONS,
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
