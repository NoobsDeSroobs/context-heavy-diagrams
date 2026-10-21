// Run with `npm test`. A font an element uses must always be selectable in the
// Family dropdown, whether or not the active palette lists it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withStoredFonts } from './fontOptions.ts'

const base = [
  { value: '', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'Georgia', label: 'Georgia' }
]

test('a stored font that is not offered is added, under its own heading', () => {
  const result = withStoredFonts(base, ['Verdana'])
  assert.deepEqual(result.at(-1), {
    value: 'Verdana',
    label: 'Verdana',
    group: 'In use, not in your palette'
  })
  assert.equal(result.length, base.length + 1)
})

test('a stored font that is already offered is not added again', () => {
  assert.deepEqual(withStoredFonts(base, ['Georgia', 'serif']), base)
})

test('unset and empty fonts add nothing', () => {
  assert.deepEqual(withStoredFonts(base, [undefined, '']), base)
})

test('the same unknown font on several elements is added once', () => {
  const result = withStoredFonts(base, ['Verdana', 'Verdana', undefined, 'Verdana'])
  assert.equal(result.filter((o) => o.value === 'Verdana').length, 1)
})

test('a font stack is kept exactly as stored', () => {
  const stack = '"Times New Roman", Times, serif'
  assert.equal(withStoredFonts(base, [stack]).at(-1)?.value, stack)
})

test('the original options are not changed', () => {
  const copy = structuredClone(base)
  withStoredFonts(base, ['Verdana'])
  assert.deepEqual(base, copy)
})
