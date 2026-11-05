// Run with `npm test`. Builds the real `chd check` bundle (ADR 0131) and runs it the way the
// launchers do, as a child process.
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleCheck } from '../../scripts/build-cli.mjs'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')
const examples = join(root, 'examples', 'conformance')
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8' })

let dir
before(async () => {
  await bundleCheck()
})
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-check-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('--help lists the check command and the built-in metamodels', () => {
  assert.match(run('--help').stdout, /chd check <file\.chd>/)
  const r = run('check', '--help')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /--metamodel/)
  assert.match(r.stdout, /data-flow-diagram, hexagonal/)
  assert.doesNotMatch(r.stdout, /template/)
})

test('a conforming diagram exits 0', () => {
  const r = run('check', join(examples, 'hexagonal-ok.chd'), '--metamodel', 'hexagonal')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /conforms to Hexagonal architecture/)
})

test('a diagram with errors exits 1 and lists each finding with the offenders', () => {
  const r = run('check', join(examples, 'hexagonal-broken.chd'), '--metamodel', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /does not conform/)
  assert.match(r.stdout, /\(5 errors, 2 warnings, 0 info\)/)
  assert.match(
    r.stdout,
    /error\s+no-adapter-to-adapter: .*\["REST controller" to "SQL repository"\]/
  )
  assert.match(r.stdout, /warning\s+entity-has-role/)
})

test('the data-flow metamodel separates the sound diagram from the broken one', () => {
  assert.equal(
    run('check', join(examples, 'data-flow-ok.chd'), '--metamodel', 'data-flow-diagram').status,
    0
  )
  const r = run('check', join(examples, 'data-flow-broken.chd'), '--metamodel', 'data-flow-diagram')
  assert.equal(r.status, 1)
  for (const id of [
    'no-store-to-store',
    'no-store-to-external',
    'process-has-output',
    'flow-is-labelled'
  ]) {
    assert.match(r.stdout, new RegExp(id))
  }
})

test('warnings alone do not fail the check', async () => {
  const metamodel = join(dir, 'strict.chdmeta')
  await writeFile(
    metamodel,
    JSON.stringify({
      metamodelVersion: 1,
      name: 'Only advice',
      edges: { meaning: 'irrelevant', presence: 'optional' },
      roles: {},
      rules: [{ id: 'small', kind: 'maxElements', of: '*', max: 1, severity: 'warning' }]
    })
  )
  const r = run('check', join(examples, 'hexagonal-ok.chd'), '--metamodel', metamodel)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /conforms to Only advice \(0 errors, 1 warning, 0 info\)/)
  assert.match(r.stdout, /warning\s+small: The diagram has 6 elements; the limit is 1/)
})

test('a diagram without the edge set fails and says what it could not check', async () => {
  const file = join(dir, 'plain.chd')
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      nodes: [{ id: 'a', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: []
    })
  )
  const r = run('check', file, '--metamodel', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /error\s+edge-set: Missing required edge set/)
  assert.match(r.stdout, /not evaluated .*no-adapter-to-adapter/)
})

test('--json prints the findings as data', () => {
  const r = run(
    'check',
    join(examples, 'data-flow-broken.chd'),
    '--metamodel',
    'data-flow-diagram',
    '--json'
  )
  assert.equal(r.status, 1)
  const [entry] = JSON.parse(r.stdout)
  assert.equal(entry.result.conforms, false)
  assert.equal(entry.result.metamodelName, 'Data-flow diagram')
  const finding = entry.result.findings.find((f) => f.ruleId === 'no-store-to-store')
  assert.deepEqual(finding.nodeIds, ['orders', 'archive'])
})

test('several files are all checked, and one failure fails the run', () => {
  const r = run(
    'check',
    join(examples, 'hexagonal-ok.chd'),
    join(examples, 'hexagonal-broken.chd'),
    '--metamodel',
    'hexagonal'
  )
  assert.equal(r.status, 1)
  assert.match(r.stdout, /hexagonal-ok\.chd: conforms/)
  assert.match(r.stdout, /hexagonal-broken\.chd: does not conform/)
})

test('a file that cannot be read fails the run', () => {
  const r = run('check', join(dir, 'missing.chd'), '--metamodel', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /can't read/)
})

test('usage problems and unusable metamodels exit 2, apart from a failing diagram', async () => {
  assert.equal(run('check').status, 2)
  assert.equal(run('check', join(examples, 'hexagonal-ok.chd')).status, 2)
  assert.equal(run('check', '--metamodel', 'hexagonal').status, 2)
  assert.equal(run('check', join(examples, 'hexagonal-ok.chd'), '--metamodel').status, 2)
  assert.equal(
    run('check', join(examples, 'hexagonal-ok.chd'), '--nope', '--metamodel', 'x').status,
    2
  )

  const unknown = run('check', join(examples, 'hexagonal-ok.chd'), '--metamodel', 'onion')
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /no metamodel file or built-in metamodel called 'onion'/)
  assert.match(unknown.stderr, /built-in: data-flow-diagram, hexagonal/)

  const template = run(
    'check',
    join(examples, 'hexagonal-ok.chd'),
    '--metamodel',
    join(root, 'resources', 'metamodels', 'template.chdmeta')
  )
  assert.equal(template.status, 2)
  assert.match(template.stderr, /is not valid/)
  assert.match(template.stderr, /edges\.meaning is not chosen/)

  const broken = join(dir, 'broken.chdmeta')
  await writeFile(broken, '{ not json')
  const bad = run('check', join(examples, 'hexagonal-ok.chd'), '--metamodel', broken)
  assert.equal(bad.status, 2)
  assert.match(bad.stderr, /can't read the metamodel/)
})

test('help check is the same as check --help', () => {
  const r = run('help', 'check')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, run('check', '--help').stdout)
  assert.match(r.stdout, /Exit codes:/)
})

test('the old names still work: --profile, a .chdprofile.json file and profileVersion', async () => {
  const old = join(dir, 'strict.chdprofile.json')
  await writeFile(
    old,
    JSON.stringify({
      profileVersion: 1,
      name: 'Only advice',
      edges: { meaning: 'irrelevant', presence: 'optional' },
      roles: {},
      rules: []
    })
  )
  const r = run('check', join(examples, 'hexagonal-ok.chd'), '--profile', old)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /conforms to Only advice/)
  assert.match(
    run('check', join(examples, 'hexagonal-ok.chd'), '--profile', 'hexagonal').stdout,
    /conforms/
  )
  assert.equal(run('check', join(examples, 'hexagonal-ok.chd'), '--profile').status, 2)
})

test('chd validate reads a metamodel file: OK, every problem, and the old file name', async () => {
  const good = join(root, 'resources', 'metamodels', 'hexagonal.chdmeta')
  const ok = run('validate', good)
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /hexagonal\.chdmeta\] OK/)

  const old = join(dir, 'old.chdprofile.json')
  await writeFile(old, JSON.stringify({ profileVersion: 2, name: 'x', edges: {}, rules: [] }))
  const bad = run('validate', old)
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /ERROR\s+profileVersion must be 1/)
  assert.match(bad.stdout, /ERROR\s+edges\.meaning is not chosen/)
  assert.match(bad.stdout, /ERROR\s+roles is required/)

  assert.match(run('validate', '--help').stdout, /file\.chdmeta/)
})
