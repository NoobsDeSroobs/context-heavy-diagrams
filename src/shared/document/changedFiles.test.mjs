// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HUB_FILE_KEY, changedFiles, changedFilesMessage, reloadWarning } from './changedFiles.ts'

const hub = {
  key: HUB_FILE_KEY,
  relPath: null,
  baselineStamp: '1:1',
  label: 'shop.chd',
  dirty: false
}
const note = (over = {}) => ({
  key: 'n1',
  relPath: 'notes/A.md',
  baselineStamp: '1:1',
  label: 'A.md',
  dirty: false,
  ...over
})

test('only the files that changed are listed, with their dirty flag', () => {
  const list = changedFiles(
    [hub, note(), note({ key: 'n2', label: 'B.md', dirty: true })],
    [
      { changed: false, stamp: '1:1' },
      { changed: true, stamp: '2:2' },
      { changed: true, stamp: '3:3' }
    ],
    {}
  )
  assert.deepEqual(list, [
    { key: 'n1', label: 'A.md', stamp: '2:2', dirty: false },
    { key: 'n2', label: 'B.md', stamp: '3:3', dirty: true }
  ])
})

test('a change the person ignored is not announced again, a later one is', () => {
  const checks = [{ changed: true, stamp: '2:2' }]
  assert.deepEqual(changedFiles([hub], checks, { [HUB_FILE_KEY]: '2:2' }), [])
  assert.equal(changedFiles([hub], checks, { [HUB_FILE_KEY]: '1:9' }).length, 1)
})

test('a missing check result is not a change', () => {
  assert.deepEqual(changedFiles([hub, note()], [{ changed: true, stamp: '2:2' }], {}).length, 1)
})

test('the message names every file and says which have unsaved edits', () => {
  const files = [
    { key: 'hub', label: 'shop.chd', stamp: '2:2', dirty: false },
    { key: 'n1', label: 'A.md', stamp: '2:2', dirty: true }
  ]
  assert.equal(
    changedFilesMessage(files),
    'Changed outside the app: shop.chd, A.md. You have unsaved edits to A.md.'
  )
  assert.equal(changedFilesMessage([files[0]]), 'Changed outside the app: shop.chd.')
})

test('reload asks only when something unsaved would be lost', () => {
  assert.equal(reloadWarning([{ key: 'hub', label: 'shop.chd', stamp: '1', dirty: false }]), null)
  assert.match(
    reloadWarning([
      { key: 'hub', label: 'shop.chd', stamp: '1', dirty: true },
      { key: 'n1', label: 'A.md', stamp: '1', dirty: true }
    ]),
    /shop\.chd, A\.md/
  )
})
