// Run with `npm test`. Exercises the extension's tools and path rules directly
// (ADR 0110, ADR 0109); the MCP wiring is covered in ../server.test.mjs.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openFolder, ToolError } from './fileRules.mjs'
import { createTools } from './tools.mjs'
import { loadSpecSources } from './specText.mjs'

const VALID = JSON.stringify({ version: 1, nodes: [{ id: 'a' }], edges: [] })
const BROKEN = JSON.stringify({
  version: 1,
  nodes: [{ id: 'a' }],
  edges: [{ id: 'e', source: 'a', target: 'missing' }]
})
const sha = (text) => createHash('sha256').update(text).digest('hex')

let base
let folder
let root
const make = (allowUpdate = false) =>
  createTools({ root, allowUpdate, specSources: loadSpecSources() })

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'chd-ext-'))
  folder = join(base, 'diagrams')
  mkdirSync(folder)
  writeFileSync(join(base, 'outside.md'), 'secret outside the folder')
  writeFileSync(join(folder, 'a.chd'), VALID)
  mkdirSync(join(folder, 'notes'))
  writeFileSync(join(folder, 'notes', 'readme.md'), '# Notes')
  writeFileSync(join(folder, '.env'), 'TOKEN=1')
  mkdirSync(join(folder, '.git'))
  writeFileSync(join(folder, '.git', 'config.txt'), 'x')
  mkdirSync(join(folder, 'node_modules'))
  writeFileSync(join(folder, 'node_modules', 'dep.md'), 'x')
  writeFileSync(join(folder, 'run.bat'), 'echo hi')
  root = openFolder(folder)
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const refusal = (fn, pattern) =>
  assert.throws(fn, (error) => error instanceof ToolError && pattern.test(error.message))

test('list_files shows readable files, flags writable ones, and skips dot-files and dependency folders', () => {
  const { files, updatesEnabled, truncated } = make().list_files()
  assert.deepEqual(
    files.map((f) => f.path),
    ['a.chd', 'notes/readme.md']
  )
  assert.equal(files[0].writable, true)
  assert.equal(updatesEnabled, false)
  assert.equal(truncated, false)
})

test('list_files names the folder by its name only, never its path', () => {
  const listing = make().list_files()
  assert.equal(listing.folder, 'diagrams')
  assert.ok(!JSON.stringify(listing).includes(base))
})

test('read_file returns the content and the SHA-256 of the raw bytes', () => {
  const result = make().read_file({ path: 'a.chd' })
  assert.equal(result.content, VALID)
  assert.equal(result.fingerprint, sha(VALID))
  assert.equal(make().read_file({ path: 'notes\\readme.md' }).content, '# Notes')
})

test('reads and writes outside the folder, on dot-files, and on other types are refused', () => {
  const tools = make(true)
  refusal(() => tools.read_file({ path: '../outside.md' }), /outside/)
  refusal(() => tools.read_file({ path: join(base, 'outside.md') }), /outside/)
  refusal(() => tools.read_file({ path: '.env' }), /dot-files/)
  refusal(() => tools.read_file({ path: '.git/config.txt' }), /dot-files/)
  refusal(() => tools.read_file({ path: 'run.bat' }), /cannot be read/)
  refusal(() => tools.create_file({ path: 'tool.bat', content: 'x' }), /cannot be written/)
  refusal(() => tools.create_file({ path: '.hidden.md', content: 'x' }), /dot-files/)
  refusal(() => tools.create_file({ path: '../escape.md', content: 'x' }), /outside/)
  refusal(() => tools.read_file({ path: 'a.chd:stream' }), /invalid character/)
  refusal(() => tools.read_file({ path: '' }), /required/)
  assert.equal(existsSync(join(base, 'escape.md')), false)
})

test('a symlink inside the folder cannot lead outside it', (t) => {
  try {
    symlinkSync(join(base, 'outside.md'), join(folder, 'link.md'))
  } catch {
    t.skip('this system does not allow creating symlinks')
    return
  }
  refusal(() => make().read_file({ path: 'link.md' }), /outside/)
})

