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

test('--help lists the check command and the built-in profiles', () => {
  assert.match(run('--help').stdout, /chd check <file\.chd>/)
  const r = run('check', '--help')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /--profile/)
  assert.match(r.stdout, /data-flow-diagram, hexagonal/)
  assert.doesNotMatch(r.stdout, /template/)
})

test('a conforming diagram exits 0', () => {
  const r = run('check', join(examples, 'hexagonal-ok.chd'), '--profile', 'hexagonal')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /conforms to Hexagonal architecture/)
})

test('a diagram with errors exits 1 and lists each finding with the offenders', () => {
  const r = run('check', join(examples, 'hexagonal-broken.chd'), '--profile', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /does not conform/)
  assert.match(r.stdout, /\(5 errors, 2 warnings, 0 info\)/)
  assert.match(
    r.stdout,
    /error\s+no-adapter-to-adapter: .*\["REST controller" to "SQL repository"\]/
  )
  assert.match(r.stdout, /warning\s+entity-has-role/)
})

test('the data-flow profile separates the sound diagram from the broken one', () => {
  assert.equal(
    run('check', join(examples, 'data-flow-ok.chd'), '--profile', 'data-flow-diagram').status,
    0
  )
  const r = run('check', join(examples, 'data-flow-broken.chd'), '--profile', 'data-flow-diagram')
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
  const profile = join(dir, 'strict.chdprofile.json')
  await writeFile(
    profile,
    JSON.stringify({
      profileVersion: 1,
      name: 'Only advice',
      edges: { meaning: 'irrelevant', presence: 'optional' },
      roles: {},
      rules: [{ id: 'small', kind: 'maxElements', of: '*', max: 1, severity: 'warning' }]
    })
  )
  const r = run('check', join(examples, 'hexagonal-ok.chd'), '--profile', profile)
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
  const r = run('check', file, '--profile', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /error\s+edge-set: Missing required edge set/)
  assert.match(r.stdout, /not evaluated .*no-adapter-to-adapter/)
})

test('--json prints the findings as data', () => {
  const r = run(
    'check',
    join(examples, 'data-flow-broken.chd'),
    '--profile',
    'data-flow-diagram',
    '--json'
  )
  assert.equal(r.status, 1)
  const [entry] = JSON.parse(r.stdout)
  assert.equal(entry.result.conforms, false)
  assert.equal(entry.result.profileName, 'Data-flow diagram')
  const finding = entry.result.findings.find((f) => f.ruleId === 'no-store-to-store')
  assert.deepEqual(finding.nodeIds, ['orders', 'archive'])
})

test('several files are all checked, and one failure fails the run', () => {
  const r = run(
    'check',
    join(examples, 'hexagonal-ok.chd'),
    join(examples, 'hexagonal-broken.chd'),
    '--profile',
    'hexagonal'
  )
  assert.equal(r.status, 1)
  assert.match(r.stdout, /hexagonal-ok\.chd: conforms/)
  assert.match(r.stdout, /hexagonal-broken\.chd: does not conform/)
})

test('a file that cannot be read fails the run', () => {
  const r = run('check', join(dir, 'missing.chd'), '--profile', 'hexagonal')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /can't read/)
})

test('usage problems and unusable profiles exit 2, apart from a failing diagram', async () => {
  assert.equal(run('check').status, 2)
  assert.equal(run('check', join(examples, 'hexagonal-ok.chd')).status, 2)
  assert.equal(run('check', '--profile', 'hexagonal').status, 2)
  assert.equal(run('check', join(examples, 'hexagonal-ok.chd'), '--profile').status, 2)
  assert.equal(
    run('check', join(examples, 'hexagonal-ok.chd'), '--nope', '--profile', 'x').status,
    2
  )

  const unknown = run('check', join(examples, 'hexagonal-ok.chd'), '--profile', 'onion')
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /no profile file or built-in profile called 'onion'/)
  assert.match(unknown.stderr, /built-in: data-flow-diagram, hexagonal/)

  const template = run(
    'check',
    join(examples, 'hexagonal-ok.chd'),
    '--profile',
    join(root, 'resources', 'profiles', 'template.chdprofile.json')
  )
  assert.equal(template.status, 2)
  assert.match(template.stderr, /is not valid/)
  assert.match(template.stderr, /edges\.meaning is not chosen/)

  const broken = join(dir, 'broken.chdprofile.json')
  await writeFile(broken, '{ not json')
  const bad = run('check', join(examples, 'hexagonal-ok.chd'), '--profile', broken)
  assert.equal(bad.status, 2)
  assert.match(bad.stderr, /can't read the profile/)
})

test('help check is the same as check --help', () => {
  const r = run('help', 'check')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, run('check', '--help').stdout)
  assert.match(r.stdout, /Exit codes:/)
})
