import test from 'node:test'
import assert from 'node:assert/strict'
import { changelogSection } from './changelog-section.mjs'

const log = [
  '# Changelog',
  '',
  'Intro.',
  '',
  '## 0.4.0 (2026-11-03)',
  '### Added',
  '- one',
  '',
  '## 0.3.0 (2026-10-26)',
  '- old'
].join('\r\n')

test('returns the text between a version heading and the next one', () => {
  assert.equal(changelogSection(log, '0.4.0'), '### Added\n- one')
  assert.equal(changelogSection(log, '0.3.0'), '- old')
})

test('returns null for a version with no section, and does not match a prefix', () => {
  assert.equal(changelogSection(log, '0.5.0'), null)
  assert.equal(changelogSection(log, '0.4'), null)
})
