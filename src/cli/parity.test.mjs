// Run with `npm test`. The command line and the MCP server give the same answers (ADR 0138): this
// runs the real `chd` (the check and diff bundles built, run as the launchers run them) and the
// server's tools over the same diagrams and compares what each returns. A check added to the shared
// code cannot reach one front door and not the other without this failing.
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { bundleCheck, bundleDiff } from '../../scripts/build-cli.mjs'
import { createTools } from '../../extension/lib/tools.mjs'
import { openFolder, ToolError } from '../../extension/lib/fileRules.mjs'
import { SPEC_TOPICS } from '../../extension/lib/formatSpec.mjs'
import { loadSpecSources } from '../../extension/lib/specText.mjs'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')
const examples = join(root, 'examples', 'conformance')
const BUILT_IN_METAMODELS = ['data-flow-diagram', 'hexagonal']

// Which capability of each `chd` command the server has, and why a command has none. A command that
// is in neither list fails the completeness test, so adding one is a decision, not an accident.
const SERVER_TOOL = {
  spec: 'get_format_spec',
  validate: 'validate_diagram',
  hash: 'read_file',
  check: 'check_diagram',
  diff: 'diff_diagrams'
}
const COMMAND_LINE_ONLY = {
  export: 'an assistant needs to see the result, which is a different tool',
  help: 'it explains the command line itself'
}

let dir
let tools
const run = (...args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8', cwd: dir })
// What a tool returned, as the JSON an assistant receives.
const asJson = (value) => JSON.parse(JSON.stringify(value))

before(async () => {
  await bundleCheck()
  await bundleDiff()
})
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chd-parity-'))
  for (const name of readdirSync(examples)) copyFileSync(join(examples, name), join(dir, name))
  tools = createTools({ root: openFolder(dir), allowUpdate: false, specSources: loadSpecSources() })
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('every chd command either has a server tool or is listed as command-line only', () => {
  const help = run('--help').stdout
  const commands = [...help.matchAll(/^ {2}chd (\w+)/gm)].map((m) => m[1])
  assert.ok(commands.length >= 6, 'the help lists the commands')
  for (const command of commands) {
    const known = command in SERVER_TOOL || command in COMMAND_LINE_ONLY
    assert.ok(
      known,
      `chd ${command} is neither mapped to a server tool nor listed as command-line only`
    )
  }
  for (const [command, tool] of Object.entries(SERVER_TOOL)) {
    assert.ok(commands.includes(command), `chd ${command} exists`)
    assert.equal(typeof tools[tool], 'function', `${tool} exists`)
  }
})

test('the format spec has the same topics on both sides', () => {
  const usage = run('spec', '--help')
    .stdout.match(/Usage: chd spec \[([^\]]+)\]/)[1]
    .split('|')
  assert.deepEqual([...usage].sort(), [...SPEC_TOPICS].sort())
})

test('chd check and check_diagram give the same result for every example and built-in metamodel', () => {
  const diagrams = readdirSync(dir).filter((name) => name.endsWith('.chd'))
  assert.ok(diagrams.length >= 4)
  let failing = 0
  for (const metamodel of BUILT_IN_METAMODELS) {
    for (const file of diagrams) {
      const cliRun = run('check', file, '--metamodel', metamodel, '--json')
      const fromCli = JSON.parse(cliRun.stdout)
      const fromServer = asJson([tools.check_diagram({ path: file, metamodel })])
      assert.deepEqual(fromServer, fromCli, `${file} against ${metamodel}`)
      // the verdict and the exit code say the same thing
      assert.equal(cliRun.status === 0, fromServer[0].result.conforms)
      if (!fromServer[0].result.conforms) failing += 1
    }
  }
  assert.ok(failing > 0, 'the examples include diagrams that break a rule')
})

