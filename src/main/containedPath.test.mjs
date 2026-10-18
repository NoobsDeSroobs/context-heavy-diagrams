// Run with `npm test`. Covers the "stays inside the diagram's folder" rule that
// guards every write, copy-from and delete of a path stored in a diagram (ADR 0115).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { containedPath } from './containedPath.ts'

const base = resolve('work', 'diagrams')

test('resolves an ordinary relative path inside the folder', () => {
  assert.equal(containedPath(base, 'd/details/A.md'), join(base, 'd', 'details', 'A.md'))
})

test('accepts backslash separators on any OS', () => {
  assert.equal(containedPath(base, 'd\\details\\A.md'), join(base, 'd', 'details', 'A.md'))
})

test('allows ".." as long as the result stays inside', () => {
  assert.equal(containedPath(base, 'd/details/../details/A.md'), join(base, 'd', 'details', 'A.md'))
})

test('refuses a path that climbs out of the folder', () => {
  assert.equal(containedPath(base, '../victim.txt'), null)
  assert.equal(containedPath(base, 'd/../../victim.txt'), null)
  assert.equal(containedPath(base, '..\\..\\Documents\\report.docx'), null)
  assert.equal(containedPath(base, '..'), null)
})

test('refuses absolute paths', () => {
  assert.equal(containedPath(base, resolve('somewhere', 'else.md')), null)
  assert.equal(containedPath(base, '/etc/passwd'), null)
})

test('refuses an empty path and the folder itself', () => {
  assert.equal(containedPath(base, ''), null)
  assert.equal(containedPath(base, '.'), null)
  assert.equal(containedPath(base, 'd/..'), null)
})

test('a name that merely starts with two dots is fine', () => {
  assert.equal(containedPath(base, '..notes/A.md'), join(base, '..notes', 'A.md'))
})

test(
  'on Windows, refuses drive-relative and stream paths',
  { skip: process.platform !== 'win32' },
  () => {
    assert.equal(containedPath(base, 'C:secret.txt'), null)
    assert.equal(containedPath(base, 'note.md:stream'), null)
  }
)
