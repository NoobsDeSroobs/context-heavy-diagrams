// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windowTitle } from './windowTitle.ts'

test('the title is the file name and the app name', () => {
  assert.equal(windowTitle('D:\\work\\shop.chd', false), 'shop.chd — Context-Heavy Diagrams')
  assert.equal(windowTitle('/home/me/shop.chd', false), 'shop.chd — Context-Heavy Diagrams')
})

test('unsaved changes put a dot in front', () => {
  assert.equal(windowTitle('/home/me/shop.chd', true), '• shop.chd — Context-Heavy Diagrams')
})

test('a diagram that was never saved is Untitled', () => {
  assert.equal(windowTitle(null, false), 'Untitled — Context-Heavy Diagrams')
  assert.equal(windowTitle(null, true), '• Untitled — Context-Heavy Diagrams')
})