test('read_file refuses non-UTF-8 content and oversize files', () => {
  writeFileSync(join(folder, 'bin.txt'), Buffer.from([0xff, 0xfe, 0xfd]))
  refusal(() => make().read_file({ path: 'bin.txt' }), /not valid UTF-8/)
  writeFileSync(join(folder, 'big.txt'), Buffer.alloc(5 * 1024 * 1024 + 1, 'a'))
  refusal(() => make().read_file({ path: 'big.txt' }), /larger than/)
})

test('create_file writes a new file, creates folders, and never overwrites', () => {
  const tools = make()
  const created = tools.create_file({ path: 'notes/new-note.md', content: '# Hi' })
  assert.equal(created.fingerprint, sha('# Hi'))
  assert.equal(readFileSync(join(folder, 'notes', 'new-note.md'), 'utf-8'), '# Hi')
  refusal(() => tools.create_file({ path: 'a.chd', content: VALID }), /already exists/)
  assert.equal(readFileSync(join(folder, 'a.chd'), 'utf-8'), VALID)
})

test('create_file validates a .chd first and leaves nothing behind when it is refused', () => {
  const tools = make()
  assert.throws(
    () => tools.create_file({ path: 'fresh/broken.chd', content: BROKEN }),
    (error) => error instanceof ToolError && /structural errors/.test(error.message)
  )
  assert.equal(existsSync(join(folder, 'fresh')), false)
  assert.equal(existsSync(join(folder, 'broken.chd')), false)
  const ok = tools.create_file({ path: 'good.chd', content: VALID })
  assert.deepEqual(ok.warnings, [])
  // No temporary validation files are left in the folder.
  assert.deepEqual(
    readdirSync(folder).filter((n) => n.startsWith('.chd-')),
    []
  )
})

test('validate messages use diagram-relative paths, not the machine path', () => {
  writeFileSync(join(folder, 'bad.chd'), BROKEN)
  const result = make().validate_diagram({ path: 'bad.chd' })
  assert.equal(result.ok, false)
  assert.ok(result.errors.length > 0)
  assert.ok(!result.errors.join('\n').includes(folder), result.errors.join('\n'))
  assert.equal(make().validate_diagram({ path: 'a.chd' }).ok, true)
  refusal(() => make().validate_diagram({ path: 'notes/readme.md' }), /only validates .chd/)
})

test('update_file is refused unless the user turned it on', () => {
  refusal(
    () => make(false).update_file({ path: 'a.chd', content: VALID, base_fingerprint: sha(VALID) }),
    /turned off/
  )
})

test('update_file replaces a file only with the fingerprint of what the edit was based on', () => {
  const tools = make(true)
  const updated = '# Notes\n\nMore.'
  const first = tools.update_file({
    path: 'notes/readme.md',
    content: updated,
    base_fingerprint: sha('# Notes')
  })
  assert.equal(first.fingerprint, sha(updated))
  assert.equal(readFileSync(join(folder, 'notes', 'readme.md'), 'utf-8'), updated)

  // A chain of edits works with the returned fingerprint, no re-read needed.
  const second = tools.update_file({
    path: 'notes/readme.md',
    content: updated + '!',
    base_fingerprint: first.fingerprint
  })
  assert.equal(second.fingerprint, sha(updated + '!'))

  // The file changed behind the assistant's back (say, a save from the app).
  writeFileSync(join(folder, 'notes', 'readme.md'), 'changed elsewhere')
  refusal(
    () =>
      tools.update_file({
        path: 'notes/readme.md',
        content: 'stale edit',
        base_fingerprint: second.fingerprint
      }),
    /changed since you read it/
  )
  assert.equal(readFileSync(join(folder, 'notes', 'readme.md'), 'utf-8'), 'changed elsewhere')
})

test('update_file requires a well-formed fingerprint and an existing file', () => {
  const tools = make(true)
  refusal(
    () => tools.update_file({ path: 'a.chd', content: VALID }),
    /base_fingerprint is required/
  )
  refusal(
    () => tools.update_file({ path: 'a.chd', content: VALID, base_fingerprint: 'abc' }),
    /base_fingerprint is required/
  )
  refusal(
    () => tools.update_file({ path: 'nope.md', content: 'x', base_fingerprint: sha('x') }),
    /not found/
  )
})

