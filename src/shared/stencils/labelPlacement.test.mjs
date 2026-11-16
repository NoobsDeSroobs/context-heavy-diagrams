import test from 'node:test'
import assert from 'node:assert/strict'
import {
  labelAlign,
  labelBox,
  labelPositionOf,
  leaderLine,
  offsetFrom,
  offsetOf
} from './labelPlacement.ts'

const shape = { x: 100, y: 100, width: 40, height: 40 }
const block = { width: 60, height: 16 }

test('a label sits below, above, left or right of its shape, centred on it', () => {
  assert.deepEqual(labelBox('below', undefined, shape, block), {
    x: 90,
    y: 144,
    width: 60,
    height: 16
  })
  assert.deepEqual(labelBox('above', undefined, shape, block), {
    x: 90,
    y: 80,
    width: 60,
    height: 16
  })
  assert.deepEqual(labelBox('left', undefined, shape, block), {
    x: 36,
    y: 112,
    width: 60,
    height: 16
  })
  assert.deepEqual(labelBox('right', undefined, shape, block), {
    x: 144,
    y: 112,
    width: 60,
    height: 16
  })
})

test('a free label is centred at its offset from the centre of the shape', () => {
  const box = labelBox('free', { x: 80, y: -50 }, shape, block)
  assert.deepEqual(box, { x: 170, y: 62, width: 60, height: 16 })
  // Without an offset it falls back to below, so a file that says free and nothing else still reads.
  assert.deepEqual(
    labelBox('free', undefined, shape, block),
    labelBox('below', undefined, shape, block)
  )
})

test('an unknown position is read as below, and a bad offset as none', () => {
  assert.equal(labelPositionOf(undefined), 'below')
  assert.equal(labelPositionOf('diagonal'), 'below')
  assert.equal(labelPositionOf('left'), 'left')
  assert.equal(offsetOf({ x: 1, y: 2 })?.y, 2)
  assert.equal(offsetOf({ x: 'a', y: 2 }), undefined)
  assert.equal(offsetOf({ x: NaN, y: 2 }), undefined)
  assert.equal(offsetOf(undefined), undefined)
})

test('the text leans toward the shape for a label beside it', () => {
  assert.equal(labelAlign('left'), 'end')
  assert.equal(labelAlign('right'), 'start')
  assert.equal(labelAlign('below'), 'center')
  assert.equal(labelAlign('free'), 'center')
})

test('a dotted line ties a free label to its shape only when there is a gap', () => {
  const near = labelBox('below', undefined, shape, block)
  assert.equal(leaderLine('circle', shape, near), null)
  const far = labelBox('free', { x: 120, y: 0 }, shape, block)
  const line = leaderLine('circle', shape, far)
  assert.ok(line)
  // It starts on the outline of the circle and ends at the near edge of the label.
  assert.ok(Math.abs(Math.hypot(line.x1 - 120, line.y1 - 120) - 20) < 0.001)
  assert.ok(Math.abs(line.x2 - far.x) < 0.001)
  const square = leaderLine('square', shape, far)
  assert.ok(Math.abs(square.x1 - 140) < 0.001)
})

test('making a label free keeps it where it was', () => {
  for (const position of ['below', 'above', 'left', 'right']) {
    const offset = offsetFrom(position, shape, block)
    const again = labelBox('free', offset, shape, block)
    const was = labelBox(position, undefined, shape, block)
    assert.ok(Math.abs(again.x - was.x) <= 1 && Math.abs(again.y - was.y) <= 1, position)
  }
})
