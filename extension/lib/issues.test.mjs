// Run with `npm test`. How problems and warnings are grouped for the assistant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupMessages } from './issues.mjs'

test('a few problems of a kind are listed as they are', () => {
  const lines = groupMessages([
    { kind: 'label-room', message: 'edge a is tight', ids: ['a'] },
    { kind: 'overlap', message: 'b overlaps c', ids: ['b', 'c'] },
    { kind: 'label-room', message: 'edge d is tight', ids: ['d'] }
  ])
  assert.deepEqual(lines, ['edge a is tight', 'edge d is tight', 'b overlaps c'])
})

test('many problems of a kind become one line with the count, three examples and the elements', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    kind: 'label-room',
    message: `edge e${i} is tight`,
    ids: [`e${i}`]
  }))
  const [line, ...rest] = groupMessages([...items, { kind: 'overlap', message: 'x', ids: [] }])
  assert.equal(rest.length, 1)
  assert.match(
    line,
    /^label-room ×12: edge e0 is tight; edge e1 is tight; edge e2 is tight; and 9 more \(elements: e0, e1, e2, e3,/
  )
  assert.ok(line.length < 400, 'the elements listed are capped')
})

test('warnings without a kind are grouped when they differ only in names and numbers', () => {
  const warnings = [
    ...Array.from(
      { length: 5 },
      (_, i) => `node 'n${i}' points to 'x/${i}.chd' which does not exist`
    ),
    'something else entirely'
  ]
  const lines = groupMessages(warnings)
  assert.equal(lines.length, 2)
  assert.match(
    lines[0],
    /^×5: node 'n0' points to 'x\/0\.chd' which does not exist; .*; and 2 more$/
  )
  assert.equal(lines[1], 'something else entirely')
})