test('update_file refuses an invalid .chd and leaves the original and no temp files', () => {
  const tools = make(true)
  refusal(
    () => tools.update_file({ path: 'a.chd', content: BROKEN, base_fingerprint: sha(VALID) }),
    /structural errors/
  )
  assert.equal(readFileSync(join(folder, 'a.chd'), 'utf-8'), VALID)
  assert.deepEqual(
    readdirSync(folder).filter((n) => n.startsWith('.chd-')),
    []
  )
})

test('get_format_spec returns the core rules by default and rejects unknown topics', () => {
  const tools = make()
  assert.match(tools.get_format_spec({}), /# \.chd diagram format/)
  assert.match(tools.get_format_spec({ topic: 'fields' }), /# Field reference/)
  assert.doesNotMatch(tools.get_format_spec({}), /# Field reference/)
  refusal(() => tools.get_format_spec({ topic: 'nope' }), /unknown topic/)
})

test('get_format_spec "all" is the core rules plus an index, small enough for one result', () => {
  const tools = make()
  const all = tools.get_format_spec({ topic: 'all' })
  assert.match(all, /# \.chd diagram format/)
  assert.match(all, /# Topics/)
  for (const name of ['fields', 'authoring', 'layout'])
    assert.match(all, new RegExp(`"${name}" \\(\\d+ KB\\)`))
  assert.doesNotMatch(all, /# Field reference/)
  assert.ok(Buffer.byteLength(all, 'utf-8') < 25 * 1024)
  // Each topic is still available on its own.
  assert.match(tools.get_format_spec({ topic: 'layout' }), /# Layout guide/)
})

// --- check_diagram and diff_diagrams (ADR 0138): the same shared code as `chd check` and `chd diff`.
// The two are compared over the same inputs in src/cli/parity.test.mjs.

const examples = join(import.meta.dirname, '..', '..', 'examples', 'conformance')
const copyExample = (name) => writeFileSync(join(folder, name), readFileSync(join(examples, name)))

test('check_diagram applies a built-in profile by name', () => {
  copyExample('hexagonal-ok.chd')
  copyExample('hexagonal-broken.chd')
  const ok = make().check_diagram({ path: 'hexagonal-ok.chd', profile: 'hexagonal' })
  assert.equal(ok.file, 'hexagonal-ok.chd')
  assert.equal(ok.result.conforms, true)
  const broken = make().check_diagram({ path: 'hexagonal-broken.chd', profile: 'hexagonal' })
  assert.equal(broken.result.conforms, false)
  assert.ok(broken.result.findings.some((f) => f.severity === 'error'))
})

test('check_diagram takes a profile file from the folder, and says what is wrong with one', () => {
  copyExample('hexagonal-ok.chd')
  const profile = readFileSync(
    join(import.meta.dirname, '..', '..', 'resources', 'profiles', 'hexagonal.chdprofile.json'),
    'utf8'
  )
  mkdirSync(join(folder, 'rules'))
  writeFileSync(join(folder, 'rules', 'mine.chdprofile.json'), profile)
  const result = make().check_diagram({
    path: 'hexagonal-ok.chd',
    profile: 'rules/mine.chdprofile.json'
  })
  assert.equal(result.result.conforms, true)

  writeFileSync(join(folder, 'rules', 'bad.chdprofile.json'), '{ "profileVersion": 1 }')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', profile: 'rules/bad.chdprofile.json' }),
    /the profile 'bad\.chdprofile\.json' is not valid/
  )
  writeFileSync(join(folder, 'rules', 'junk.chdprofile.json'), 'not json')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', profile: 'rules/junk.chdprofile.json' }),
    /can't read the profile 'junk\.chdprofile\.json'/
  )
})

test('check_diagram refuses an unknown profile, a profile outside the folder and a non-diagram', () => {
  copyExample('hexagonal-ok.chd')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', profile: 'nope' }),
    /no profile called 'nope'.*data-flow-diagram.*hexagonal/
  )
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', profile: '../outside.md' }),
    /no profile called/
  )
  assert.throws(() => make().check_diagram({ path: 'hexagonal-ok.chd' }), /profile is required/)
  assert.throws(
    () => make().check_diagram({ path: 'notes/readme.md', profile: 'hexagonal' }),
    /only works on \.chd/
  )
  writeFileSync(join(folder, 'junk.chd'), 'not a diagram')
  assert.throws(
    () => make().check_diagram({ path: 'junk.chd', profile: 'hexagonal' }),
    /can't read 'junk\.chd'/
  )
})

test('the template is not offered as a built-in profile', () => {
  copyExample('hexagonal-ok.chd')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', profile: 'template' }),
    /no profile called 'template'/
  )
})

const diagramJson = (nodes, edges = []) => JSON.stringify({ version: 1, nodes, edges }, null, 2)
const entity = (id, label, extra = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label, ...extra }
})

