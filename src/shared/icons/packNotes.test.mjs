// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPackNotes, usedPackNames } from './packNotes.ts'

const pack = (name, meta = {}, extra = {}) => ({
  folder: name,
  meta: { name, description: '', ifMissing: '', version: '', ...meta },
  subsets: [],
  iconCount: 0,
  duplicateOf: null,
  problems: [],
  ...extra
})

test('the used packs are each named once, in name order, from installed references only', () => {
  const icons = [
    { source: 'installed', pack: 'Zed', path: 'A/a.svg' },
    { source: 'builtin', id: 'user' },
    { source: 'installed', pack: 'AWS', path: 'A/a.svg' },
    { source: 'installed', pack: 'Zed', path: 'A/b.svg' },
    { source: 'custom', path: 'assets/x.svg' },
    undefined
  ]
  assert.deepEqual(usedPackNames(icons), ['AWS', 'Zed'])
  assert.deepEqual(usedPackNames([]), [])
})

test('an installed pack gives its own version and text, and leaves out what it has not', () => {
  const notes = buildPackNotes(
    ['AWS', 'Plain'],
    [pack('AWS', { version: '2.1', ifMissing: 'Get it from IT.' }), pack('Plain')]
  )
  assert.deepEqual(notes, [
    { name: 'AWS', version: '2.1', ifMissing: 'Get it from IT.' },
    { name: 'Plain' }
  ])
})

test('a pack that is not installed keeps the note the file had, and a new one gets a bare name', () => {
  const previous = [{ name: 'AWS', version: '1.0', ifMissing: 'Get it from IT.' }]
  assert.deepEqual(buildPackNotes(['AWS', 'Other'], [], previous), [
    { name: 'AWS', version: '1.0', ifMissing: 'Get it from IT.' },
    { name: 'Other' }
  ])
})

test('an installed pack refreshes the note, and a pack the diagram stopped using is dropped', () => {
  const previous = [
    { name: 'AWS', version: '1.0', ifMissing: 'Old text.' },
    { name: 'Gone', ifMissing: 'No longer used.' }
  ]
  assert.deepEqual(buildPackNotes(['AWS'], [pack('AWS', { version: '2.0' })], previous), [
    { name: 'AWS', version: '2.0' }
  ])
})

test('a second folder that gives a pack the same name is not the pack', () => {
  const installed = [
    pack('AWS', { version: '2.0' }, { folder: 'AWS' }),
    pack('AWS', { version: '9.9' }, { folder: 'AWS copy', duplicateOf: 'AWS' })
  ]
  assert.deepEqual(buildPackNotes(['AWS'], installed), [{ name: 'AWS', version: '2.0' }])
  assert.deepEqual(buildPackNotes(['AWS'], [installed[1]], [{ name: 'AWS', version: '1.0' }]), [
    { name: 'AWS', version: '1.0' }
  ])
})
