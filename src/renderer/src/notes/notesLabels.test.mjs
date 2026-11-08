// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { noteName, noteSaveState, notesPanelTitle } from './notesLabels.ts'

const node = (data) => ({ id: 'n', position: { x: 0, y: 0 }, data })

test('the panel title is the first line of the label', () => {
  assert.equal(notesPanelTitle(node({ label: '  Billing\nsecond line' })), 'Billing')
})

test('a blank label falls back to the note name, then to Untitled', () => {
  assert.equal(notesPanelTitle(node({ label: '', notes: 'notes/billing-1.md' })), 'billing-1.md')
  assert.equal(notesPanelTitle(node({ label: '', notes: 'details\\win.md' })), 'win.md')
  assert.equal(notesPanelTitle(node({ label: '' })), 'Untitled')
  assert.equal(notesPanelTitle(undefined), 'Untitled')
})

test('the note name quotes the label, or says "This note"', () => {
  assert.equal(noteName(node({ label: 'Billing\nx' })), 'Note "Billing"')
  assert.equal(noteName(node({ label: '' })), 'This note')
  assert.equal(noteName(undefined), 'This note')
})

test('a note is unsaved with edits, saved when the file is what the panel shows, else nothing', () => {
  const shadow = (over) => ({ originalPath: 'notes/a.md', dirty: false, ...over })
  assert.equal(noteSaveState(shadow({ dirty: true })), 'unsaved')
  assert.equal(noteSaveState(shadow({ dirty: true, originalPath: null })), 'unsaved')
  assert.equal(noteSaveState(shadow({})), 'saved')
  assert.equal(noteSaveState(shadow({ originalPath: null })), null)
  assert.equal(noteSaveState(undefined), null)
})
