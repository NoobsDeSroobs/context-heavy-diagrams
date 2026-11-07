// Run with `npm test`. The value maths of dragging a number field's label.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DRAG_THRESHOLD_PX, scrubSpeed, scrubValue } from './scrubValue.ts'

test('one step per pixel by default', () => {
  assert.equal(scrubValue({ start: 10, pixels: 5 }), 15)
  assert.equal(scrubValue({ start: 10, pixels: -4, step: 2 }), 2)
})

test('fine is a tenth of a step and coarse ten steps per pixel', () => {
  assert.equal(scrubValue({ start: 1, pixels: 3, speed: 'fine' }), 1.3)
  assert.equal(scrubValue({ start: 1, pixels: 3, speed: 'coarse' }), 31)
})

test('values stay clean decimals', () => {
  assert.equal(scrubValue({ start: 0.1, pixels: 2, step: 0.1 }), 0.3)
  assert.equal(scrubValue({ start: 0.7, pixels: 1, step: 0.1, speed: 'fine' }), 0.71)
})

test('the result is kept inside min and max', () => {
  assert.equal(scrubValue({ start: 90, pixels: 50, min: 0, max: 100 }), 100)
  assert.equal(scrubValue({ start: 5, pixels: -50, min: 1 }), 1)
})

test('no pixels moved leaves the value alone', () => {
  assert.equal(scrubValue({ start: 12, pixels: 0, step: 0.5 }), 12)
})

test('Shift is fine, Ctrl or Cmd is coarse, Shift wins', () => {
  const none = { shiftKey: false, ctrlKey: false, metaKey: false }
  assert.equal(scrubSpeed(none), 'normal')
  assert.equal(scrubSpeed({ ...none, shiftKey: true }), 'fine')
  assert.equal(scrubSpeed({ ...none, ctrlKey: true }), 'coarse')
  assert.equal(scrubSpeed({ ...none, metaKey: true }), 'coarse')
  assert.equal(scrubSpeed({ ...none, shiftKey: true, ctrlKey: true }), 'fine')
})

test('a few pixels of movement is still a click', () => {
  assert.ok(DRAG_THRESHOLD_PX >= 2)
})
