// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PEEK_CARD_MAX_HEIGHT,
  PEEK_CARD_WIDTH,
  clampPeekSize,
  peekNoteCharCap
} from './peekCard.ts'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences.ts'

test('a size is kept inside its range, and a bad value falls back to the default', () => {
  assert.equal(clampPeekSize(500, PEEK_CARD_WIDTH), 500)
  assert.equal(clampPeekSize(5, PEEK_CARD_WIDTH), 240)
  assert.equal(clampPeekSize(5000, PEEK_CARD_WIDTH), 800)
  assert.equal(clampPeekSize(300.6, PEEK_CARD_WIDTH), 301)
  assert.equal(clampPeekSize(undefined, PEEK_CARD_MAX_HEIGHT), 260)
  assert.equal(clampPeekSize('wide', PEEK_CARD_MAX_HEIGHT), 260)
  assert.equal(clampPeekSize(NaN, PEEK_CARD_MAX_HEIGHT), 260)
})

test('the note cap is 1200 characters at the default size and grows with the area', () => {
  assert.equal(peekNoteCharCap(340, 260), 1200)
  assert.equal(peekNoteCharCap(680, 260), 2400)
  assert.ok(peekNoteCharCap(240, 120) < 1200)
})

test('preferences without the sizes get the defaults, and stored ones are clamped', () => {
  assert.equal(normalizePreferences({}).peekCardWidth, 340)
  assert.equal(normalizePreferences({}).peekCardMaxHeight, 260)
  assert.equal(DEFAULT_PREFERENCES.peekCardWidth, 340)
  const stored = normalizePreferences({ peekCardWidth: 9999, peekCardMaxHeight: 3 })
  assert.equal(stored.peekCardWidth, 800)
  assert.equal(stored.peekCardMaxHeight, 120)
})
