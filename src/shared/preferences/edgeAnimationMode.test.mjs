// Run with `npm test`. Whether animated edges move (ADR 0141): the person's own choice wins over the
// system's reduced-motion setting, which only decides the default.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PREFERENCES,
  edgeAnimationIsOn,
  normalizePreferences,
  readEdgeAnimationMode
} from './preferences.ts'

test('the default follows the system', () => {
  assert.equal(DEFAULT_PREFERENCES.animateEdges, 'system')
  assert.equal(edgeAnimationIsOn('system', false), true)
  assert.equal(edgeAnimationIsOn('system', true), false)
})

test('an explicit choice wins over the system in both directions', () => {
  for (const reduced of [false, true]) {
    assert.equal(edgeAnimationIsOn('on', reduced), true, `on, reduced=${reduced}`)
    assert.equal(edgeAnimationIsOn('off', reduced), false, `off, reduced=${reduced}`)
  }
})

test('the boolean stored before 0.5.1 is read as a mode', () => {
  // A false was always a choice. A true was the default, written back with every other preference,
  // so it says nothing about what the person chose and must not override the system.
  assert.equal(readEdgeAnimationMode(false), 'off')
  assert.equal(readEdgeAnimationMode(true), 'system')
  for (const mode of ['system', 'on', 'off']) assert.equal(readEdgeAnimationMode(mode), mode)
  for (const junk of [undefined, null, 'maybe', 1, {}]) {
    assert.equal(readEdgeAnimationMode(junk), 'system', String(junk))
  }
})

test('every point that receives preferences reads the old boolean and fills in the default', () => {
  assert.equal(normalizePreferences({ animateEdges: false }).animateEdges, 'off')
  assert.equal(normalizePreferences({ animateEdges: true }).animateEdges, 'system')
  assert.equal(normalizePreferences({ animateEdges: 'on' }).animateEdges, 'on')
  assert.equal(normalizePreferences({}).animateEdges, 'system')
  // and it is idempotent: a normalized blob normalizes to itself
  const once = normalizePreferences({ animateEdges: false })
  assert.equal(normalizePreferences(once).animateEdges, 'off')
})
