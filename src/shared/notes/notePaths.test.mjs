import test from 'node:test'
import assert from 'node:assert/strict'
import { derivedNoteFileNames, derivedNotesPaths, diagramBaseName, noteTail } from './notePaths.ts'

const uuid = (last) => `3f9a1b2c-4d5e-4f60-8a7b-${last}`

test('the tail is the last six characters of the UUID an id ends with', () => {
  assert.equal(noteTail(`entity-${uuid('0123456789ab')}`), '6789ab')
  assert.equal(noteTail(`stencil-${uuid('0123456789ab')}`), '6789ab')
  assert.equal(noteTail(`entity-${uuid('0123456789AB')}`), '6789AB')
})

test('longer tails stay inside the last group of the UUID, then take all of it', () => {
  const id = `entity-${uuid('0123456789ab')}`
  assert.equal(noteTail(id, 8), '456789ab')
  assert.equal(noteTail(id, 12), '0123456789ab')
  assert.equal(noteTail(id, Infinity), uuid('0123456789ab'))
})

test('an id that does not end in a UUID is used whole', () => {
  assert.equal(noteTail('api'), 'api')
  assert.equal(noteTail('a-1'), 'a-1')
  assert.equal(noteTail('kind-branch-all'), 'kind-branch-all')
})

test('the app and an assistant get one name for one element: the label stem and the tail', () => {
  const id = `entity-${uuid('0123456789ab')}`
  const names = derivedNoteFileNames([{ id, label: 'Web App' }])
  assert.equal(names.get(id), 'Web App-6789ab.md')
  assert.equal(
    derivedNotesPaths('D:\\work\\shop.chd', [{ id, label: 'Web App' }]).get(id),
    'shop/notes/Web App-6789ab.md'
  )
})

test('the type prefix of an id never reaches the name', () => {
  for (const prefix of ['entity', 'container', 'stencil']) {
    const id = `${prefix}-${uuid('0123456789ab')}`
    assert.doesNotMatch(
      derivedNoteFileNames([{ id, label: 'X' }]).get(id),
      /entity|container|stencil/
    )
  }
})

test('the same label with different ids gives different names', () => {
  const a = `entity-${uuid('0123456789ab')}`
  const b = `entity-${uuid('ba9876543210')}`
  const names = derivedNoteFileNames([
    { id: a, label: 'Queue' },
    { id: b, label: 'Queue' }
  ])
  assert.notEqual(names.get(a), names.get(b))
  assert.equal(names.get(a), 'Queue-6789ab.md')
})

test('two notes that would get the same name both take a longer tail', () => {
  const a = `entity-${uuid('0123456789ab')}`
  const b = `entity-${uuid('ffff006789ab')}`
  const c = `entity-${uuid('aaaaaaaaaaaa')}`
  assert.equal(noteTail(a), noteTail(b))
  const names = derivedNoteFileNames([
    { id: a, label: 'Queue' },
    { id: b, label: 'Queue' },
    { id: c, label: 'Queue' }
  ])
  assert.equal(names.get(a), 'Queue-456789ab.md')
  assert.equal(names.get(b), 'Queue-006789ab.md')
  assert.equal(names.get(c), 'Queue-aaaaaa.md')
})

test('names that differ only by case count as the same, and ids that cannot be lengthened are numbered', () => {
  const names = derivedNoteFileNames([
    { id: 'A', label: 'Same' },
    { id: 'a', label: 'same' }
  ])
  assert.deepEqual([...names.values()], ['Same-A.md', 'same-a-1.md'])
})

test('a blank label is named untitled, and an unsafe one is made safe like any file name', () => {
  const id = `entity-${uuid('0123456789ab')}`
  assert.equal(derivedNoteFileNames([{ id, label: '' }]).get(id), 'untitled-6789ab.md')
  assert.equal(derivedNoteFileNames([{ id, label: 'a/b' }]).get(id), 'a-b-6789ab.md')
})

test('the diagram name is the file name without folders or extension', () => {
  assert.equal(diagramBaseName('D:\\work\\shop.chd'), 'shop')
  assert.equal(diagramBaseName('/home/x/shop.v2.chd'), 'shop.v2')
})