test('chd check and check_diagram refuse the same metamodel in the same words', () => {
  mkdirSync(join(dir, 'rules'))
  writeFileSync(join(dir, 'rules', 'bad.chdmeta'), '{ "metamodelVersion": 1 }')
  writeFileSync(join(dir, 'rules', 'junk.chdmeta'), 'not json')
  for (const metamodel of ['rules/bad.chdmeta', 'rules/junk.chdmeta']) {
    const cliRun = run('check', 'hexagonal-ok.chd', '--metamodel', metamodel)
    assert.equal(cliRun.status, 2)
    let message = ''
    try {
      tools.check_diagram({ path: 'hexagonal-ok.chd', metamodel })
    } catch (error) {
      assert.ok(error instanceof ToolError)
      message = error.message
    }
    assert.notEqual(message, '')
    assert.ok(cliRun.stderr.includes(message), `${metamodel}: ${message}`)
  }
})

const node = (id, label, extra = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label, ...extra }
})
const diagram = (nodes, edges = []) => JSON.stringify({ version: 1, nodes, edges }, null, 2)

test('chd diff and diff_diagrams give the same review, with and without --match', async () => {
  mkdirSync(join(dir, 'v1', 'notes'), { recursive: true })
  mkdirSync(join(dir, 'v2', 'notes'), { recursive: true })
  writeFileSync(
    join(dir, 'v1', 'd.chd'),
    diagram(
      [
        node('a', 'Billing', { notes: 'notes/a.md' }),
        node('b', 'Orders'),
        node('c', 'Payments'),
        node('d', 'Shipping')
      ],
      [
        { id: 'e1', source: 'a', target: 'b', label: 'calls' },
        { id: 'e2', source: 'c', target: 'd' }
      ]
    )
  )
  writeFileSync(
    join(dir, 'v2', 'd.chd'),
    diagram(
      [
        node('a', 'Billing', { notes: 'notes/a.md', linkedDiagram: 'billing.chd' }),
        node('b', 'Orders (EU)'),
        node('c', 'Payments')
      ],
      [{ id: 'e1', source: 'a', target: 'b', label: 'calls' }]
    )
  )
  writeFileSync(join(dir, 'v1', 'notes', 'a.md'), 'Handles invoices.')
  writeFileSync(join(dir, 'v2', 'notes', 'a.md'), 'Handles invoices and refunds.')

  const fromCli = JSON.parse(run('diff', 'v1/d.chd', 'v2/d.chd', '--json').stdout)
  const fromServer = asJson(
    await tools.diff_diagrams({ old_path: 'v1/d.chd', new_path: 'v2/d.chd' })
  )
  assert.deepEqual(fromServer, fromCli)
  assert.equal(fromServer.changed, true)

  // ids replaced by a rewrite: three twins are enough to be suspected, and --match pairs them
  writeFileSync(
    join(dir, 'r1.chd'),
    diagram([node('a', 'Billing'), node('b', 'Orders'), node('c', 'Payments')])
  )
  writeFileSync(
    join(dir, 'r2.chd'),
    diagram([node('x', 'Billing'), node('y', 'Orders'), node('z', 'Payments')])
  )
  for (const match of [false, true]) {
    const args = ['diff', 'r1.chd', 'r2.chd', '--json', ...(match ? ['--match'] : [])]
    const cliJson = JSON.parse(run(...args).stdout)
    const serverJson = asJson(
      await tools.diff_diagrams({ old_path: 'r1.chd', new_path: 'r2.chd', match })
    )
    assert.deepEqual(serverJson, cliJson, `match=${match}`)
  }
})

let git = true
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' })
} catch {
  git = false
}

test(
  'chd diff --rev and diff_diagrams with a revision give the same review, notes included',
  { skip: !git },
  async () => {
    mkdirSync(join(dir, 'notes'))
    writeFileSync(join(dir, 'd.chd'), diagram([node('a', 'Billing', { notes: 'notes/a.md' })]))
    writeFileSync(join(dir, 'notes', 'a.md'), 'Handles invoices.')
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
    sh('init', '-q')
    sh('add', 'd.chd', 'notes')
    sh('commit', '-q', '-m', 'one')
    writeFileSync(
      join(dir, 'd.chd'),
      diagram([node('a', 'Billing (EU)', { notes: 'notes/a.md' }), node('b', 'Orders')])
    )
    writeFileSync(join(dir, 'notes', 'a.md'), 'Handles invoices and refunds.')

    const fromCli = JSON.parse(run('diff', 'd.chd', '--rev', 'HEAD', '--json').stdout)
    const fromServer = asJson(await tools.diff_diagrams({ new_path: 'd.chd', revision: 'HEAD' }))
    assert.deepEqual(fromServer, fromCli)
    assert.equal(fromServer.changed, true)
    assert.ok(fromServer.changes.length >= 2)
  }
)

