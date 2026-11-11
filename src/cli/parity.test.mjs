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
import { bundleCheck, bundleDiff, bundleEdit } from '../../scripts/build-cli.mjs'
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
  diff: 'diff_diagrams',
  edit: 'edit_diagram',
  ask: 'inspect_diagram'
}
// The server's reading tools that the command line leaves to the shell it runs in: a shell has grep,
// ls and cat, and the server has none (ADR 0149).
const SERVER_ONLY = {
  list_files: 'a shell lists files',
  search_files: 'a shell has grep',
  read_file: 'a shell reads files (its fingerprint is chd hash)',
  create_file: 'a shell writes files (chd validate checks them, chd hash gives the fingerprint)',
  update_file: 'a shell writes files (chd validate checks them, chd hash gives the fingerprint)',
  room_for_label: 'chd ask room',
  validate_metamodel: 'chd validate file.chdmeta'
}
const COMMAND_LINE_ONLY = {
  export: 'an assistant needs to see the result, which is a different tool',
  help: 'it explains the command line itself',
  mcp: 'it starts the server, so a tool for it would be the server calling itself'
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
  await bundleEdit()
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
  // The intended differences: the server leaves the folder's own path out of a message, so it does
  // not go to the AI provider (ADR 0110), and writes a path inside the folder with "/" on every
  // system. Do the same to the command line's output.
  const lines = cliRun.stdout
    .replaceAll(dir + sep, '')
    .replaceAll('\\', '/')
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

// A draft given as text: standard input on the command line, `content` in the server. The name a
// draft goes by differs by design, because only one of them has a standard input.
const runWithInput = (input, ...args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8', cwd: dir, input })

test('chd check - and check_diagram with content give the same result', () => {
  let failing = 0
  for (const file of ['hexagonal-ok.chd', 'hexagonal-broken.chd']) {
    const text = readFileSync(join(dir, file), 'utf8')
    const cliRun = runWithInput(text, 'check', '-', '--metamodel', 'hexagonal', '--json')
    const fromCli = JSON.parse(cliRun.stdout)
    const fromServer = asJson([tools.check_diagram({ content: text, metamodel: 'hexagonal' })])
    assert.equal(fromCli[0].file, '(stdin)')
    assert.equal(fromServer[0].file, '(inline)')
    assert.deepEqual(fromCli[0].result, fromServer[0].result, file)
    // The draft gives what the file gives.
    assert.deepEqual(
      fromServer[0].result,
      asJson([tools.check_diagram({ path: file, metamodel: 'hexagonal' })])[0].result
    )
    if (!fromServer[0].result.conforms) failing += 1
  }
  assert.equal(failing, 1)
})

test('chd diff - and diff_diagrams with content give the same review, notes left out', async () => {
  mkdirSync(join(dir, 'notes'))
  writeFileSync(join(dir, 'notes', 'a.md'), 'Handles invoices.')
  const older = diagram([node('a', 'Billing', { notes: 'notes/a.md' }), node('b', 'Orders')])
  const newer = diagram([node('a', 'Billing', { notes: 'notes/a.md' }), node('b', 'Orders (EU)')])
  writeFileSync(join(dir, 'old.chd'), older)

  const cliRun = runWithInput(newer, 'diff', 'old.chd', '-', '--json')
  assert.equal(cliRun.status, 0)
  const fromCli = JSON.parse(cliRun.stdout)
  const served = asJson(await tools.diff_diagrams({ old_path: 'old.chd', new_content: newer }))
  assert.equal(fromCli.newer, '(stdin)')
  assert.equal(served.newer, 'new content')
  assert.deepEqual({ ...fromCli, newer: '' }, { ...served, newer: '' })
  assert.equal(fromCli.changed, true)

  // The draft on the earlier side as well.
  const reversed = JSON.parse(runWithInput(older, 'diff', '-', 'old.chd', '--json').stdout)
  assert.equal(reversed.changed, false)
  const servedReversed = asJson(
    await tools.diff_diagrams({ old_content: older, new_path: 'old.chd' })
  )
  assert.deepEqual({ ...reversed, older: '' }, { ...servedReversed, older: '' })
})

test('standard input can be used once, and a draft needs something to compare with', () => {
  assert.equal(runWithInput('{}', 'diff', '-', '-').status, 2)
  assert.equal(runWithInput('{}', 'diff', '-').status, 2)
  assert.match(runWithInput('{}', 'diff', '-').stderr, /needs a file to compare with/)
  assert.equal(runWithInput('{}', 'check', '-', '-', '--metamodel', 'hexagonal').status, 2)
  // Not a diagram: the check fails like an unreadable file, with the same exit code.
  const bad = runWithInput('not json', 'check', '-', '--metamodel', 'hexagonal')
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, /can't read '\(stdin\)'/)
})

test('every server tool is either behind a chd command or listed as server-only', () => {
  const covered = new Set(Object.values(SERVER_TOOL))
  for (const tool of Object.keys(tools)) {
    assert.ok(
      covered.has(tool) || tool in SERVER_ONLY,
      `${tool} is neither behind a chd command nor listed as server-only`
    )
  }
})

// --- building a diagram: chd edit / chd ask and edit_diagram / inspect_diagram / room_for_label
// (ADR 0148). The same operations must give the same answers and the same bytes. The command line
// works in a folder of its own with the same file name, so what an operation stores is the same.

const BUILD = [
  { op: 'add_entity', id: 'web', label: 'Web', x: 0, y: 0 },
  { op: 'add_entity', id: 'api', label: 'API', x: 140, y: 0, width: 150 },
  { op: 'add_container', id: 'zone', label: 'Zone', x: -20, y: -40, width: 500, height: 200 },
  { op: 'connect', id: 'calls', from: 'web', to: 'api', label: 'a long label for a short gap' },
  { op: 'add_connection_point', id: 'api', side: 'bottom', offset: 0.25, pointId: 'low' },
  { op: 'set_tag', id: 'api', key: 'owner', value: 'platform' },
  { op: 'set_note', id: 'api', text: '# API\nTakes requests.' },
  { op: 'add_new_linked_diagram', id: 'api', name: 'API internals' },
  { op: 'add_entity', id: 'db', label: 'DB', x: 300, y: 300 },
  { op: 'connect', id: 'reads', from: 'api', to: 'db' },
  { op: 'set_edge_points', id: 'reads', points: [{ x: 215, y: 250 }], routing: 'step' }
]

const sameAs = (served, fromCli) => {
  const { path: servedPath, ...rest } = asJson(served)
  const { path: cliPath, ...cliRest } = fromCli
  assert.ok(servedPath && cliPath)
  // A warning names the file: the server's is in the folder srv, the command line's is in its own.
  const unprefixed = JSON.parse(JSON.stringify(rest).replaceAll('srv/', ''))
  assert.deepEqual(unprefixed, cliRest)
}

let cliDir
beforeEach(() => {
  cliDir = join(dir, 'cli')
  mkdirSync(cliDir)
  mkdirSync(join(dir, 'srv'))
})
const runCli = (args, input) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8', cwd: cliDir, input })

test('chd edit and edit_diagram give the same answer and write the same bytes, creating and changing', () => {
  const fromCli = runCli(['edit', 'shop.chd'], JSON.stringify(BUILD))
  assert.equal(fromCli.status, 0, fromCli.stderr)
  const served = tools.edit_diagram({ path: 'srv/shop.chd', operations: BUILD })
  sameAs(served, JSON.parse(fromCli.stdout))
  assert.deepEqual(
    readFileSync(join(dir, 'srv', 'shop.chd')),
    readFileSync(join(cliDir, 'shop.chd'))
  )
  const note = JSON.parse(readFileSync(join(cliDir, 'shop.chd'), 'utf8')).nodes.find(
    (n) => n.id === 'api'
  ).data.notes
  assert.deepEqual(readFileSync(join(dir, 'srv', note)), readFileSync(join(cliDir, note)))
  assert.ok(served.issues.length > 0, 'the build has layout problems to compare')

  const more = [
    { op: 'move', id: 'web', x: 10, y: 10 },
    { op: 'set_label', id: 'web', label: 'Web app' }
  ]
  const nextCli = runCli(
    ['edit', 'shop.chd', '--base', JSON.parse(fromCli.stdout).fingerprint],
    JSON.stringify(more)
  )
  assert.equal(nextCli.status, 0, nextCli.stderr)
  const nextServed = tools.edit_diagram({
    path: 'srv/shop.chd',
    operations: more,
    base_fingerprint: served.fingerprint
  })
  sameAs(nextServed, JSON.parse(nextCli.stdout))
})

test('chd edit and edit_diagram refuse a bad operation, a stale base and a stored path outside the folder alike', () => {
  const refusals = [[{ op: 'connect', from: 'web', to: 'ghost' }]]
  const setup = [{ op: 'add_entity', id: 'web', label: 'Web', x: 0, y: 0 }]
  const cliBase = JSON.parse(runCli(['edit', 'shop.chd'], JSON.stringify(setup)).stdout).fingerprint
  const served = tools.edit_diagram({ path: 'srv/shop.chd', operations: setup })
  for (const operations of refusals) {
    const cliRun = runCli(['edit', 'shop.chd', '--base', cliBase], JSON.stringify(operations))
    assert.equal(cliRun.status, 1)
    let message = ''
    try {
      tools.edit_diagram({
        path: 'srv/shop.chd',
        operations,
        base_fingerprint: served.fingerprint
      })
    } catch (error) {
      assert.ok(error instanceof ToolError)
      message = error.message
    }
    assert.notEqual(message, '')
    // The server words where the folder is differently ("the extension's folder"), so compare the
    // operation's own complaint, which comes first.
    const complaint = message.split('. Nothing was changed')[0].split(': ').pop()
    assert.ok(cliRun.stderr.includes(complaint), `${complaint} in ${cliRun.stderr}`)
  }
  // A path that leads out of the folder is refused by both, naming the path (the words about the
  // folder differ: the server's is the one the person chose).
  const outside = [{ op: 'link_to_existing_diagram', id: 'web', path: '../../outside.chd' }]
  const cliOutside = runCli(['edit', 'shop.chd', '--base', cliBase], JSON.stringify(outside))
  assert.equal(cliOutside.status, 1)
  assert.ok(cliOutside.stderr.includes('../../outside.chd'))
  assert.throws(
    () =>
      tools.edit_diagram({
        path: 'srv/shop.chd',
        operations: outside,
        base_fingerprint: served.fingerprint
      }),
    /\.\.\/\.\.\/outside\.chd/
  )
})

test('chd ask inspect and inspect_diagram give the same answer, with and without styles', () => {
  runCli(['edit', 'shop.chd'], JSON.stringify(BUILD))
  tools.edit_diagram({ path: 'srv/shop.chd', operations: BUILD })
  for (const styles of [false, true]) {
    const fromCli = JSON.parse(
      runCli(['ask', 'inspect', 'shop.chd', ...(styles ? ['--styles'] : [])]).stdout
    )
    sameAs(tools.inspect_diagram({ path: 'srv/shop.chd', styles }), fromCli)
  }
})

test('chd ask inspect and inspect_diagram give the same narrowed answers', () => {
  runCli(['edit', 'shop.chd'], JSON.stringify(BUILD))
  tools.edit_diagram({ path: 'srv/shop.chd', operations: BUILD })
  const cases = [
    [['--issues-only'], { issues_only: true }],
    [['--ids', 'api,reads,nope'], { ids: ['api', 'reads', 'nope'] }],
    [['--container', 'zone'], { container: 'zone' }]
  ]
  for (const [flags, args] of cases) {
    const fromCli = JSON.parse(runCli(['ask', 'inspect', 'shop.chd', ...flags]).stdout)
    sameAs(tools.inspect_diagram({ path: 'srv/shop.chd', ...args }), fromCli)
  }
})

test('chd ask room and room_for_label give the same answer', () => {
  const question = { label: 'sends orders', direction: 'vertical', fontSize: 14, bold: true }
  const fromCli = JSON.parse(
    runCli([
      'ask',
      'room',
      '--label',
      'sends orders',
      '--direction',
      'vertical',
      '--font-size',
      '14',
      '--bold'
    ]).stdout
  )
  assert.deepEqual(asJson(tools.room_for_label(question)), fromCli)
})
