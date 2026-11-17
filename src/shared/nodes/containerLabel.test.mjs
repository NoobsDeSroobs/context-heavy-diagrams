import test from 'node:test'
import assert from 'node:assert/strict'
import {
  containerLabelPlace,
  containerLabelRoom,
  containerLabelSideOf,
  containerLabelTurn
} from './containerLabel.ts'

const box = { x: 0, y: 0, width: 400, height: 200 }
const block = { width: 80, height: 16 }

test('the top of the text points at the side, and the bottom stays upright', () => {
  assert.equal(containerLabelTurn('top'), 0)
  assert.equal(containerLabelTurn('left'), -90)
  assert.equal(containerLabelTurn('right'), 90)
  assert.equal(containerLabelTurn('bottom'), 0)
})

test('an unknown side is read as the top', () => {
  assert.equal(containerLabelSideOf(undefined), 'top')
  assert.equal(containerLabelSideOf('diagonal'), 'top')
  assert.equal(containerLabelSideOf('left'), 'left')
})

test('a label at the top or bottom starts, centres or ends along the side', () => {
  assert.deepEqual(containerLabelPlace('top', box, 1.5, block, 'start'), {
    left: 9.5,
    top: 5.5,
    cx: 49.5,
    cy: 13.5
  })
  assert.equal(containerLabelPlace('top', box, 1.5, block, 'center').left, 160)
  assert.equal(containerLabelPlace('top', box, 1.5, block, 'end').left, 400 - 1.5 - 8 - 80)
  assert.equal(containerLabelPlace('bottom', box, 1.5, block, 'start').top, 200 - 1.5 - 4 - 16)
})

test('a turned label runs up the left and down the right, starting where its text starts', () => {
  const left = (align) => containerLabelPlace('left', box, 1.5, block, align)
  const right = (align) => containerLabelPlace('right', box, 1.5, block, align)
  // The block turned about its centre: it lies along the side, 16 wide and 80 long.
  assert.ok(Math.abs(left('start').cx - (1.5 + 4 + 8)) < 1e-9)
  assert.ok(Math.abs(right('start').cx - (400 - 1.5 - 4 - 8)) < 1e-9)
  // Start: the bottom of the run on the left (it reads upward), the top on the right.
  assert.ok(left('start').cy > 100 && right('start').cy < 100)
  assert.equal(left('start').cy + 40, 200 - 1.5 - 8)
  assert.equal(right('start').cy - 40, 1.5 + 8)
  // Centre: half way along either side. End: the other end.
  assert.equal(left('center').cy, 100)
  assert.equal(right('center').cy, 100)
  assert.equal(left('end').cy - 40, 1.5 + 8)
  assert.equal(right('end').cy + 40, 200 - 1.5 - 8)
})

test('the text of a turned label has the height of the side to run along', () => {
  assert.equal(containerLabelRoom('top', box, 1.5), 400 - 3 - 16)
  assert.equal(containerLabelRoom('left', box, 1.5), 200 - 3 - 16)
})
