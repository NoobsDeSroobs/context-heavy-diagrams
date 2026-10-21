// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AI_INSTRUCTIONS } from './aiInstructions.ts'

// Guards the invariants the text exists to teach, and keeps it "small" — a
// paste that runs to pages defeats the purpose (see ADR 0104).
test('AI instructions cover the format traps and stay short', () => {
  for (const needle of [
    'parentId',
    'EARLIER',
    'relative to its parent',
    'absolute canvas',
    'relative to the .chd file',
    'savedWith'
  ]) {
    assert.ok(AI_INSTRUCTIONS.includes(needle), `missing: ${needle}`)
  }
  assert.ok(AI_INSTRUCTIONS.length < 4000)
})
