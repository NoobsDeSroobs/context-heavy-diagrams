// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detailsNoteName, detailsPanelTitle } from './detailsLabels.ts'

const node = (data) => ({ id: 'n', position: { x: 0, y: 0 }, data })

test('the panel title is the first line of the label', () => {
  assert.equal(detailsPanelTitle(node({ label: '  Billing\nsecond line' })), 'Billing')
})

test('a blank label falls back to the details file name, then to Untitled', () => {
  assert.equal(
    detailsPanelTitle(node({ label: '', details: 'details/billing-1.md' })),
    'billing-1.md'
  )
  assert.equal(detailsPanelTitle(node({ label: '', details: 'details\\win.md' })), 'win.md')
  assert.equal(detailsPanelTitle(node({ label: '' })), 'Untitled')
  assert.equal(detailsPanelTitle(undefined), 'Untitled')
})

test('the note name quotes the label, or says "This note"', () => {
  assert.equal(detailsNoteName(node({ label: 'Billing\nx' })), 'Note "Billing"')
  assert.equal(detailsNoteName(node({ label: '' })), 'This note')
  assert.equal(detailsNoteName(undefined), 'This note')
})
