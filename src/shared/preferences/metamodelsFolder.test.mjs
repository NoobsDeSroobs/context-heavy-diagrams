// Run with `npm test`. The metamodels folder was called profilesFolder before the rename (ADR 0144):
// a stored choice must survive it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePreferences } from './preferences.ts'

test('a folder stored as profilesFolder is read as metamodelsFolder and the old key is dropped', () => {
  const read = normalizePreferences({ profilesFolder: '/rules' })
  assert.equal(read.metamodelsFolder, '/rules')
  assert.ok(!('profilesFolder' in read))
})

test('the new key wins when both are stored', () => {
  const read = normalizePreferences({ profilesFolder: '/old', metamodelsFolder: '/new' })
  assert.equal(read.metamodelsFolder, '/new')
})

test('no stored folder stays unset, which means the default folder', () => {
  assert.equal(normalizePreferences({}).metamodelsFolder, undefined)
})
