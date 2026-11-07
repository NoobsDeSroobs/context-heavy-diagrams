// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeLines, diagramLevelText, itemLines, reviewSection, withItNote } from './format.ts'

function item(status, over = {}) {
  return {
    kind: 'node',
    id: 'n1',
    label: 'Orders',
    change: { status, security: false, fields: [] },
    ...over
  }
}

const field = (...lines) => ({ field: 'x', category: 'content', lines, before: 1, after: 2 })

test('a security change sits under SECURITY whatever its status', () => {
  const change = { status: 'content', security: true, fields: [] }
  assert.equal(reviewSection(item('content', { change })), 'SECURITY')
  assert.equal(reviewSection(item('links')), 'LINKS AND NOTES')
  assert.equal(reviewSection(item('content')), 'MODIFIED')
  assert.equal(reviewSection(item('removed')), 'REMOVED')
  assert.equal(reviewSection(item('added')), 'ADDED')
})

test('a row lists every changed line, one under the other', () => {
  const change = {
    status: 'content',
    security: false,
    fields: [
      field('tags:', '+ api'),
      { ...field('border colour: #111111 → #222222'), field: 'border colour' },
      { ...field('border width: 2 → 3'), field: 'border width' }
    ]
  }
  assert.deepEqual(changeLines(item('content', { change })), [
    'tags:',
    '+ api',
    'border colour: #111111 → #222222',
    'border width: 2 → 3'
  ])
  assert.deepEqual(changeLines(item('added', { kind: 'edge' })), ['Added connection'])
  assert.deepEqual(changeLines(item('removed')), ['Removed'])
})

test('a long list in a row is cut with a count', () => {
  const fields = Array.from({ length: 12 }, (_, i) => field(`line ${i}`))
  const lines = changeLines(
    item('content', { change: { status: 'content', security: false, fields } })
  )
  assert.equal(lines.length, 8)
  assert.equal(lines.at(-1), '…and 5 more lines')
})

test('connections that came or went with an element are counted in its direction', () => {
  const connections = [item('removed', { kind: 'edge', id: 'e1', label: 'A → B' })]
  assert.equal(withItNote(item('removed', { connections })), '1 connection removed with it')
  assert.equal(withItNote(item('added', { connections })), '1 connection added with it')
})

test('the text of an item lists its fields and at most eight connections', () => {
  const connections = Array.from({ length: 10 }, (_, i) =>
    item('added', { kind: 'edge', id: `e${i}`, label: `edge ${i}` })
  )
  const change = { status: 'added', security: false, fields: [field('type: service')] }
  const lines = itemLines(item('added', { change, connections }))
  assert.equal(lines[0], '  element "Orders" (10 connections added with it)')
  assert.equal(lines[1], '    type: service')
  assert.equal(lines.length, 1 + 1 + 8 + 1)
  assert.equal(lines.at(-1), '    - …and 2 more')
})

test('a diagram-level change reads the same for a list and a setting', () => {
  const list = { name: 'Palette', added: ['Teal'], removed: ['Red'], changed: ['Blue'] }
  assert.equal(diagramLevelText(list), 'Palette: +Teal −Red ~Blue')
  const setting = {
    ...list,
    added: [],
    removed: [],
    changed: [],
    setting: { before: '10', after: '20' }
  }
  assert.equal(diagramLevelText(setting), 'Palette: 10 → 20')
})
