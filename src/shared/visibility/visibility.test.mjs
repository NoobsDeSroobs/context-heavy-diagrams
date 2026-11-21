// Run with `npm test`. The visibility rule of ADR 0194.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isShown, newSetId, shownFilter, withSet, withoutSet } from './visibility.ts'

const catalogue = [
  { id: 'today', name: 'Today' },
  { id: 'proposed', name: 'Proposed' }
]
const hide = (...ids) => new Set(ids)

test('an element in no set is always shown, whatever is hidden', () => {
  const shown = shownFilter(catalogue, hide('today', 'proposed'))
  assert.equal(shown(undefined), true)
  assert.equal(shown([]), true)
})

test('an element in one set follows that set', () => {
  const shown = shownFilter(catalogue, hide('today'))
  assert.equal(shown(['today']), false)
  assert.equal(shown(['proposed']), true)
})

test('an element in several sets is shown while any of them is shown', () => {
  assert.equal(shownFilter(catalogue, hide('today'))(['today', 'proposed']), true)
  assert.equal(shownFilter(catalogue, hide('proposed'))(['today', 'proposed']), true)
  assert.equal(shownFilter(catalogue, hide('today', 'proposed'))(['today', 'proposed']), false)
})

test('an id that is not in the catalogue is ignored, so it can hide nothing', () => {
  const shown = shownFilter(catalogue, hide('gone', 'today'))
  assert.equal(shown(['gone']), true)
  // an unknown id next to a hidden set does not keep the element on show either
  assert.equal(shown(['gone', 'today']), false)
})

test('with nothing hidden every element is shown', () => {
  const shown = shownFilter(catalogue, hide())
  assert.equal(shown(['today']), true)
  assert.equal(shown(['today', 'proposed']), true)
})

test('isShown is the rule behind the filter', () => {
  const known = new Set(['a', 'b'])
  assert.equal(isShown(['a'], known, new Set(['a'])), false)
  assert.equal(isShown(['a', 'b'], known, new Set(['a'])), true)
  assert.equal(isShown(undefined, known, new Set(['a'])), true)
})

test('joining a set adds it once, leaving removes it and gives nothing when it was the last', () => {
  assert.deepEqual(withSet(undefined, 'a'), ['a'])
  assert.deepEqual(withSet(['a'], 'a'), ['a'])
  assert.deepEqual(withSet(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(withoutSet(['a', 'b'], 'a'), ['b'])
  assert.equal(withoutSet(['a'], 'a'), undefined)
  assert.equal(withoutSet(undefined, 'a'), undefined)
})

test('a new id is not one already in the catalogue', () => {
  const id = newSetId(catalogue)
  assert.match(id, /^vis-/)
  assert.equal(
    catalogue.some((s) => s.id === id),
    false
  )
})
