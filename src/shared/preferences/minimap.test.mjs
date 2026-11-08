// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences.ts'

test('the minimap is shown unless the person turned it off', () => {
  assert.equal(DEFAULT_PREFERENCES.showMinimap, true)
  assert.equal(normalizePreferences({}).showMinimap, true)
  assert.equal(normalizePreferences({ showMinimap: false }).showMinimap, false)
  assert.equal(normalizePreferences({ showMinimap: true }).showMinimap, true)
})
