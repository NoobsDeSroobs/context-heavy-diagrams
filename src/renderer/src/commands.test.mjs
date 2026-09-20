// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMMANDS, acceleratorFor, findKeyCommand, formatKeys } from './commands.ts'

const key = (k, mods = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods
})

test('command ids are unique', () => {
  const ids = COMMANDS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('no two bound commands can match the same key press', () => {
  const seen = new Map()
  for (const { id, binding } of COMMANDS) {
    if (!binding) continue
    // Compare on the tri-state modifiers; an omitted one overlaps both values.
    for (const [otherId, other] of seen) {
      const overlaps = (a, b) => a === undefined || b === undefined || a === b
      if (
        other.key === binding.key &&
        overlaps(other.mod, binding.mod) &&
        overlaps(other.shift, binding.shift)
      ) {
        assert.fail(`${id} and ${otherId} bind overlapping keys`)
      }
    }
    seen.set(id, binding)
  }
})

test('Ctrl+S saves, Ctrl+Shift+S saves as', () => {
  assert.equal(findKeyCommand(key('s', { ctrlKey: true }), false)?.id, 'file.save')
  assert.equal(
    findKeyCommand(key('S', { ctrlKey: true, shiftKey: true }), false)?.id,
    'file.saveAs'
  )
})

test('Ctrl+Z undoes, Ctrl+Shift+Z redoes', () => {
  assert.equal(findKeyCommand(key('z', { metaKey: true }), false)?.id, 'edit.undo')
  assert.equal(findKeyCommand(key('Z', { metaKey: true, shiftKey: true }), false)?.id, 'edit.redo')
})

test('a bare letter matches nothing (mod is required)', () => {
  assert.equal(findKeyCommand(key('s'), false), null)
})

test('text-field-deferring commands are skipped while editing text; others are not', () => {
  assert.equal(findKeyCommand(key('a', { ctrlKey: true }), true), null)
  assert.equal(findKeyCommand(key('c', { ctrlKey: true }), true), null)
  assert.equal(findKeyCommand(key('s', { ctrlKey: true }), true)?.id, 'file.save')
  assert.equal(findKeyCommand(key('f', { ctrlKey: true }), true)?.id, 'search.toggle')
})

test('Escape matches regardless of modifiers and keeps its native default', () => {
  const cmd = findKeyCommand(key('Escape'), false)
  assert.equal(cmd?.id, 'selection.escape')
  assert.equal(cmd?.allowDefault, true)
  assert.equal(findKeyCommand(key('Escape', { shiftKey: true }), false)?.id, 'selection.escape')
})

test('formatting: bindings and display-only entries', () => {
  assert.equal(acceleratorFor('file.saveAs'), 'Ctrl+Shift+S')
  assert.equal(acceleratorFor('view.fit'), 'Ctrl+0')
  assert.equal(acceleratorFor('selection.escape'), 'Esc')
  const follow = COMMANDS.find((c) => c.id === 'links.follow')
  assert.equal(formatKeys(follow), 'Ctrl+Click')
})
