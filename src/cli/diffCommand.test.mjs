// Run with `npm test`. Builds the real `chd diff` bundle and runs it the way the launchers do, as a
// child process.
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleDiff } from '../../scripts/build-cli.mjs'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')
const run = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8', cwd })

const node = (id, label, x = 0, y = 0, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  data: { label },
  ...extra
})
const edge = (id, source, target, label) => ({ id, source, target, ...(label ? { label } : {}) })
const diagram = (nodes, edges = []) => JSON.stringify({ version: 1, nodes, edges }, null, 2)

const earlier = diagram(
  [
    node('a', 'Billing', 0, 0),
    node('b', 'Orders', 300, 0),
    node('c', 'Payments', 0, 200),
    node('d', 'Shipping', 300, 200)
  ],
  [edge('e1', 'a', 'b', 'calls'), edge('e2', 'b', 'c'), edge('e3', 'c', 'd', 'notifies')]
)

// A real edit: Orders is renamed, Shipping and its connection are deleted, a link is added.
const later = diagram(
  [
    node('a', 'Billing', 0, 0, { data: { label: 'Billing', linkedDiagram: 'billing.chd' } }),
    node('b', 'Orders (EU)', 300, 0),
    node('c', 'Payments', 0, 200)
  ],
  [edge('e1', 'a', 'b', 'calls'), edge('e2', 'b', 'c')]
)

// The same diagram with every id replaced, and one real rename.
const rewritten = diagram(
  [
    node('n-a', 'Billing', 0, 0),
    node('n-b', 'Orders', 300, 0),
    node('n-c', 'Payments (v2)', 0, 200),
    node('n-d', 'Shipping', 300, 200)
  ],
  [
    edge('m1', 'n-a', 'n-b', 'calls'),
    edge('m2', 'n-b', 'n-c'),
    edge('m3', 'n-c', 'n-d', 'notifies')
  ]
)

let dir
before(async () => {
  await bundleDiff()
})
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-diff-'))
  await writeFile(join(dir, 'earlier.chd'), earlier)
  await writeFile(join(dir, 'later.chd'), later)
  await writeFile(join(dir, 'rewritten.chd'), rewritten)
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const files = (...names) => names.map((n) => join(dir, n))

test('--help lists the diff command and its options', () => {
  assert.match(run(['--help']).stdout, /chd diff <old\.chd> <new\.chd>/)
  const r = run(['diff', '--help'])
  assert.equal(r.status, 0)
  assert.match(r.stdout, /--rev/)
  assert.match(r.stdout, /--match/)
  assert.match(r.stdout, /--exit-code/)
})

test('two files: changes are listed in review order, connections under the element they left with', () => {
  const r = run(['diff', ...files('earlier.chd', 'later.chd')])
  assert.equal(r.status, 0)
  const out = r.stdout
  assert.match(out, /3 elements, 1 connection changed/)
  // Links first, then modified, then removed.
  const order = ['LINKS AND NOTES', 'MODIFIED', 'REMOVED'].map((h) => out.indexOf(h))
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2])
  assert.match(out, /linked diagram: added "billing\.chd"/)
  assert.match(out, /label: "Orders" → "Orders \(EU\)"/)
  assert.match(out, /element "Shipping" \(1 connection removed with it\)/)
  assert.match(out, /- notifies/)
})

test('moving an element is not a change; identical files say so and --exit-code stays 0', () => {
  const moved = diagram([node('a', 'Billing', 500, 500)])
  const original = diagram([node('a', 'Billing', 0, 0)])
  return Promise.all([
    writeFile(join(dir, 'm1.chd'), original),
    writeFile(join(dir, 'm2.chd'), moved)
  ]).then(() => {
    const r = run(['diff', ...files('m1.chd', 'm2.chd'), '--exit-code'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /No changes\./)
  })
})

test('--exit-code exits 1 when something changed', () => {
  assert.equal(run(['diff', ...files('earlier.chd', 'later.chd'), '--exit-code']).status, 1)
  assert.equal(run(['diff', ...files('earlier.chd', 'later.chd')]).status, 0)
})

test('replaced ids read as a wipe, with a hint; --match pairs them and shows the real change', () => {
  const plain = run(['diff', ...files('earlier.chd', 'rewritten.chd')])
  assert.match(plain.stdout, /4 elements, 3 connections|removed with it/)
  assert.match(plain.stdout, /the ids probably changed\. Run again with --match/)

  const matched = run(['diff', ...files('earlier.chd', 'rewritten.chd'), '--match'])
  assert.equal(matched.status, 0)
  assert.match(matched.stdout, /Matched 4 elements and 3 connections/)
  assert.match(matched.stdout, /1 element changed/)
  assert.match(matched.stdout, /label: "Payments" → "Payments \(v2\)"/)
  assert.doesNotMatch(matched.stdout, /REMOVED|ADDED/)
})

test('--json prints the same result for a program', () => {
  const r = run(['diff', ...files('earlier.chd', 'later.chd'), '--json'])
  assert.equal(r.status, 0)
  const result = JSON.parse(r.stdout)
  assert.equal(result.changed, true)
  assert.deepEqual(result.counts.removed, { nodes: 1, edges: 1 })
  const shipping = result.changes.find((c) => c.label === 'Shipping')
  assert.equal(shipping.status, 'removed')
  assert.equal(shipping.connections.length, 1)
  assert.equal(result.matched, null)
})

test('usage and read errors have their own exit codes', () => {
  assert.equal(run(['diff']).status, 2)
  assert.equal(run(['diff', '--nosuch', 'a.chd']).status, 2)
  assert.equal(run(['diff', ...files('earlier.chd', 'later.chd'), '--rev', 'HEAD']).status, 2)
  const missing = run(['diff', join(dir, 'nowhere.chd'), ...files('later.chd')])
  assert.equal(missing.status, 3)
  assert.match(missing.stderr, /can't read/)
})

let git = true
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' })
} catch {
  git = false
}

test(
  'one file: compares the file on disk with git, and finds a changed note',
  { skip: !git },
  async () => {
    const sh = (...args) =>
      execFileSync(
        'git',
        [
          '-c',
          'user.name=t',
          '-c',
          'user.email=t@example.com',
          '-c',
          'commit.gpgsign=false',
          ...args
        ],
        { cwd: dir, stdio: 'ignore' }
      )
    await mkdir(join(dir, 'd', 'details'), { recursive: true })
    await writeFile(join(dir, 'd', 'details', 'a.md'), '# A\nowner: team a\n')
    await writeFile(
      join(dir, 'doc.chd'),
      diagram([node('a', 'Alpha', 0, 0, { data: { label: 'Alpha', details: 'd/details/a.md' } })])
    )
    sh('init', '-q')
    sh('add', 'doc.chd', 'd')
    sh('commit', '-q', '-m', 'one')
    await writeFile(join(dir, 'd', 'details', 'a.md'), '# A\nowner: team b\n')

    const r = run(['diff', 'doc.chd'], dir)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /doc\.chd on disk against doc\.chd at HEAD/)
    assert.match(r.stdout, /Details file: content changed/)
    assert.match(r.stdout, /− owner: team a/)
    assert.match(r.stdout, /\+ owner: team b/)

    const bad = run(['diff', 'doc.chd', '--rev', 'nosuchrevision'], dir)
    assert.equal(bad.status, 3)
    assert.match(bad.stderr, /does not know the revision/)
  }
)
