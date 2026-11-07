// Run with `npm test`. Builds the real `chd edit` / `chd ask` bundle and runs it the way the launchers
// do, as a child process, in a temporary folder (the command works inside the current folder).
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleEdit } from '../../scripts/build-cli.mjs'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')

let dir
const run = (args, input) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8', cwd: dir, input })
const edit = (file, operations, ...more) => run(['edit', file, ...more], JSON.stringify(operations))
const answer = (result) => JSON.parse(result.stdout)

const BUILD = [
  { op: 'add_entity', id: 'web', label: 'Web', x: 0, y: 0 },
  { op: 'add_entity', id: 'api', label: 'API', x: 320, y: 0 },
  { op: 'connect', id: 'calls', from: 'web', to: 'api', label: 'requests' }
]

before(async () => {
  await bundleEdit()
})
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chd-edit-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('chd edit creates a diagram, answers with what each operation made, and the file is valid', () => {
  const created = edit('shop.chd', BUILD)
  assert.equal(created.status, 0, created.stderr)
  const result = answer(created)
  assert.equal(result.path, 'shop.chd')
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/)
  assert.deepEqual(
    result.results.map((r) => r.element?.id),
    ['web', 'api', 'calls']
  )
  assert.deepEqual(result.results[0].element, { id: 'web', x: 0, y: 0, width: 120, height: 80 })
  assert.equal(run(['hash', 'shop.chd']).stdout.trim(), result.fingerprint)
  assert.equal(run(['validate', 'shop.chd']).status, 0)
})

test('chd edit reads the operations from a file, as a list or as {"operations": [...]}', () => {
  writeFileSync(join(dir, 'ops.json'), JSON.stringify({ operations: BUILD }))
  const done = run(['edit', 'a.chd', '--ops', 'ops.json'])
  assert.equal(done.status, 0, done.stderr)
  assert.equal(answer(done).results.length, 3)
})

test('a create fails if the file exists, and a change needs the fingerprint it is based on', () => {
  const first = answer(edit('shop.chd', BUILD))
  const more = [{ op: 'add_entity', id: 'db', label: 'DB', x: 640, y: 0 }]

  const without = edit('shop.chd', more)
  assert.equal(without.status, 2)
  assert.match(without.stderr, /--base is required/)

  const stale = edit('shop.chd', more, '--base', '0'.repeat(64))
  assert.equal(stale.status, 1)
  assert.match(stale.stderr, /has changed since you read it/)

  const ok = edit('shop.chd', more, '--base', first.fingerprint)
  assert.equal(ok.status, 0, ok.stderr)
  assert.notEqual(answer(ok).fingerprint, first.fingerprint)
  assert.match(readFileSync(join(dir, 'shop.chd'), 'utf-8'), /"db"/)

  // The first fingerprint is stale now.
  assert.equal(edit('shop.chd', more, '--base', first.fingerprint).status, 1)
  // A file that does not exist has no fingerprint to pass.
  const missing = edit('new.chd', BUILD, '--base', first.fingerprint)
  assert.equal(missing.status, 2)
  assert.match(missing.stderr, /does not exist yet/)
})

test('a refused operation changes nothing and says which one', () => {
  const first = answer(edit('shop.chd', BUILD))
  const before = readFileSync(join(dir, 'shop.chd'), 'utf-8')
  const bad = edit(
    'shop.chd',
    [
      { op: 'add_entity', id: 'db', label: 'DB', x: 640, y: 0 },
      { op: 'connect', from: 'db', to: 'ghost' }
    ],
    '--base',
    first.fingerprint
  )
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, /Nothing was changed/)
  assert.equal(readFileSync(join(dir, 'shop.chd'), 'utf-8'), before)
})

test('notes and linked diagrams go in a folder named after the diagram, and nothing leaves the folder', () => {
  const done = edit('shop.chd', [
    { op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0 },
    { op: 'set_note', id: 'api', text: '# API\nTakes requests.' },
    { op: 'add_new_linked_diagram', id: 'api', name: 'API internals' }
  ])
  assert.equal(done.status, 0, done.stderr)
  const diagram = JSON.parse(readFileSync(join(dir, 'shop.chd'), 'utf-8'))
  const api = diagram.nodes.find((n) => n.id === 'api')
  assert.match(api.data.notes, /^shop\/notes\/.+\.md$/)
  assert.equal(readFileSync(join(dir, api.data.notes), 'utf-8'), '# API\nTakes requests.\n')
  assert.equal(api.data.linkedDiagram, 'shop/API internals.chd')

  const outside = edit(
    'shop.chd',
    [{ op: 'link_to_existing_diagram', id: 'api', path: '../elsewhere.chd' }],
    '--base',
    answer(run(['ask', 'inspect', 'shop.chd'])).fingerprint
  )
  assert.equal(outside.status, 1)
  assert.match(outside.stderr, /outside the current folder/)
})

test('a refused edit takes back the notes it made', () => {
  const first = answer(
    edit('shop.chd', [{ op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0 }])
  )
  const stale = edit(
    'shop.chd',
    [{ op: 'set_note', id: 'api', text: 'x' }],
    '--base',
    '1'.repeat(64)
  )
  assert.equal(stale.status, 1)
  assert.equal(existsSync(join(dir, 'shop')), false)
  assert.ok(first.fingerprint)
})

test('chd edit works inside the current folder, on .chd files, and says how to use it', () => {
  mkdirSync(join(dir, 'sub'))
  const inside = edit('sub/deep/x.chd', BUILD)
  assert.equal(inside.status, 0, inside.stderr)
  assert.equal(answer(inside).path, 'sub/deep/x.chd')
  const outside = edit('../out.chd', BUILD)
  assert.equal(outside.status, 1)
  assert.match(outside.stderr, /outside the current folder/)
  assert.equal(edit('notes.md', BUILD).status, 2)
  assert.equal(run(['edit', 'a.chd'], 'not json').status, 2)
  assert.equal(run(['edit', 'a.chd'], '[]').status, 2)
  assert.equal(run(['edit'], '[]').status, 2)
  assert.match(run(['edit', '--help']).stdout, /Usage: chd edit/)
})

test('chd ask inspect lists the elements, and --styles adds the style fields', () => {
  edit('shop.chd', [
    { op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0, style: { fill: '#ccddee' } }
  ])
  const plain = answer(run(['ask', 'inspect', 'shop.chd']))
  assert.equal(plain.nodes.length, 1)
  assert.equal(plain.nodes[0].style, undefined)
  const styled = answer(run(['ask', 'inspect', 'shop.chd', '--styles']))
  assert.ok(styled.nodes[0].style)
  assert.deepEqual(plain.issues, [])
  assert.equal(run(['ask', 'inspect', 'missing.chd']).status, 1)
})

test('chd ask room says how much space a label needs, and refuses a question it cannot answer', () => {
  const room = answer(run(['ask', 'room', '--label', 'requests', '--direction', 'horizontal']))
  assert.ok(room.minimum > 0 && room.target >= room.minimum)
  assert.ok(room.chip.width > 0)
  const bold = answer(
    run(['ask', 'room', '--label', 'requests', '--direction', 'horizontal', '--bold'])
  )
  assert.ok(bold.chip.width >= room.chip.width)
  assert.equal(run(['ask', 'room', '--label', 'x']).status, 2)
  assert.equal(run(['ask', 'room', '--direction', 'vertical']).status, 2)
  assert.equal(run(['ask', 'bogus']).status, 2)
  assert.equal(run(['ask']).status, 2)
  assert.match(run(['ask', '--help']).stdout, /chd ask inspect/)
})
