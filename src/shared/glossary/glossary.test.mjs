// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { filterGlossary, parseGlossary } from './glossary.ts'

const SAMPLE = `# Glossary

Intro that is not a term.

## Note

Plain text of the note.

More plain text.

### For developers

A .md file, ADR 0092.

## Tag

A key and a value.
`

test('a term is its heading and the text up to the developer subheading', () => {
  const [note, tag] = parseGlossary(SAMPLE)
  assert.equal(note.name, 'Note')
  assert.equal(note.definition, 'Plain text of the note.\n\nMore plain text.')
  assert.equal(tag.name, 'Tag')
  assert.equal(tag.definition, 'A key and a value.')
})

test('the introduction and the developer part are not shipped', () => {
  const text = parseGlossary(SAMPLE)
    .map((t) => t.definition)
    .join('\n')
  assert.ok(!text.includes('Intro'))
  assert.ok(!text.includes('ADR 0092'))
})

test('Windows line endings read the same', () => {
  assert.deepEqual(parseGlossary(SAMPLE.replace(/\n/g, '\r\n')), parseGlossary(SAMPLE))
})

test('a filter matches the name or the text, names first', () => {
  const terms = parseGlossary(SAMPLE)
  assert.deepEqual(
    filterGlossary(terms, 'key').map((t) => t.name),
    ['Tag']
  )
  assert.deepEqual(
    filterGlossary(terms, 'NOTE').map((t) => t.name),
    ['Note']
  )
  assert.equal(filterGlossary(terms, '  ').length, 2)
  assert.equal(filterGlossary(terms, 'nothing like this').length, 0)
  const both = parseGlossary('## A\n\nmentions b\n\n## B\n\nplain')
  assert.deepEqual(
    filterGlossary(both, 'b').map((t) => t.name),
    ['B', 'A']
  )
})

// The real file: what the app ships has to be plain, and complete for the terms the app shows.
const real = parseGlossary(
  readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'docs', 'architecture', 'glossary.md'),
    'utf-8'
  )
)

test('every term in docs/architecture/glossary.md has a plain definition', () => {
  assert.ok(real.length >= 15)
  for (const term of real) {
    assert.ok(term.definition.length > 20, `${term.name} has no plain definition`)
  }
})

test('a plain definition holds no link and no ADR number', () => {
  for (const term of real) {
    assert.ok(!/\]\(/.test(term.definition), `${term.name}: a link in the plain text`)
    assert.ok(!/ADR\s*\d/.test(term.definition), `${term.name}: an ADR number in the plain text`)
  }
})

test('the terms the app shows are in the glossary', () => {
  const names = new Set(real.map((t) => t.name.toLowerCase()))
  for (const name of [
    'diagram metamodel',
    'edge direction set',
    'notes',
    'layers',
    'properties',
    'diagram settings',
    'preferences',
    'tags',
    'required tags',
    'highlights',
    'legend'
  ]) {
    assert.ok(names.has(name), `the glossary has no entry for ${name}`)
  }
})

test('a term appears once', () => {
  const names = real.map((t) => t.name.toLowerCase())
  assert.equal(new Set(names).size, names.length)
})