test('diff_diagrams reports what changed between two files, notes included', async () => {
  mkdirSync(join(folder, 'v1', 'notes'), { recursive: true })
  mkdirSync(join(folder, 'v2', 'notes'), { recursive: true })
  writeFileSync(
    join(folder, 'v1', 'd.chd'),
    diagramJson([entity('a', 'Billing', { notes: 'notes/a.md' }), entity('b', 'Orders')])
  )
  writeFileSync(
    join(folder, 'v2', 'd.chd'),
    diagramJson([entity('a', 'Billing', { notes: 'notes/a.md' }), entity('b', 'Orders (EU)')])
  )
  writeFileSync(join(folder, 'v1', 'notes', 'a.md'), 'Handles invoices.')
  writeFileSync(join(folder, 'v2', 'notes', 'a.md'), 'Handles invoices and refunds.')
  const diff = await make().diff_diagrams({ old_path: 'v1/d.chd', new_path: 'v2/d.chd' })
  assert.equal(diff.changed, true)
  assert.equal(diff.older, 'v1/d.chd')
  const byId = Object.fromEntries(diff.changes.map((c) => [c.id, c]))
  assert.ok(byId.a, 'the changed note is a change')
  assert.ok(byId.b, 'the renamed element is a change')
  const same = await make().diff_diagrams({ old_path: 'v1/d.chd', new_path: 'v1/d.chd' })
  assert.equal(same.changed, false)
})

test('diff_diagrams never reads a note path that leaves the diagram’s folder', async () => {
  mkdirSync(join(folder, 'v1'))
  mkdirSync(join(folder, 'v2'))
  const withNote = (label) => diagramJson([entity('a', label, { notes: '../secret.md' })])
  writeFileSync(join(folder, 'v1', 'd.chd'), withNote('A'))
  writeFileSync(join(folder, 'v2', 'd.chd'), withNote('A'))
  writeFileSync(join(folder, 'secret.md'), 'one')
  const diff = await make().diff_diagrams({ old_path: 'v1/d.chd', new_path: 'v2/d.chd' })
  assert.equal(diff.changed, false)
})

test('diff_diagrams pairs elements whose ids were replaced when asked to', async () => {
  writeFileSync(
    join(folder, 'old.chd'),
    diagramJson([entity('a', 'Billing'), entity('b', 'Orders'), entity('c', 'Payments')])
  )
  writeFileSync(
    join(folder, 'new.chd'),
    diagramJson([entity('x', 'Billing'), entity('y', 'Orders'), entity('z', 'Payments')])
  )
  const plain = await make().diff_diagrams({ old_path: 'old.chd', new_path: 'new.chd' })
  assert.equal(plain.idsProbablyChanged, true)
  const matched = await make().diff_diagrams({
    old_path: 'old.chd',
    new_path: 'new.chd',
    match: true
  })
  assert.equal(matched.matched.elements, 3)
})

test('the diff and check tools only read', async () => {
  assert.equal(typeof make(false).check_diagram, 'function')
  await assert.rejects(
    () => make().diff_diagrams({ old_path: 'missing.chd', new_path: 'a.chd' }),
    /file not found/
  )
  await assert.rejects(
    () => make().diff_diagrams({ old_path: '../outside.md', new_path: 'a.chd' }),
    /outside/
  )
})

// --- diff_diagrams against git (ADR 0142)

let git = true
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' })
} catch {
  git = false
}

