// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagramLevelText, itemLines, reviewSection, summarizeItem, withItNote } from './format.ts'

function item(status, over = {}) {
  return {
    kind: 'node',
    id: 'n1',
    label: 'Orders',
    change: { status, security: false, fields: [] },
    ...over
  }
}

const field = (...lines) => ({ field: 'x', link: false, lines, before: 1, after: 2 })

test('a security change sits under SECURITY whatever its status', () => {
  const change = { status: 'content', security: true, fields: [] }
  assert.equal(reviewSection(item('content', { change })), 'SECURITY')
  assert.equal(reviewSection(item('links')), 'LINKS AND NOTES')
  assert.equal(reviewSection(item('content')), 'MODIFIED')
  assert.equal(reviewSection(item('removed')), 'REMOVED')
  assert.equal(reviewSection(item('added')), 'ADDED')
})

test('the summary is the first line, with a count of the other changed fields', () => {
  const change = {
    status: 'content',
    security: false,
    fields: [field('label: "A" → "B"'), field('x')]
  }
  assert.equal(summarizeItem(item('content', { change })), 'label: "A" → "B" (+1 more)')
  assert.equal(summarizeItem(item('added', { kind: 'edge' })), 'Added connection')
  assert.equal(summarizeItem(item('removed')), 'Removed')
})

test('a line that only introduces the next is joined to it in the summary', () => {
  const change = { status: 'content', security: false, fields: [field('tags:', '+ api')] }
  assert.equal(summarizeItem(item('content', { change })), 'tags: + api')
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
