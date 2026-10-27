// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewTextChange, sameText } from './textPreview.ts'

test('line endings alone are not a change', () => {
  assert.equal(sameText('a\r\nb\r\n', 'a\nb\n'), true)
  assert.equal(sameText('a\nb', 'a\nc'), false)
})

test('shows the lines that differ, removed first, and skips the shared start and end', () => {
  const before = '# Title\nowner: team a\nSome text\nend'
  const after = '# Title\nowner: team b\nSome text\nend'
  assert.deepEqual(previewTextChange(before, after), ['− owner: team a', '+ owner: team b'])
})

test('an added or removed block shows only that side', () => {
  assert.deepEqual(previewTextChange('one\ntwo', 'one\ntwo\nthree\nfour'), ['+ three', '+ four'])
  assert.deepEqual(previewTextChange('one\ntwo\nthree', 'one'), ['− two', '− three'])
})

test('a long change is cut to a few lines with a count of the rest', () => {
  const before = 'keep'
  const after = ['keep', ...Array.from({ length: 10 }, (_, i) => `line ${i}`)].join('\n')
  const preview = previewTextChange(before, after, 6)
  assert.equal(preview.length, 7)
  assert.equal(preview[0], '+ line 0')
  assert.equal(preview[6], '… 4 more changed lines')
})

test('a long line is clipped and blank lines are not shown', () => {
  const preview = previewTextChange('a', `a\n\n${'x'.repeat(200)}`)
  assert.equal(preview.length, 1)
  assert.ok(preview[0].length <= 82)
  assert.ok(preview[0].endsWith('…'))
})