// A repository at the top, a diagram folder one level down: the folder the extension serves is
// inside the repository, as it often is. Returns tools for that folder and a way to run git.
function gitFolder() {
  const top = mkdtempSync(join(tmpdir(), 'chd-ext-git-'))
  const docs = join(top, 'docs')
  mkdirSync(join(docs, 'notes'), { recursive: true })
  mkdirSync(join(docs, '.private'))
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
      { cwd: top, stdio: 'ignore' }
    )
  const tools = createTools({
    root: openFolder(docs),
    allowUpdate: false,
    specSources: loadSpecSources()
  })
  return { top, docs, sh, tools }
}

test('diff_diagrams compares a file with git, notes included', { skip: !git }, async (t) => {
  const { top, docs, sh, tools } = gitFolder()
  t.after(() => rmSync(top, { recursive: true, force: true }))
  writeFileSync(
    join(docs, 'd.chd'),
    diagramJson([entity('a', 'Billing', { notes: 'notes/a.md' }), entity('b', 'Orders')])
  )
  writeFileSync(join(docs, 'notes', 'a.md'), 'Handles invoices.')
  sh('init', '-q')
  sh('add', '.')
  sh('commit', '-q', '-m', 'one')
  writeFileSync(
    join(docs, 'd.chd'),
    diagramJson([entity('a', 'Billing', { notes: 'notes/a.md' }), entity('b', 'Orders (EU)')])
  )
  writeFileSync(join(docs, 'notes', 'a.md'), 'Handles invoices and refunds.')

  const diff = await tools.diff_diagrams({ new_path: 'd.chd' })
  assert.equal(diff.changed, true)
  assert.equal(diff.older, 'd.chd at HEAD')
  assert.equal(diff.newer, 'd.chd on disk')
  const byId = Object.fromEntries(diff.changes.map((c) => [c.id, c]))
  assert.ok(byId.a, 'the changed note is a change')
  assert.ok(byId.b, 'the renamed element is a change')
  assert.ok(!JSON.stringify(diff).includes(top), 'no path of the computer in the result')

  const same = await tools.diff_diagrams({ new_path: 'd.chd', revision: 'HEAD' })
  assert.deepEqual(same, diff)
})

test('diff_diagrams with git refuses what it should', { skip: !git }, async (t) => {
  const { top, docs, sh, tools } = gitFolder()
  t.after(() => rmSync(top, { recursive: true, force: true }))
  writeFileSync(join(docs, 'd.chd'), diagramJson([entity('a', 'A')]))
  writeFileSync(join(docs, 'new.chd'), diagramJson([entity('a', 'A')]))
  sh('init', '-q')
  sh('add', 'docs/d.chd')
  sh('commit', '-q', '-m', 'one')

  await assert.rejects(
    () => tools.diff_diagrams({ new_path: 'd.chd', revision: 'nosuchrevision' }),
    /does not know the revision/
  )
  // an option, not a revision: never handed to git
  await assert.rejects(
    () => tools.diff_diagrams({ new_path: 'd.chd', revision: '--output=out.txt' }),
    /not a usable git revision/
  )
  await assert.rejects(() => tools.diff_diagrams({ new_path: 'new.chd' }), /not in git at "HEAD"/)
  await assert.rejects(
    () => tools.diff_diagrams({ new_path: 'd.chd', old_path: 'new.chd', revision: 'HEAD' }),
    /not both/
  )
  await assert.rejects(() => tools.diff_diagrams({ old_path: 'd.chd' }), /new_path is required/)
  await assert.rejects(
    () => tools.diff_diagrams({ new_path: '../outside.chd' }),
    /outside the folder/
  )
})

test(
  'diff_diagrams with git never reads a note the folder rules keep closed',
  { skip: !git },
  async (t) => {
    const { top, docs, sh, tools } = gitFolder()
    t.after(() => rmSync(top, { recursive: true, force: true }))
    const withNote = (label) => diagramJson([entity('a', label, { notes: '.private/n.md' })])
    writeFileSync(join(docs, 'd.chd'), withNote('A'))
    writeFileSync(join(docs, '.private', 'n.md'), 'old secret')
    sh('init', '-q')
    sh('add', '-A')
    sh('commit', '-q', '-m', 'one')
    writeFileSync(join(docs, '.private', 'n.md'), 'new secret')
    const diff = await tools.diff_diagrams({ new_path: 'd.chd' })
    assert.equal(diff.changed, false)
    assert.ok(!JSON.stringify(diff).includes('secret'))
  }
)

