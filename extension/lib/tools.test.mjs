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
  writeFileSync(join(folder, 'tool.exe'), Buffer.from([0x4d, 0x5a, 0, 0]))
  root = openFolder(folder)
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const refusal = (fn, pattern) =>
  assert.throws(fn, (error) => error instanceof ToolError && pattern.test(error.message))

test('list_files shows readable files, flags writable ones, and skips blocked types, dot-files and dependency folders', () => {
  const { files, updatesEnabled, truncated } = make().list_files()
  assert.deepEqual(
    files.map((f) => f.path),
    ['a.chd', 'notes/readme.md', 'run.bat']
  )
  assert.equal(files[0].writable, true)
  assert.equal(files[2].writable, false)
  assert.equal(updatesEnabled, false)
  assert.equal(truncated, false)
})

test('list_files can be narrowed to a subfolder inside the folder', () => {
  const tools = make()
  assert.deepEqual(
    tools.list_files({ subfolder: 'notes' }).files.map((f) => f.path),
    ['notes/readme.md']
  )
  refusal(() => tools.list_files({ subfolder: '../' }), /outside|path must name/)
  refusal(() => tools.list_files({ subfolder: 'a.chd' }), /not a folder/)
  refusal(() => tools.list_files({ subfolder: 'missing' }), /not found/)
  refusal(() => tools.list_files({ subfolder: '.git' }), /dot-files/)
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
  refusal(() => tools.read_file({ path: 'tool.exe' }), /cannot be read/)
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

test('read_file reads any file type that is not blocked: source, no extension, bat', () => {
  writeFileSync(join(folder, 'main.ts'), 'export const a = 1')
  writeFileSync(join(folder, 'Dockerfile'), 'FROM node')
  const tools = make()
  assert.equal(tools.read_file({ path: 'main.ts' }).content, 'export const a = 1')
  assert.equal(tools.read_file({ path: 'Dockerfile' }).content, 'FROM node')
  assert.equal(tools.read_file({ path: 'run.bat' }).content, 'echo hi')
})

test('read_file returns a binary file as base64 with its type and the fingerprint of the bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
  writeFileSync(join(folder, 'shot.png'), png)
  const shot = make().read_file({ path: 'shot.png' })
  assert.equal(shot.binary, true)
  assert.equal(shot.mimeType, 'image/png')
  assert.equal(shot.data, png.toString('base64'))
  assert.equal(shot.fingerprint, createHash('sha256').update(png).digest('hex'))
  assert.equal(shot.bytes, png.length)

  writeFileSync(join(folder, 'book.xlsx'), Buffer.from([0x50, 0x4b, 3, 4, 0]))
  assert.equal(
    make().read_file({ path: 'book.xlsx' }).mimeType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  // Text in another encoding is not valid UTF-8, so it goes out as bytes too.
  writeFileSync(join(folder, 'latin.txt'), Buffer.from([0xff, 0xfe, 0xfd]))
  const latin = make().read_file({ path: 'latin.txt' })
  assert.equal(latin.binary, true)
  assert.equal(latin.mimeType, 'application/octet-stream')
})

test('read_file refuses oversize files, binary or not', () => {
  writeFileSync(join(folder, 'big.txt'), Buffer.alloc(5 * 1024 * 1024 + 1, 'a'))
  refusal(() => make().read_file({ path: 'big.txt' }), /larger than/)
  writeFileSync(join(folder, 'big.pdf'), Buffer.alloc(5 * 1024 * 1024 + 1, 0))
  refusal(() => make().read_file({ path: 'big.pdf' }), /larger than/)
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

test('check_diagram applies a built-in metamodel by name', () => {
  copyExample('hexagonal-ok.chd')
  copyExample('hexagonal-broken.chd')
  const ok = make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: 'hexagonal' })
  assert.equal(ok.file, 'hexagonal-ok.chd')
  assert.equal(ok.result.conforms, true)
  const broken = make().check_diagram({ path: 'hexagonal-broken.chd', metamodel: 'hexagonal' })
  assert.equal(broken.result.conforms, false)
  assert.ok(broken.result.findings.some((f) => f.severity === 'error'))
})

test('check_diagram takes a metamodel file from the folder, and says what is wrong with one', () => {
  copyExample('hexagonal-ok.chd')
  const metamodel = readFileSync(
    join(import.meta.dirname, '..', '..', 'resources', 'metamodels', 'hexagonal.chdmeta'),
    'utf8'
  )
  mkdirSync(join(folder, 'rules'))
  writeFileSync(join(folder, 'rules', 'mine.chdmeta'), metamodel)
  const result = make().check_diagram({
    path: 'hexagonal-ok.chd',
    metamodel: 'rules/mine.chdmeta'
  })
  assert.equal(result.result.conforms, true)

  writeFileSync(join(folder, 'rules', 'bad.chdmeta'), '{ "metamodelVersion": 1 }')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: 'rules/bad.chdmeta' }),
    /the metamodel 'bad\.chdmeta' is not valid/
  )
  writeFileSync(join(folder, 'rules', 'junk.chdmeta'), 'not json')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: 'rules/junk.chdmeta' }),
    /can't read the metamodel 'junk\.chdmeta'/
  )
})

