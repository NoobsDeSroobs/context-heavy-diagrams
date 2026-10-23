import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveDiagramFont, fontStackFor, primaryFamily } from './fontStack.ts'

test('a font picked by name becomes a quoted stack with a guessed generic fallback', () => {
  assert.equal(fontStackFor('Arial'), "'Arial', sans-serif")
  assert.equal(fontStackFor('Georgia'), "'Georgia', serif")
  assert.equal(fontStackFor('Noto Serif'), "'Noto Serif', serif")
  assert.equal(fontStackFor('Noto Sans'), "'Noto Sans', sans-serif")
  assert.equal(fontStackFor('Fira Code'), "'Fira Code', monospace")
  assert.equal(fontStackFor('Source Serif Sans'), "'Source Serif Sans', sans-serif")
})

test('a stack or a generic family is stored as it is', () => {
  assert.equal(
    fontStackFor("Georgia, 'Times New Roman', serif"),
    "Georgia, 'Times New Roman', serif"
  )
  assert.equal(fontStackFor('monospace'), 'monospace')
})

test('a quote in a name is escaped', () => {
  assert.equal(fontStackFor("O'Brien"), "'O\\'Brien', sans-serif")
})

test('primaryFamily shows the first family without quotes or fallbacks', () => {
  assert.equal(primaryFamily("'Fira Code', monospace"), 'Fira Code')
  assert.equal(primaryFamily("Georgia, 'Times New Roman', serif"), 'Georgia')
  assert.equal(primaryFamily('serif'), 'serif')
  assert.equal(primaryFamily(fontStackFor("O'Brien")), "O'Brien")
})

test('the diagram font wins over the personal default, which wins over the built-in', () => {
  assert.equal(effectiveDiagramFont('A', 'B'), 'A')
  assert.equal(effectiveDiagramFont(undefined, 'B'), 'B')
  assert.equal(effectiveDiagramFont('', 'B'), 'B')
  assert.equal(effectiveDiagramFont(undefined, undefined), undefined)
})
