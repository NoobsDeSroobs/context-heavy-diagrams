// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UTILITY_DOCK_WIDTH, clampDockWidth } from './panelWidth.ts'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences.ts'

test('a width is kept inside its range, and a bad value falls back to the default', () => {
  assert.equal(clampDockWidth(500), 500)
  assert.equal(clampDockWidth(10), 280)
  assert.equal(clampDockWidth(5000), 900)
  assert.equal(clampDockWidth(400.4), 400)
  assert.equal(clampDockWidth(undefined), 360)
  assert.equal(clampDockWidth('wide'), 360)
  assert.equal(clampDockWidth(NaN), 360)
})

test('preferences without a width get the default, and a stored one is clamped', () => {
  assert.equal(DEFAULT_PREFERENCES.utilityDockWidth, UTILITY_DOCK_WIDTH.default)
  assert.equal(normalizePreferences({}).utilityDockWidth, 360)
  assert.equal(normalizePreferences({ utilityDockWidth: 10 }).utilityDockWidth, 280)
  assert.equal(normalizePreferences({ utilityDockWidth: 9999 }).utilityDockWidth, 900)
  assert.equal(normalizePreferences({ utilityDockWidth: 'x' }).utilityDockWidth, 360)
})