test('check_diagram still reads a metamodel under its old name, but nothing writes one', () => {
  copyExample('hexagonal-ok.chd')
  const metamodel = readFileSync(
    join(import.meta.dirname, '..', '..', 'resources', 'metamodels', 'hexagonal.chdmeta'),
    'utf8'
  ).replace('"metamodelVersion"', '"profileVersion"')
  writeFileSync(join(folder, 'old.chdprofile.json'), metamodel)
  const result = make().check_diagram({
    path: 'hexagonal-ok.chd',
    metamodel: 'old.chdprofile.json'
  })
  assert.equal(result.result.conforms, true)
  refusal(
    () => make().create_file({ path: 'new.chdprofile.json', content: metamodel }),
    /cannot be written/
  )
})

test('check_diagram refuses an unknown metamodel, a metamodel outside the folder and a non-diagram', () => {
  copyExample('hexagonal-ok.chd')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: 'nope' }),
    /no metamodel called 'nope'.*data-flow-diagram.*hexagonal/
  )
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: '../outside.md' }),
    /no metamodel called/
  )
  assert.throws(() => make().check_diagram({ path: 'hexagonal-ok.chd' }), /metamodel is required/)
  assert.throws(
    () => make().check_diagram({ path: 'notes/readme.md', metamodel: 'hexagonal' }),
    /only works on \.chd/
  )
  writeFileSync(join(folder, 'junk.chd'), 'not a diagram')
  assert.throws(
    () => make().check_diagram({ path: 'junk.chd', metamodel: 'hexagonal' }),
    /can't read 'junk\.chd'/
  )
})

