// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectInstalledIcons, findIconPackProblems } from './iconPackProblems.ts'

const node = (id, label, icons, type = 'entity') => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label, icons }
})

const pack = (name, subsets, extra = {}) => ({
  folder: name,
  meta: { name, description: '', ifMissing: '', version: '' },
  subsets: Object.entries(subsets).map(([folder, icons]) => ({
    folder,
    meta: { name: folder, description: '' },
    iconCount: icons.length,
    icons
  })),
  iconCount: 0,
  duplicateOf: null,
  problems: [],
  ...extra
})

const nodes = [
  node('a', 'Web', {
    topLeft: { source: 'installed', pack: 'AWS', path: 'Compute/EC2.svg' },
    topRight: { source: 'builtin', id: 'user' }
  }),
  node('b', 'Queue', { topLeft: { source: 'installed', pack: 'Acme', path: 'Core/queue.svg' } }),
  node('c', 'Cache', { topLeft: { source: 'installed', pack: 'Acme', path: 'Core/cache.svg' } }),
  node('d', 'Plain', { topLeft: { source: 'custom', path: 'assets/x.svg' } })
]
const legend = [
  {
    id: 'l1',
    kind: 'icon',
    label: 'Cloud',
    icon: { source: 'installed', pack: 'Acme', path: 'Core/cloud.svg' }
  },
  { id: 'l2', kind: 'icon', label: 'Built-in', icon: { source: 'builtin', id: 'user' } }
]

test('collects only the installed icons, of nodes and of legend entries', () => {
  const uses = collectInstalledIcons(nodes, legend)
  assert.deepEqual(
    uses.map((u) => [u.ownerKind, u.ownerId, u.pack, u.path]),
    [
      ['node', 'a', 'AWS', 'Compute/EC2.svg'],
      ['node', 'b', 'Acme', 'Core/queue.svg'],
      ['node', 'c', 'Acme', 'Core/cache.svg'],
      ['legend', 'l1', 'Acme', 'Core/cloud.svg']
    ]
  )
  assert.equal(uses[0].ownerLabel, 'Web')
})

test('a pack that is not installed is one problem however many icons use it', () => {
  const uses = collectInstalledIcons(nodes, legend)
  const notes = [{ name: 'Acme', version: '3', ifMissing: 'Ask the platform team.' }]
  const found = findIconPackProblems(uses, [pack('AWS', { Compute: ['EC2.svg'] })], notes)
  assert.deepEqual(found.missingIcons, [])
  assert.equal(found.missingPacks.length, 1)
  assert.equal(found.missingPacks[0].name, 'Acme')
  assert.equal(found.missingPacks[0].uses.length, 3)
  assert.equal(found.missingPacks[0].note?.ifMissing, 'Ask the platform team.')
})

test('an icon the installed pack lacks is a problem of its own element', () => {
  const uses = collectInstalledIcons(nodes, legend)
  const found = findIconPackProblems(
    uses,
    [pack('AWS', { Compute: ['Lambda.svg'] }), pack('Acme', { Core: ['queue.svg', 'cloud.svg'] })],
    []
  )
  assert.deepEqual(found.missingPacks, [])
  assert.deepEqual(
    found.missingIcons.map((u) => [u.ownerId, u.path]),
    [
      ['a', 'Compute/EC2.svg'],
      ['c', 'Core/cache.svg']
    ]
  )
})

test('nothing is wrong when every pack and icon is there, and a note is optional', () => {
  const uses = collectInstalledIcons(nodes, legend)
  const all = [
    pack('AWS', { Compute: ['EC2.svg'] }),
    pack('Acme', { Core: ['queue.svg', 'cache.svg', 'cloud.svg'] })
  ]
  assert.deepEqual(findIconPackProblems(uses, all, []), { missingPacks: [], missingIcons: [] })
  const none = findIconPackProblems(uses, [], [])
  assert.equal(none.missingPacks[0].name, 'Acme', 'sorted by name')
  assert.equal(none.missingPacks[0].note, undefined)
})

test('a duplicate folder does not make a pack present', () => {
  const uses = collectInstalledIcons([nodes[0]], [])
  const copy = pack('AWS', { Compute: ['EC2.svg'] }, { duplicateOf: 'Other' })
  assert.equal(findIconPackProblems(uses, [copy], []).missingPacks.length, 1)
})

test('a path with no subset is a missing icon, not a crash', () => {
  const uses = collectInstalledIcons(
    [node('x', 'X', { topLeft: { source: 'installed', pack: 'AWS', path: 'EC2.svg' } })],
    []
  )
  assert.equal(
    findIconPackProblems(uses, [pack('AWS', { Compute: ['EC2.svg'] })], []).missingIcons.length,
    1
  )
})