test('chd hash and the fingerprint read_file returns are the same', () => {
  const fromCli = run('hash', 'hexagonal-ok.chd').stdout.trim()
  assert.match(fromCli, /^[0-9a-f]{64}$/)
  assert.equal(tools.read_file({ path: 'hexagonal-ok.chd' }).fingerprint, fromCli)
})

test('chd validate and validate_metamodel report the same problems with a metamodel file', () => {
  const good = readFileSync(join(root, 'resources', 'metamodels', 'hexagonal.chdmeta'), 'utf8')
  writeFileSync(join(dir, 'good.chdmeta'), good)
  const bad = JSON.parse(good)
  bad.edges = { meaning: 'dependsOn', presence: 'forbidden' }
  bad.rules[0].mesage = 'typo'
  writeFileSync(join(dir, 'bad.chdmeta'), JSON.stringify(bad))
  writeFileSync(join(dir, 'junk.chdmeta'), 'not json')

  const ok = run('validate', 'good.chdmeta')
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /\[good\.chdmeta\] OK/)
  assert.deepEqual(asJson(tools.validate_metamodel({ path: 'good.chdmeta' })), {
    ok: true,
    errors: [],
    warnings: []
  })

  for (const file of ['bad.chdmeta', 'junk.chdmeta']) {
    const cliRun = run('validate', file)
    assert.equal(cliRun.status, 1, file)
    const fromCli = cliRun.stdout
      .split(/\r?\n/)
      .filter((l) => l.startsWith('ERROR'))
      .map((l) => l.replace(/^ERROR\s+/, ''))
    const served = tools.validate_metamodel({ path: file })
    assert.equal(served.ok, false)
    assert.deepEqual(served.errors, fromCli)
    assert.ok(fromCli.length >= 1)
  }
  // A diagram and a metamodel can be named together; the worst result wins.
  const mixed = run('validate', 'hexagonal-ok.chd', 'bad.chdmeta')
  assert.equal(mixed.status, 1)
  assert.match(mixed.stdout, /\[hexagonal-ok\.chd\] OK/)
})

test('validate_metamodel refuses what is not a metamodel file', () => {
  assert.throws(
    () => tools.validate_metamodel({ path: 'hexagonal-ok.chd' }),
    /only validates .chdmeta/
  )
})

test('chd validate and validate_diagram report the same errors and warnings', () => {
  writeFileSync(
    join(dir, 'broken.chd'),
    diagram(
      [node('a', 'A', { notes: 'notes/missing.md' }), node('a', 'Duplicate')],
      [{ id: 'e', source: 'a', target: 'gone', sourceHandle: 'cp-9' }]
    )
  )
  const cliRun = run('validate', 'broken.chd')
  assert.equal(cliRun.status, 1)
  // The one intended difference: the server leaves the folder's own path out of a message, so it
  // does not go to the AI provider (ADR 0110). Take it out of the command line's output too.
  const lines = cliRun.stdout
    .replaceAll(dir + sep, '')
    .split(/\r?\n/)
    .filter(Boolean)
  const fromCli = {
    errors: lines.filter((l) => l.startsWith('ERROR')).map((l) => l.replace(/^ERROR\s+/, '')),
    warnings: lines.filter((l) => l.startsWith('WARNING')).map((l) => l.replace(/^WARNING\s+/, ''))
  }
  const served = tools.validate_diagram({ path: 'broken.chd' })
  assert.deepEqual({ errors: served.errors, warnings: served.warnings }, fromCli)
  assert.ok(fromCli.errors.length >= 2)
})
