// Run with `npm test`. The `savedWith` field in the file format (ADR 0118), and
// the guard that loading and saving a file never changes what it contains.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseDiagram, serializeDiagram } from './diagram.ts'

const minimal = (extra = {}) => JSON.stringify({ version: 1, nodes: [], edges: [], ...extra })

test('savedWith is written right after version', () => {
  const json = serializeDiagram(parseDiagram(minimal({ savedWith: '0.2.1' })))
  assert.deepEqual(Object.keys(JSON.parse(json)).slice(0, 2), ['version', 'savedWith'])
})

test('savedWith survives a load and a save unchanged', () => {
  const file = parseDiagram(minimal({ savedWith: '0.4.0' }))
  assert.equal(file.savedWith, '0.4.0')
  assert.equal(parseDiagram(serializeDiagram(file)).savedWith, '0.4.0')
})

test('a file without savedWith stays without it', () => {
  const json = serializeDiagram(parseDiagram(minimal()))
  assert.equal('savedWith' in JSON.parse(json), false)
})

// Every shipped example must round-trip with its content intact. This is the
// evidence behind "we already keep the fields we know about", and the guard for
// the newer-app / older-file direction (ADR 0029).
function* exampleFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* exampleFiles(path)
    else if (entry.name.endsWith('.chd')) yield path
  }
}

// Drops keys whose value is undefined, and normalizes key order, so the comparison
// is about content only.
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .filter((k) => value[k] !== undefined)
            .map((k) => [k, canonical(value[k])])
        )
      : value

for (const file of exampleFiles('examples')) {
  test(`round trip loses nothing: ${relative('examples', file).split('\\').join('/')}`, () => {
    const raw = readFileSync(file, 'utf8')
    const loaded = parseDiagram(raw)
    const saved = JSON.parse(serializeDiagram(loaded))
    assert.deepEqual(canonical(saved), canonical(JSON.parse(JSON.stringify(loaded))))
    // ...and the saved text must load again to the same thing.
    assert.deepEqual(canonical(parseDiagram(JSON.stringify(saved))), canonical(loaded))
  })
}
