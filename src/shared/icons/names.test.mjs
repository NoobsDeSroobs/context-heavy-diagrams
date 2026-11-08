// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iconName, namedIcons } from './names.ts'

test('a built-in icon is named by its id, a custom one by its file name', () => {
  assert.equal(iconName({ source: 'builtin', id: 'shield-lock' }), 'shield-lock')
  assert.equal(iconName({ source: 'custom', path: 'assets/icons/lock.svg' }), 'lock.svg')
  assert.equal(iconName({ source: 'custom', path: 'assets\\icons\\win.png' }), 'win.png')
})

test('icons are listed in the order they are drawn, whatever order they were stored in', () => {
  const icons = {
    bottomRight: { source: 'builtin', id: 'cloud' },
    topLeft: { source: 'builtin', id: 'server' },
    bottomLeft: { source: 'custom', path: 'assets/own.svg' }
  }
  assert.deepEqual(namedIcons(icons), [
    { where: 'top left', name: 'server' },
    { where: 'bottom left', name: 'own.svg' },
    { where: 'bottom right', name: 'cloud' }
  ])
  assert.deepEqual(namedIcons(undefined), [])
  assert.deepEqual(namedIcons({}), [])
})
