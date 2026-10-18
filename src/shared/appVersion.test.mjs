// Run with `npm test`. The rules behind the "saved with a newer version" warning (ADR 0118).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareVersions,
  isNewerThanApp,
  newerFileMessage,
  parseVersion,
  stampSavedWith
} from './appVersion.ts'

test('reads three-part versions, ignoring a pre-release or build suffix', () => {
  assert.deepEqual(parseVersion('0.2.1'), [0, 2, 1])
  assert.deepEqual(parseVersion('10.20.30'), [10, 20, 30])
  assert.deepEqual(parseVersion('1.0.0-beta.2'), [1, 0, 0])
  assert.deepEqual(parseVersion('1.0.0+build5'), [1, 0, 0])
  assert.deepEqual(parseVersion(' 0.2.1 '), [0, 2, 1])
})

test('anything else is unknown', () => {
  for (const bad of ['', '1', '1.2', 'v1.2.3', '1.2.x', 'newer', null, undefined, 3, {}]) {
    assert.equal(parseVersion(bad), null, String(bad))
  }
})

test('compares major, then minor, then patch', () => {
  assert.ok(compareVersions([1, 0, 0], [0, 9, 9]) > 0)
  assert.ok(compareVersions([0, 3, 0], [0, 2, 9]) > 0)
  assert.ok(compareVersions([0, 2, 2], [0, 2, 1]) > 0)
  assert.ok(compareVersions([0, 2, 1], [0, 2, 2]) < 0)
  assert.equal(compareVersions([0, 2, 1], [0, 2, 1]), 0)
})

test('warns for a newer file in ANY part, including only the patch', () => {
  assert.equal(isNewerThanApp('1.0.0', '0.2.1'), true)
  assert.equal(isNewerThanApp('0.3.0', '0.2.1'), true)
  assert.equal(isNewerThanApp('0.2.2', '0.2.1'), true)
})

test('never warns for the same version, an older one, or an unknown one', () => {
  assert.equal(isNewerThanApp('0.2.1', '0.2.1'), false)
  assert.equal(isNewerThanApp('0.2.0', '0.2.1'), false)
  assert.equal(isNewerThanApp('0.1.9', '0.2.1'), false)
  assert.equal(isNewerThanApp(undefined, '0.2.1'), false)
  assert.equal(isNewerThanApp('garbage', '0.2.1'), false)
  assert.equal(isNewerThanApp('0.9.0', 'not-a-version'), false)
})

test('a file with no marker is stamped with the saving app', () => {
  assert.equal(stampSavedWith(undefined, '0.2.1'), '0.2.1')
  assert.equal(stampSavedWith('garbage', '0.2.1'), '0.2.1')
})

test('an older marker is replaced by a newer app, but only then', () => {
  assert.equal(stampSavedWith('0.1.0', '0.2.1'), '0.2.1')
  assert.equal(stampSavedWith('0.2.1', '0.2.1'), '0.2.1')
})

test('an older app never lowers the marker of a newer file', () => {
  assert.equal(stampSavedWith('0.4.0', '0.2.1'), '0.4.0')
  assert.equal(stampSavedWith('0.2.2', '0.2.1'), '0.2.2')
})

test('the warning names both versions, the risk, and what to do', () => {
  const text = newerFileMessage('0.4.0', '0.2.1', 'https://example.org/project')
  assert.match(text, /newer version/)
  assert.match(text, /0\.4\.0/)
  assert.match(text, /You are using 0\.2\.1/)
  assert.match(text, /can be lost/)
  assert.match(text, /https:\/\/example\.org\/project/)
  assert.match(text, /Save As/)
})
