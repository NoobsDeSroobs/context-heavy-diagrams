import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EDGE_ANIMATIONS,
  FLOW_MS_PER_UNIT,
  MAX_ANIMATION_SPEED,
  MIN_ANIMATION_SPEED,
  flowLoop,
  knownAnimation,
  knownDirection,
  knownPulseDistance,
  knownSpeed,
  pulseLoop,
  pulseRadius
} from './edgeAnimation.ts'

test('a stored animation this build does not know is no animation', () => {
  for (const kind of EDGE_ANIMATIONS) assert.equal(knownAnimation(kind), kind)
  assert.equal(knownAnimation(undefined), undefined)
  assert.equal(knownAnimation('none'), undefined)
  assert.equal(knownAnimation('sparkle'), undefined)
  assert.equal(knownAnimation(3), undefined)
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

test('the direction is forward unless it says reverse', () => {
  assert.equal(knownDirection(undefined), 'forward')
  assert.equal(knownDirection('forward'), 'forward')
  assert.equal(knownDirection('reverse'), 'reverse')
  assert.equal(knownDirection('backwards'), 'forward')
})

test('a flowing line moves one repeat of its pattern per loop, and a faster edge loops sooner', () => {
  const normal = flowLoop({ dash: 8, gap: 6 }, 1)
  assert.deepEqual(normal, { period: 14, durationMs: 14 * FLOW_MS_PER_UNIT })
  assert.equal(flowLoop({ dash: 8, gap: 6 }, 2).durationMs, normal.durationMs / 2)
  assert.equal(flowLoop({ dash: 8, gap: 6 }, 0.5).durationMs, normal.durationMs * 2)
  // a custom pattern takes its own period, at the same pace
  assert.deepEqual(flowLoop({ dash: 20, gap: 10 }, 1), {
    period: 30,
    durationMs: 30 * FLOW_MS_PER_UNIT
  })
  // a speed of 0 does not stop the edge or divide by zero
  assert.equal(Number.isFinite(flowLoop({ dash: 8, gap: 6 }, 0).durationMs), true)
})

test('the pulse dot is never smaller than 3 and grows with the line', () => {
  assert.equal(pulseRadius(1), 3)
  assert.equal(pulseRadius(2), 3.5)
  assert.ok(pulseRadius(8) > pulseRadius(4))
})

test('a pulse distance of 0, a negative one or a junk one is a single pulse', () => {
  for (const value of [undefined, 0, -5, NaN, 'far', Infinity]) {
    assert.equal(knownPulseDistance(value, 3), 0, String(value))
  }
  assert.equal(knownPulseDistance(100, 3), 100)
  // never closer than the dots are wide, or they run together into a line
  assert.equal(knownPulseDistance(1, 3), 8)
})

test('a single pulse starts again only once it is out of sight, and takes 1.5 to 8 seconds', () => {
  const short = pulseLoop(100, 0, 3, 1)
  assert.equal(short.dasharray, `0 ${short.period}`)
  assert.equal(short.period, 100 + 6)
  assert.equal(short.durationMs, 1500)
  assert.equal(pulseLoop(600, 0, 3, 1).durationMs, 5000)
  assert.equal(pulseLoop(100000, 0, 3, 1).durationMs, 8000)
  assert.equal(pulseLoop(600, 0, 3, 2).durationMs, 2500)
})

test('a stream of pulses repeats at the distance and moves at the same pace on every edge', () => {
  const stream = pulseLoop(600, 60, 3, 1)
  assert.deepEqual(stream, { dasharray: '0 60', period: 60, durationMs: 500 })
  // the same pace on a short edge, since it does not depend on the length
  assert.equal(pulseLoop(50, 60, 3, 1).durationMs, 500)
  assert.equal(pulseLoop(600, 60, 3, 2).durationMs, 250)
})
