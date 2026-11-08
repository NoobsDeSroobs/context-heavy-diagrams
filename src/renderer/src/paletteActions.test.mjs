// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPaletteActions, filterPaletteActions } from './paletteActions.ts'

const menus = [
  {
    label: 'File',
    items: [
      { label: 'Save', accelerator: 'Ctrl+S', onSelect: () => {} },
      { label: 'Export as PNG…', disabled: true, onSelect: () => {} },
      {
        label: 'Recent Diagrams',
        notInPalette: true,
        submenu: [{ label: 'a.chd', onSelect: () => {} }]
      },
      {
        label: 'New',
        submenu: [
          { label: 'Diagram', onSelect: () => {} },
          { label: 'Metamodel', disabled: true, onSelect: () => {} }
        ]
      }
    ]
  },
  {
    label: 'View',
    items: [{ label: 'Diagnostics (2)', onSelect: () => {} }]
  }
]

test('a disabled item and a submenu marked notInPalette are left out entirely', () => {
  const actions = buildPaletteActions(menus, [])
  assert.deepEqual(
    actions.map((a) => a.title),
    ['Save', 'New: Diagram', 'Diagnostics (2)']
  )
})

test('the leaves of a submenu are listed with the parent in the title', () => {
  const diagram = buildPaletteActions(menus, []).find((a) => a.title === 'New: Diagram')
  assert.equal(diagram?.category, 'File')
})

test('each row carries its menu label as category and the item accelerator as shortcut', () => {
  const [save] = buildPaletteActions(menus, [])
  assert.equal(save.category, 'File')
  assert.equal(save.shortcut, 'Ctrl+S')
})

test('extras are appended after the flattened menu actions', () => {
  const extra = [{ id: 'x', title: 'Select all', category: 'Selection', run: () => {} }]
  const actions = buildPaletteActions(menus, extra)
  assert.equal(actions.at(-1)?.title, 'Select all')
})

test('filter matches on title or category, case-insensitive; blank query keeps everything', () => {
  const actions = buildPaletteActions(menus, [])
  assert.deepEqual(
    filterPaletteActions(actions, 'diagn').map((a) => a.title),
    ['Diagnostics (2)']
  )
  assert.deepEqual(
    filterPaletteActions(actions, 'FILE').map((a) => a.title),
    ['Save', 'New: Diagram']
  )
  assert.equal(filterPaletteActions(actions, '').length, actions.length)
  assert.equal(filterPaletteActions(actions, 'nope').length, 0)
})
