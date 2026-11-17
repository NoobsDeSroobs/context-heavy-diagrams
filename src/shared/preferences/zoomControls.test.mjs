import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences.ts'

test('the zoom buttons are hidden unless the person asked for them', () => {
  assert.equal(DEFAULT_PREFERENCES.showZoomControls, false)
  assert.equal(normalizePreferences({}).showZoomControls, false)
  assert.equal(normalizePreferences({ showZoomControls: true }).showZoomControls, true)
  assert.equal(normalizePreferences({ showZoomControls: 'yes' }).showZoomControls, false)
})
