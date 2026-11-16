// Run with `npm test`. File names made from labels (ADR 0074, ADR 0179).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstFreeName, labelToFileStem, truncateStem } from './labelFileName.ts'

const bytes = (s) => Buffer.byteLength(s, 'utf8')

test('spaces and Norwegian letters are kept, forbidden characters become "-"', () => {
  assert.equal(labelToFileStem('Brannvern på Åsgård', 'x'), 'Brannvern på Åsgård')
  assert.equal(labelToFileStem('A/B: "c"', 'x'), 'A-B- -c-')
})

test('a leading dot is kept, a trailing dot is not, an empty label falls back', () => {
  assert.equal(labelToFileStem('.NET', 'x'), '.NET')
  assert.equal(labelToFileStem('End.', 'x'), 'End')
  assert.equal(labelToFileStem('..', 'fallback'), 'fallback')
})

test('Windows reserved names are prefixed', () => {
  assert.equal(labelToFileStem('CON', 'x'), '_CON')
})

test('ASCII is cut at 60 characters', () => {
  assert.equal(labelToFileStem('x'.repeat(100), 'x'), 'x'.repeat(60))
})

test('multi-byte text is cut at 200 bytes, never inside a character', () => {
  const emoji = labelToFileStem('😀'.repeat(100), 'x')
  assert.equal(emoji, '😀'.repeat(50))
  assert.equal(bytes(emoji), 200)
  const cjk = labelToFileStem('あ'.repeat(100), 'x')
  assert.equal([...cjk].length, 60)
  assert.equal(bytes(cjk), 180)
  assert.equal(labelToFileStem('å'.repeat(100), 'x'), 'å'.repeat(60))
})

test('a note name from the longest stem stays under 255 bytes', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000'
  const name = `${truncateStem('😀'.repeat(100))}-${uuid}.md`
  assert.ok(bytes(name) <= 255, `${bytes(name)} bytes`)
})

test('a cut that lands on a space or dot drops it', () => {
  assert.equal(labelToFileStem(`${'x'.repeat(59)} y`, 'x'), 'x'.repeat(59))
})

test('first free name compares what the caller compares', () => {
  const taken = new Set(['foo.chd', 'foo-1.chd'])
  const isTaken = (name) => taken.has(name.toLowerCase())
  assert.equal(firstFreeName('Foo', '.chd', isTaken), 'Foo-2.chd')
  assert.equal(firstFreeName('Bar', '.chd', isTaken), 'Bar.chd')
})
