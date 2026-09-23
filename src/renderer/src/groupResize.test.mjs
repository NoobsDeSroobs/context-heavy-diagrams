// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scaleGroupMembers } from './groupResize.ts'

const member = (id, x, y, width, height, minWidth = 40, minHeight = 30) => ({
  id,
  start: { x, y, width, height },
  minWidth,
  minHeight
})
const primary = { x: 0, y: 0, width: 100, height: 50 }

test('right handle: grow and shrink both keep the left edge (no anchor flip)', () => {
  const m = member('a', 10, 20, 200, 80)
  const grow = scaleGroupMembers([m], primary, { x: 0, y: 0, width: 150, height: 50 })
  assert.deepEqual(grow.get('a'), { x: 10, y: 20, width: 300, height: 80 })
  const shrink = scaleGroupMembers([m], primary, { x: 0, y: 0, width: 50, height: 50 })
  assert.deepEqual(shrink.get('a'), { x: 10, y: 20, width: 100, height: 80 })
})

test('left/top handle: the far edge stays fixed whether growing or shrinking', () => {
  const m = member('a', 10, 20, 200, 80)
  const grow = scaleGroupMembers([m], primary, { x: -50, y: -50, width: 150, height: 100 })
  assert.deepEqual(grow.get('a'), { x: -90, y: -60, width: 300, height: 160 })
  const shrink = scaleGroupMembers([m], primary, { x: 50, y: 0, width: 50, height: 50 })
  assert.deepEqual(shrink.get('a'), { x: 110, y: 20, width: 100, height: 80 })
})

test('a member stops at its own minimum and recovers when the pointer comes back', () => {
  const m = member('a', 0, 0, 60, 60, 40, 30)
  const shrunk = scaleGroupMembers([m], primary, { x: 0, y: 0, width: 10, height: 50 })
  assert.equal(shrunk.get('a').width, 40)
  const back = scaleGroupMembers([m], primary, { x: 0, y: 0, width: 100, height: 50 })
  assert.equal(back.get('a').width, 60)
})