test(
  'diff_diagrams with git says so when the folder is not in a repository',
  { skip: !git },
  async (t) => {
    const { top, docs, tools } = gitFolder()
    t.after(() => rmSync(top, { recursive: true, force: true }))
    writeFileSync(join(docs, 'd.chd'), diagramJson([entity('a', 'A')]))
    await assert.rejects(
      () => tools.diff_diagrams({ new_path: 'd.chd' }),
      /not inside a git repository/
    )
  }
)

// --- profiles are written like diagrams, and only profiles (ADR 0143)

const PROFILE = readFileSync(
  join(import.meta.dirname, '..', '..', 'resources', 'profiles', 'hexagonal.chdprofile.json'),
  'utf8'
)

test('a profile can be created, validated first, and used by check_diagram', () => {
  const tools = make(true)
  refusal(
    () =>
      tools.create_file({ path: 'rules/bad.chdprofile.json', content: '{ "profileVersion": 1 }' }),
    /was not written.*is not valid/s
  )
  refusal(
    () => tools.create_file({ path: 'rules/junk.chdprofile.json', content: 'not json' }),
    /was not written.*can't read the profile/s
  )
  assert.equal(existsSync(join(folder, 'rules')), false, 'a refused create leaves no folder behind')

  const created = tools.create_file({ path: 'rules/mine.chdprofile.json', content: PROFILE })
  assert.equal(created.fingerprint, sha(PROFILE))
  assert.equal(readFileSync(join(folder, 'rules', 'mine.chdprofile.json'), 'utf8'), PROFILE)
  refusal(
    () => tools.create_file({ path: 'rules/mine.chdprofile.json', content: PROFILE }),
    /already exists/
  )

  writeFileSync(join(folder, 'ok.chd'), readFileSync(join(examples, 'hexagonal-ok.chd')))
  const checked = tools.check_diagram({ path: 'ok.chd', profile: 'rules/mine.chdprofile.json' })
  assert.equal(checked.result.conforms, true)
})

test('a profile is updated only from the version the edit was based on, and validated', () => {
  const tools = make(true)
  const { fingerprint } = tools.create_file({ path: 'p.chdprofile.json', content: PROFILE })
  const edited = PROFILE.replace('"name": "Hexagonal', '"name": "Edited hexagonal')
  assert.notEqual(edited, PROFILE)
  refusal(
    () =>
      tools.update_file({ path: 'p.chdprofile.json', content: edited, base_fingerprint: sha('x') }),
    /has changed since you read it/
  )
  refusal(
    () =>
      tools.update_file({
        path: 'p.chdprofile.json',
        content: '{}',
        base_fingerprint: fingerprint
      }),
    /was not written/
  )
  assert.equal(readFileSync(join(folder, 'p.chdprofile.json'), 'utf8'), PROFILE)
  const updated = tools.update_file({
    path: 'p.chdprofile.json',
    content: edited,
    base_fingerprint: fingerprint
  })
  assert.equal(updated.fingerprint, sha(edited))
  assert.deepEqual(
    readdirSync(folder).filter((n) => n.startsWith('.chd-')),
    []
  )
})

test('no other JSON file can be written, and list_files flags profiles as writable', () => {
  const tools = make(true)
  refusal(() => tools.create_file({ path: 'settings.json', content: '{}' }), /cannot be written/)
  refusal(
    () => tools.create_file({ path: 'x.chdprofile.json.bat', content: '{}' }),
    /cannot be written/
  )
  refusal(() => tools.create_file({ path: 'chdprofile.json', content: '{}' }), /cannot be written/)
  writeFileSync(join(folder, 'settings.json'), '{}')
  writeFileSync(join(folder, 'p.chdprofile.json'), PROFILE)
  const { files } = tools.list_files()
  const writable = Object.fromEntries(files.map((f) => [f.path, f.writable]))
  assert.equal(writable['p.chdprofile.json'], true)
  assert.equal(writable['settings.json'], false)
})

test('get_format_spec serves the conformance topic with the tool names for the commands', () => {
  const spec = make().get_format_spec({ topic: 'conformance' })
  assert.match(spec, /chd check/)
  const core = make().get_format_spec({})
  assert.match(core, /diff_diagrams/)
  assert.match(core, /check_diagram/)
})