test('the template is not offered as a built-in metamodel', () => {
  copyExample('hexagonal-ok.chd')
  assert.throws(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', metamodel: 'template' }),
    /no metamodel called 'template'/
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
    /give only one of old_path/
  )
  await assert.rejects(
    () => tools.diff_diagrams({ old_path: 'd.chd' }),
    /new_path or new_content is required/
  )
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

// --- metamodels are written like diagrams, and only metamodels (ADR 0143)

const METAMODEL = readFileSync(
  join(import.meta.dirname, '..', '..', 'resources', 'metamodels', 'hexagonal.chdmeta'),
  'utf8'
)

test('a metamodel can be created, validated first, and used by check_diagram', () => {
  const tools = make(true)
  refusal(
    () => tools.create_file({ path: 'rules/bad.chdmeta', content: '{ "metamodelVersion": 1 }' }),
    /was not written.*is not valid/s
  )
  refusal(
    () => tools.create_file({ path: 'rules/junk.chdmeta', content: 'not json' }),
    /was not written.*can't read the metamodel/s
  )
  assert.equal(existsSync(join(folder, 'rules')), false, 'a refused create leaves no folder behind')

  const created = tools.create_file({ path: 'rules/mine.chdmeta', content: METAMODEL })
  assert.equal(created.fingerprint, sha(METAMODEL))
  assert.equal(readFileSync(join(folder, 'rules', 'mine.chdmeta'), 'utf8'), METAMODEL)
  refusal(
    () => tools.create_file({ path: 'rules/mine.chdmeta', content: METAMODEL }),
    /already exists/
  )

  writeFileSync(join(folder, 'ok.chd'), readFileSync(join(examples, 'hexagonal-ok.chd')))
  const checked = tools.check_diagram({ path: 'ok.chd', metamodel: 'rules/mine.chdmeta' })
  assert.equal(checked.result.conforms, true)
})

test('a metamodel is updated only from the version the edit was based on, and validated', () => {
  const tools = make(true)
  const { fingerprint } = tools.create_file({ path: 'p.chdmeta', content: METAMODEL })
  const edited = METAMODEL.replace('"name": "Hexagonal', '"name": "Edited hexagonal')
  assert.notEqual(edited, METAMODEL)
  refusal(
    () => tools.update_file({ path: 'p.chdmeta', content: edited, base_fingerprint: sha('x') }),
    /has changed since you read it/
  )
  refusal(
    () =>
      tools.update_file({
        path: 'p.chdmeta',
        content: '{}',
        base_fingerprint: fingerprint
      }),
    /was not written/
  )
  assert.equal(readFileSync(join(folder, 'p.chdmeta'), 'utf8'), METAMODEL)
  const updated = tools.update_file({
    path: 'p.chdmeta',
    content: edited,
    base_fingerprint: fingerprint
  })
  assert.equal(updated.fingerprint, sha(edited))
  assert.deepEqual(
    readdirSync(folder).filter((n) => n.startsWith('.chd-')),
    []
  )
})

test('no other JSON file can be written, and list_files flags metamodels as writable', () => {
  const tools = make(true)
  refusal(() => tools.create_file({ path: 'settings.json', content: '{}' }), /cannot be written/)
  refusal(() => tools.create_file({ path: 'x.chdmeta.bat', content: '{}' }), /cannot be written/)
  refusal(() => tools.create_file({ path: 'chdmeta', content: '{}' }), /cannot be written/)
  writeFileSync(join(folder, 'settings.json'), '{}')
  writeFileSync(join(folder, 'p.chdmeta'), METAMODEL)
  const { files } = tools.list_files()
  const writable = Object.fromEntries(files.map((f) => [f.path, f.writable]))
  assert.equal(writable['p.chdmeta'], true)
  assert.equal(writable['settings.json'], false)
})

test('get_format_spec serves the conformance topic with the tool names for the commands', () => {
  const spec = make().get_format_spec({ topic: 'conformance' })
  assert.match(spec, /chd check/)
  const core = make().get_format_spec({})
  assert.match(core, /diff_diagrams/)
  assert.match(core, /check_diagram/)
})

// --- a draft given as text, to judge it before it is written

test('check_diagram takes the diagram as text, and only one of path and content', () => {
  const ok = readFileSync(join(examples, 'hexagonal-ok.chd'), 'utf8')
  const broken = readFileSync(join(examples, 'hexagonal-broken.chd'), 'utf8')
  const fromText = make().check_diagram({ content: ok, metamodel: 'hexagonal' })
  assert.equal(fromText.file, '(inline)')
  assert.equal(fromText.result.conforms, true)
  assert.equal(
    make().check_diagram({ content: broken, metamodel: 'hexagonal' }).result.conforms,
    false
  )

  copyExample('hexagonal-ok.chd')
  const before = readdirSync(folder, { recursive: true }).sort()
  refusal(
    () => make().check_diagram({ path: 'hexagonal-ok.chd', content: ok, metamodel: 'hexagonal' }),
    /not both/
  )
  refusal(() => make().check_diagram({ metamodel: 'hexagonal' }), /path or content is required/)
  refusal(
    () => make().check_diagram({ content: 'not json', metamodel: 'hexagonal' }),
    /can't read '\(inline\)'/
  )
  refusal(
    () =>
      make().check_diagram({ content: 'x'.repeat(5 * 1024 * 1024 + 1), metamodel: 'hexagonal' }),
    /content is larger than the 5 MB limit/
  )
  assert.deepEqual(readdirSync(folder, { recursive: true }).sort(), before, 'nothing was written')
})

test('diff_diagrams compares a draft with the file now, and leaves notes out for a draft', async () => {
  mkdirSync(join(folder, 'inline', 'notes'), { recursive: true })
  writeFileSync(
    join(folder, 'inline', 'd.chd'),
    diagramJson([entity('a', 'Billing', { notes: 'notes/a.md' }), entity('b', 'Orders')])
  )
  writeFileSync(join(folder, 'inline', 'notes', 'a.md'), 'Handles invoices.')
  const before = readdirSync(folder, { recursive: true }).sort()
  const draft = diagramJson([
    entity('a', 'Billing', { notes: 'notes/a.md' }),
    entity('b', 'Orders (EU)')
  ])

  const diff = await make().diff_diagrams({ old_path: 'inline/d.chd', new_content: draft })
  assert.equal(diff.changed, true)
  assert.equal(diff.older, 'inline/d.chd')
  assert.equal(diff.newer, 'new content')
  assert.deepEqual(
    diff.changes.map((c) => c.id),
    ['b'],
    'only the renamed element; the note beside the file is not compared with nothing'
  )

  const both = await make().diff_diagrams({
    old_content: diagramJson([entity('a', 'A')]),
    new_content: diagramJson([entity('a', 'A'), entity('b', 'B')])
  })
  assert.equal(both.changed, true)
  assert.deepEqual(
    both.changes.map((c) => c.id),
    ['b']
  )
  const same = await make().diff_diagrams({ old_content: draft, new_content: draft })
  assert.equal(same.changed, false)
  assert.deepEqual(readdirSync(folder, { recursive: true }).sort(), before, 'nothing was written')
})

test('diff_diagrams refuses a draft with nothing to compare with, and two earlier versions', async () => {
  const draft = diagramJson([entity('a', 'A')])
  writeFileSync(join(folder, 'd.chd'), draft)
  await assert.rejects(
    () => make().diff_diagrams({ new_content: draft }),
    /new_content needs an earlier version/
  )
  await assert.rejects(
    () => make().diff_diagrams({ new_content: draft, revision: 'HEAD' }),
    /give only one of old_path.*old_content.*revision|new_content needs an earlier version/
  )
  await assert.rejects(
    () => make().diff_diagrams({ new_path: 'd.chd', old_path: 'd.chd', old_content: draft }),
    /give only one of old_path/
  )
  await assert.rejects(
    () => make().diff_diagrams({ old_path: 'd.chd', new_path: 'd.chd', new_content: draft }),
    /new_path.*new_content.*not both/
  )
  await assert.rejects(
    () => make().diff_diagrams({ old_content: draft, new_content: 'not json' }),
    /can't read 'new content'/
  )
})

// --- building a diagram step by step: edit_diagram, inspect_diagram, room_for_label

const TWO_BOXES = [
  { op: 'add_entity', id: 'web', label: 'Web', x: 0, y: 0 },
  { op: 'add_entity', id: 'api', label: 'API', x: 320, y: 0 },
  { op: 'connect', id: 'calls', from: 'web', to: 'api', label: 'requests' }
]

test('edit_diagram creates a diagram, answers with what it made, and the file is valid', () => {
  const tools = make()
  const made = tools.edit_diagram({ path: 'new.chd', operations: TWO_BOXES })
  assert.equal(made.path, 'new.chd')
  assert.deepEqual(
    made.results.map((r) => r.element.id),
    ['web', 'api', 'calls']
  )
  assert.deepEqual(made.issues, [])
  assert.equal(made.fingerprint, sha(readFileSync(join(folder, 'new.chd'))))
  assert.deepEqual(tools.validate_diagram({ path: 'new.chd' }).errors, [])
})

test('edit_diagram can go on editing what it made, with the fingerprint, even when changing files is off', () => {
  const tools = make(false)
  const first = tools.edit_diagram({ path: 'new.chd', operations: TWO_BOXES })
  const second = tools.edit_diagram({
    path: 'new.chd',
    base_fingerprint: first.fingerprint,
    operations: [
      { op: 'move', id: 'api', x: 200, y: 0 },
      { op: 'add_entity', id: 'db', label: 'DB', x: 320, y: 200 }
    ]
  })
  // 200 - 120 = 80px between Web and API: "requests" needs more room than that.
  assert.ok(second.issues.some((issue) => /requests/.test(issue)))
  assert.notEqual(second.fingerprint, first.fingerprint)
  refusal(
    () => tools.edit_diagram({ path: 'new.chd', operations: [{ op: 'remove', id: 'db' }] }),
    /base_fingerprint is required/
  )
  refusal(
    () =>
      tools.edit_diagram({
        path: 'new.chd',
        base_fingerprint: first.fingerprint,
        operations: [{ op: 'remove', id: 'db' }]
      }),
    /has changed since you read it/
  )
})

test('edit_diagram does not touch a diagram it did not make unless changing files is allowed', () => {
  const existing = JSON.stringify({
    version: 1,
    nodes: [{ id: 'a', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    edges: []
  })
  writeFileSync(join(folder, 'real.chd'), existing)
  const fingerprintNow = sha(existing)
  refusal(
    () =>
      make(false).edit_diagram({
        path: 'real.chd',
        base_fingerprint: fingerprintNow,
        operations: [{ op: 'add_entity', x: 0, y: 0 }]
      }),
    /was not made in this session/
  )
  const allowed = make(true).edit_diagram({
    path: 'real.chd',
    base_fingerprint: fingerprintNow,
    operations: [{ op: 'add_entity', id: 'extra', label: 'Extra', x: 500, y: 500 }]
  })
  assert.equal(allowed.results[0].element.id, 'extra')
})

test('edit_diagram refuses a bad batch whole and names the operation', () => {
  const tools = make()
  refusal(
    () =>
      tools.edit_diagram({
        path: 'bad.chd',
        operations: [
          { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
          { op: 'connect', from: 'a', to: 'ghost' }
        ]
      }),
    /operation 2: "to": "ghost" is not an element.*Nothing was changed/
  )
  assert.equal(existsSync(join(folder, 'bad.chd')), false, 'nothing was created')
  refusal(() => tools.edit_diagram({ path: 'x.chd', operations: [] }), /at least one operation/)
  refusal(() => tools.edit_diagram({ path: 'x.md', operations: TWO_BOXES }), /works on .chd files/)
  refusal(
    () =>
      tools.edit_diagram({
        path: 'x.chd',
        base_fingerprint: 'a'.repeat(64),
        operations: TWO_BOXES
      }),
    /does not exist yet/
  )
})

test('inspect_diagram lists the elements and the problems, and room_for_label answers in pixels', () => {
  const tools = make()
  tools.edit_diagram({ path: 'new.chd', operations: TWO_BOXES })
  const seen = tools.inspect_diagram({ path: 'new.chd' })
  assert.deepEqual(
    seen.nodes.map((n) => [n.id, n.x, n.y]),
    [
      ['web', 0, 0],
      ['api', 320, 0]
    ]
  )
  assert.equal(seen.edges[0].label, 'requests')
  assert.deepEqual(seen.issues, [])
  const room = tools.room_for_label({ label: 'requests', direction: 'horizontal' })
  assert.ok(room.minimum > 0 && room.target > room.minimum)
  refusal(() => tools.room_for_label({ label: 'x', direction: 'sideways' }), /direction/)
})

// --- tags, links, notes, legend and the rest through edit_diagram

test('edit_diagram writes a note beside the diagram, and inspect_diagram shows tags, the note and the catalogs', () => {
  const tools = make()
  const made = tools.edit_diagram({
    path: 'sub/shop.chd',
    operations: [
      {
        op: 'set_required_tag',
        key: 'environment',
        allowedValues: ['dev', 'prod'],
        defaultValue: 'dev'
      },
      { op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0, tags: { owner: 'platform' } },
      { op: 'set_note', id: 'api', text: '# API\nTakes requests.' },
      { op: 'set_highlight', key: 'environment', value: 'prod', color: '#e6194b' },
      { op: 'add_legend_entry', id: 'l1', kind: 'entity', label: 'Prod', color: '#e6194b' }
    ]
  })
  assert.equal(made.results[2].note, 'shop/notes/API-api.md')
  const notePath = join(folder, 'sub', 'shop', 'notes', 'API-api.md')
  assert.equal(readFileSync(notePath, 'utf-8'), '# API\nTakes requests.\n')
  assert.deepEqual(made.warnings, [], 'the stored path resolves to the file just written')

  const seen = tools.inspect_diagram({ path: 'sub/shop.chd' })
  assert.deepEqual(seen.nodes[0].tags, { environment: 'dev', owner: 'platform' })
  assert.equal(seen.nodes[0].note, 'shop/notes/API-api.md')
  assert.equal(seen.requiredTags[0].key, 'environment')
  assert.equal(seen.highlights.length, 1)
  assert.equal(seen.legend[0].id, 'l1')
  // The assistant reads the note with the file tools, by the path the answer gave.
  assert.equal(
    tools.read_file({ path: 'sub/shop/notes/API-api.md' }).content,
    '# API\nTakes requests.\n'
  )
})

test('a refused diagram leaves no note behind, and an existing note file is never overwritten', () => {
  const tools = make()
  const first = tools.edit_diagram({
    path: 'shop.chd',
    operations: [{ op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0 }]
  })
  // A stale fingerprint is refused after the note would have been written: nothing remains.
  refusal(
    () =>
      tools.edit_diagram({
        path: 'shop.chd',
        base_fingerprint: 'a'.repeat(64),
        operations: [{ op: 'set_note', id: 'api', text: 'x' }]
      }),
    /has changed since you read it/
  )
  assert.equal(existsSync(join(folder, 'shop')), false, 'the notes folder made for it is gone')

  // A file already at the note's path stays as it is.
  mkdirSync(join(folder, 'shop', 'notes'), { recursive: true })
  writeFileSync(join(folder, 'shop', 'notes', 'API-api.md'), 'mine')
  refusal(
    () =>
      tools.edit_diagram({
        path: 'shop.chd',
        base_fingerprint: first.fingerprint,
        operations: [{ op: 'set_note', id: 'api', text: 'x' }]
      }),
    /already exists/
  )
  assert.equal(readFileSync(join(folder, 'shop', 'notes', 'API-api.md'), 'utf-8'), 'mine')
  assert.equal(
    sha(readFileSync(join(folder, 'shop.chd'))),
    first.fingerprint,
    'the diagram is untouched'
  )
})

test('a link may only lead somewhere the extension may use', () => {
  const tools = make()
  const ops = (path) => [
    { op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0 },
    { op: 'link_to_existing_diagram', id: 'api', path }
  ]
  refusal(
    () => tools.edit_diagram({ path: 'sub/a.chd', operations: ops('../../outside.chd') }),
    /outside the folder/
  )
  refusal(
    () => tools.edit_diagram({ path: 'sub/a.chd', operations: ops('.git/x.chd') }),
    /dot-files/
  )
  const made = tools.edit_diagram({ path: 'sub/a.chd', operations: ops('../a.chd') })
  assert.equal(made.results[1].link, '../a.chd')
  assert.deepEqual(made.warnings, [], 'the target exists')
  const missing = tools.edit_diagram({ path: 'sub/b.chd', operations: ops('Later.chd') })
  assert.match(
    missing.warnings.join('\n'),
    /Later\.chd.*does not exist/,
    'a link to a diagram not made yet is a warning'
  )
})

test('a new linked diagram goes in the folder named after its parent, one level deeper each time', () => {
  const tools = make()
  const top = tools.edit_diagram({
    path: 'shop.chd',
    operations: [
      { op: 'add_entity', id: 'orders', label: 'Orders', x: 0, y: 0 },
      { op: 'add_new_linked_diagram', id: 'orders' }
    ]
  })
  assert.equal(top.results[1].link, 'shop/Orders.chd')
  const child = tools.edit_diagram({
    path: top.results[1].link,
    operations: [
      { op: 'add_entity', id: 'items', label: 'Items', x: 0, y: 0 },
      { op: 'add_new_linked_diagram', id: 'items' }
    ]
  })
  assert.equal(child.results[1].link, 'Orders/Items.chd')
  assert.equal(
    existsSync(join(folder, 'shop', 'Orders.chd')),
    true,
    'the folder is made with the file'
  )
  // A name that is in use on disk is not taken again.
  const again = tools.edit_diagram({
    path: 'shop.chd',
    base_fingerprint: top.fingerprint,
    operations: [
      { op: 'add_entity', id: 'orders2', label: 'Orders', x: 0, y: 200 },
      { op: 'add_new_linked_diagram', id: 'orders2' }
    ]
  })
  assert.equal(again.results[1].link, 'shop/Orders-1.chd')
})
