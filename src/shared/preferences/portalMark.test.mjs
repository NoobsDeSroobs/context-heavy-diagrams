import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences.ts'

test('the portal mark is a tilde unless the person chose the oval', () => {
  assert.equal(DEFAULT_PREFERENCES.portalMark, 'tilde')
  assert.equal(normalizePreferences({}).portalMark, 'tilde')
  assert.equal(normalizePreferences({ portalMark: 'oval' }).portalMark, 'oval')
  // Anything else is read as the default, whatever a newer or hand-edited file holds.
  assert.equal(normalizePreferences({ portalMark: 'star' }).portalMark, 'tilde')
})
