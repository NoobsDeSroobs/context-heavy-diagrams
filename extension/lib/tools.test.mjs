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
  assert.equal(files[2].writable, undefined)
  assert.ok(!('modified' in files[0]))
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

test('get_format_spec "build" is the short page for edit_diagram, without the core rules', () => {
  const build = make().get_format_spec({ topic: 'build' })
  assert.match(build, /# Building with edit_diagram/)
  assert.match(build, /room_for_label/)
  assert.doesNotMatch(build, /# \.chd diagram format/)
  // About a page: the point of the topic is that it is cheap to read.
  assert.ok(build.length < 5000, `${build.length} characters`)
})

test('get_format_spec "all" is the core rules plus an index, small enough for one result', () => {
  const tools = make()
  const all = tools.get_format_spec({ topic: 'all' })
  assert.match(all, /# \.chd diagram format/)
  assert.match(all, /# Topics/)
  for (const name of ['build', 'fields', 'authoring', 'layout'])
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
  const writable = Object.fromEntries(files.map((f) => [f.path, f.writable === true]))
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

test('inspect_diagram can be narrowed to the problems, some ids or one container', () => {
  const tools = make()
  tools.edit_diagram({
    path: 'zones.chd',
    operations: [
      { op: 'add_container', id: 'zone', label: 'Zone', x: 0, y: 0, width: 400, height: 300 },
      { op: 'add_entity', id: 'web', label: 'Web', x: 20, y: 60, parent: 'zone' },
      { op: 'add_entity', id: 'db', label: 'DB', x: 700, y: 60 },
      { op: 'connect', id: 'calls', from: 'web', to: 'db' }
    ]
  })
  const issues = tools.inspect_diagram({ path: 'zones.chd', issues_only: true })
  assert.deepEqual(Object.keys(issues).sort(), ['fingerprint', 'issues', 'path'])
  const some = tools.inspect_diagram({ path: 'zones.chd', ids: ['db', 'nope'] })
  assert.deepEqual(
    some.nodes.map((n) => n.id),
    ['db']
  )
  assert.deepEqual(some.unknown, ['nope'])
  const zone = tools.inspect_diagram({ path: 'zones.chd', container: 'zone' })
  assert.deepEqual(
    zone.nodes.map((n) => n.id),
    ['zone', 'web']
  )
  assert.deepEqual(
    zone.edges.map((e) => e.id),
    ['calls']
  )
  refusal(() => tools.inspect_diagram({ path: 'zones.chd', ids: 'db' }), /list of element ids/)
  refusal(() => tools.inspect_diagram({ path: 'zones.chd', container: 7 }), /id of a container/)
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

// --- search_files (ADR 0149)

function writeSource() {
  mkdirSync(join(folder, 'server', 'src'), { recursive: true })
  mkdirSync(join(folder, 'web'), { recursive: true })
  writeFileSync(
    join(folder, 'server', 'src', 'metadata.service.ts'),
    'import x from "y"\n\nexport class Metadata {\n  // emits AssetUpdate\n  run() {\n    emit("AssetUpdate")\n  }\n}\n'
  )
  writeFileSync(
    join(folder, 'server', 'src', 'other.ts'),
    'const assetupdate = 1\r\nconst b = 2\r\n'
  )
  writeFileSync(join(folder, 'web', 'page.svelte'), '<p>AssetUpdate</p>\n')
  writeFileSync(join(folder, 'notes', 'readme.md'), '# Notes\nAssetUpdate is an event\n')
}

test('search_files finds lines of text and says where, in the order of the paths', () => {
  writeSource()
  const found = make().search_files({ pattern: 'AssetUpdate' })
  assert.deepEqual(found.matches, [
    'notes/readme.md:2: AssetUpdate is an event',
    'server/src/metadata.service.ts:4:   // emits AssetUpdate',
    'server/src/metadata.service.ts:6:     emit("AssetUpdate")',
    'web/page.svelte:1: <p>AssetUpdate</p>'
  ])
  assert.match(found.summary, /^4 lines match in 3 files \(\d+ files searched\)$/)
  assert.equal(found.stopped, undefined)
})

test('search_files can ignore case, take a glob, a subfolder and context, and list only the files', () => {
  writeSource()
  const tools = make()
  assert.equal(tools.search_files({ pattern: 'assetupdate' }).matches.length, 1)
  const loose = tools.search_files({ pattern: 'assetupdate', ignore_case: true, glob: '*.ts' })
  assert.deepEqual(
    loose.matches.map((m) => m.split(':')[0]),
    ['server/src/metadata.service.ts', 'server/src/metadata.service.ts', 'server/src/other.ts'],
    'a glob without a slash is tried against the file name'
  )
  assert.equal(
    loose.matches[2],
    'server/src/other.ts:1: const assetupdate = 1',
    'CRLF is cut cleanly'
  )
  const nested = tools.search_files({ pattern: 'AssetUpdate', glob: 'server/**/*.service.ts' })
  assert.equal(nested.matches.length, 2)
  assert.equal(tools.search_files({ pattern: 'AssetUpdate', subfolder: 'web' }).matches.length, 1)
  const around = tools.search_files({
    pattern: 'emit("AssetUpdate")',
    subfolder: 'server',
    context: 1
  })
  assert.deepEqual(around.matches, [
    'server/src/metadata.service.ts-5-   run() {',
    'server/src/metadata.service.ts:6:     emit("AssetUpdate")',
    'server/src/metadata.service.ts-7-   }'
  ])
  const only = tools.search_files({ pattern: 'AssetUpdate', glob: '*.ts', files_only: true })
  assert.deepEqual(only.files, ['server/src/metadata.service.ts (2)'])
  const braces = tools.search_files({
    pattern: 'AssetUpdate',
    glob: '*.{svelte,md}',
    files_only: true
  })
  assert.equal(braces.files.length, 2)
})

test('search_files takes a regular expression, stops at the cap and says so', () => {
  writeSource()
  const tools = make()
  const re = tools.search_files({ pattern: 'emit\\("(\\w+)"\\)', regex: true })
  assert.equal(re.matches.length, 1)
  refusal(() => tools.search_files({ pattern: '(', regex: true }), /not a valid regular expression/)
  const capped = tools.search_files({ pattern: 'e', max_matches: 3 })
  assert.equal(capped.matches.length, 3)
  assert.match(capped.stopped, /stopped after 3 matches; narrow it/)
  assert.match(capped.summary, /^3\+ lines match/)
})

test('search_files follows the same rules as list_files and read_file', () => {
  writeSource()
  writeFileSync(join(folder, 'node_modules', 'dep.md'), 'AssetUpdate')
  writeFileSync(join(folder, '.env'), 'AssetUpdate')
  writeFileSync(join(folder, 'tool.exe'), 'AssetUpdate')
  writeFileSync(join(folder, 'image.dat'), Buffer.from([0, 1, 2, 65, 115, 115, 101, 116]))
  writeFileSync(join(folder, 'huge.txt'), `AssetUpdate${' '.repeat(3 * 1024 * 1024)}`)
  writeFileSync(join(base, 'outside.md'), 'AssetUpdate')
  try {
    symlinkSync(base, join(folder, 'link'), 'junction')
  } catch {
    // no permission to make a link here: the rest still holds
  }
  const tools = make()
  const found = tools.search_files({ pattern: 'AssetUpdate', files_only: true })
  assert.deepEqual(
    found.files.map((f) => f.split(' ')[0]),
    ['notes/readme.md', 'server/src/metadata.service.ts', 'web/page.svelte']
  )
  assert.match(found.skipped, /1 files over 2 MB.*1 files that are not text/)
  refusal(() => tools.search_files({ pattern: 'x', subfolder: '../' }), /outside the folder/)
  refusal(() => tools.search_files({ pattern: 'x', subfolder: '.git' }), /dot-files/)
  refusal(() => tools.search_files({ pattern: 'x', subfolder: 'a.chd' }), /not a folder/)
  refusal(() => tools.search_files({ pattern: '' }), /pattern is required/)
  refusal(() => tools.search_files({ pattern: 'x', context: 9 }), /context must be/)
  refusal(() => tools.search_files({ pattern: 'x', max_matches: 0 }), /max_matches must be/)
})

test('search_files cuts a regular expression that never finishes, and a long line around its match', () => {
  const tools = make()
  writeFileSync(join(folder, 'evil.txt'), `${'a'.repeat(40)}b\n`)
  writeFileSync(join(folder, 'minified.js'), `${'x'.repeat(5000)}NEEDLE${'y'.repeat(5000)}\n`)
  const slow = tools.search_files({ pattern: '(a+)+$', regex: true, glob: 'evil.txt' })
  assert.deepEqual(slow.matches, [])
  assert.match(slow.skipped, /1 files where the regular expression took too long/)
  const [line] = tools.search_files({ pattern: 'NEEDLE', glob: 'minified.js' }).matches
  assert.ok(line.length < 300 && line.includes('NEEDLE') && line.includes('…'), line)
})

// --- list_files in pages and by folder, read_file by line (ADR 0149)

function writeTree() {
  mkdirSync(join(folder, 'server', 'src', 'services'), { recursive: true })
  mkdirSync(join(folder, 'web'), { recursive: true })
  mkdirSync(join(folder, 'i18n'), { recursive: true })
  for (let i = 0; i < 5; i += 1) writeFileSync(join(folder, 'i18n', `l${i}.json`), '{}')
  writeFileSync(join(folder, 'server', 'src', 'main.ts'), 'x')
  writeFileSync(join(folder, 'server', 'src', 'services', 'a.service.ts'), 'abc')
  writeFileSync(join(folder, 'server', 'src', 'services', 'b.service.ts'), 'abcdef')
  writeFileSync(join(folder, 'web', 'page.svelte'), 'x')
}

test('list_files can show the shape of the tree one level at a time', () => {
  writeTree()
  const tools = make()
  const top = tools.list_files({ folders: true })
  assert.deepEqual(
    top.folders.map((f) => [f.name, f.files]),
    [
      ['i18n', 5],
      ['notes', 1],
      ['server', 3],
      ['web', 1]
    ]
  )
  assert.equal(top.folders.find((f) => f.name === 'server').bytes, 10)
  assert.deepEqual(
    top.files.map((f) => f.path),
    ['a.chd', 'run.bat']
  )
  assert.equal(top.path, '')
  const inner = tools.list_files({ folders: true, subfolder: 'server/src' })
  assert.deepEqual(
    inner.folders.map((f) => [f.name, f.files, f.bytes]),
    [['services', 2, 9]]
  )
  assert.deepEqual(
    inner.files.map((f) => f.path),
    ['server/src/main.ts']
  )
  assert.equal(inner.path, 'server/src')
})

test('list_files takes a glob and pages with an offset and a limit, in the order of the paths', () => {
  writeTree()
  const tools = make()
  assert.deepEqual(
    tools.list_files({ glob: '*.service.ts' }).files.map((f) => f.path),
    ['server/src/services/a.service.ts', 'server/src/services/b.service.ts']
  )
  const first = tools.list_files({ glob: 'i18n/*.json', limit: 2 })
  assert.deepEqual(
    first.files.map((f) => f.path),
    ['i18n/l0.json', 'i18n/l1.json']
  )
  assert.deepEqual([first.total, first.truncated, first.nextOffset], [5, true, 2])
  const last = tools.list_files({ glob: 'i18n/*.json', limit: 2, offset: 4 })
  assert.deepEqual(
    last.files.map((f) => f.path),
    ['i18n/l4.json']
  )
  assert.deepEqual([last.truncated, last.nextOffset], [false, undefined])
  refusal(() => tools.list_files({ offset: -1 }), /offset must be/)
  refusal(() => tools.list_files({ limit: 0 }), /limit must be/)
})

// --- what a .gitignore names is left out (ADR 0173)

function writeIgnoredTree() {
  const lines = ['# build', 'dist/', '*.log', '!keep.log', '/top-only.md']
  writeFileSync(join(folder, '.gitignore'), `${lines.join('\n')}\n`)
  mkdirSync(join(folder, 'dist'))
  writeFileSync(join(folder, 'dist', 'bundle.md'), 'NEEDLE built')
  writeFileSync(join(folder, 'debug.log'), 'NEEDLE log')
  writeFileSync(join(folder, 'keep.log'), 'NEEDLE kept')
  writeFileSync(join(folder, 'top-only.md'), 'NEEDLE top')
  mkdirSync(join(folder, 'server', 'generated'), { recursive: true })
  writeFileSync(join(folder, 'server', '.gitignore'), 'generated/\ntop-only.md\n')
  writeFileSync(join(folder, 'server', 'generated', 'g.md'), 'NEEDLE generated')
  writeFileSync(join(folder, 'server', 'top-only.md'), 'NEEDLE nested rule')
  writeFileSync(join(folder, 'server', 'real.md'), 'NEEDLE real')
}

test('list_files and search_files leave out what the .gitignore files name, and say so', () => {
  writeIgnoredTree()
  const tools = make()
  const listing = tools.list_files()
  assert.deepEqual(
    listing.files.map((f) => f.path),
    ['a.chd', 'keep.log', 'notes/readme.md', 'run.bat', 'server/real.md']
  )
  assert.match(listing.ignored, /dist\/.*server\/generated\/.*\d+ files?/)
  assert.match(listing.ignored, /give it as subfolder/)
  const found = tools.search_files({ pattern: 'NEEDLE', files_only: true })
  assert.deepEqual(
    found.files.map((line) => line.split(' ')[0]),
    ['keep.log', 'server/real.md']
  )
  assert.match(found.ignored, /dist\//)
})

test('a folder asked for by name is listed even when a .gitignore names it, and its files can be read', () => {
  writeIgnoredTree()
  const tools = make()
  assert.deepEqual(
    tools.list_files({ subfolder: 'dist' }).files.map((f) => f.path),
    ['dist/bundle.md']
  )
  assert.equal(tools.search_files({ pattern: 'built', subfolder: 'dist' }).matches.length, 1)
  assert.equal(tools.read_file({ path: 'dist/bundle.md' }).content, 'NEEDLE built')
})

test('the folder view does not count what a .gitignore names', () => {
  writeIgnoredTree()
  const view = make().list_files({ folders: true })
  assert.deepEqual(
    view.folders.map((f) => f.name),
    ['notes', 'server']
  )
})

test('the .gitignore is never listed, searched or read, and a folder without one lists as before', () => {
  writeIgnoredTree()
  const tools = make()
  assert.ok(!tools.list_files().files.some((f) => f.path.includes('.gitignore')))
  assert.equal(tools.search_files({ pattern: 'generated' }).matches.length, 0)
  refusal(() => tools.read_file({ path: '.gitignore' }), /dot-files/)
  rmSync(join(folder, '.gitignore'))
  rmSync(join(folder, 'server', '.gitignore'))
  const plain = make().list_files()
  assert.equal(plain.ignored, undefined)
  assert.ok(plain.files.some((f) => f.path === 'dist/bundle.md'))
})

test('a .gitignore that is a symlink is not followed', () => {
  mkdirSync(join(folder, 'dist'))
  writeFileSync(join(folder, 'dist', 'bundle.md'), 'x')
  writeFileSync(join(base, 'elsewhere.txt'), 'dist/\n')
  try {
    symlinkSync(join(base, 'elsewhere.txt'), join(folder, '.gitignore'))
  } catch {
    return // symlinks need a privilege on some Windows setups
  }
  assert.ok(
    make()
      .list_files()
      .files.some((f) => f.path === 'dist/bundle.md')
  )
})

test('list_files says when folders below its depth limit were left out', () => {
  const deep = Array.from({ length: 14 }, (_, i) => `d${i}`)
  mkdirSync(join(folder, 'deep', ...deep), { recursive: true })
  writeFileSync(join(folder, 'deep', ...deep, 'bottom.md'), 'x')
  const tools = make()
  const above = tools.list_files({ glob: 'bottom.md' })
  assert.deepEqual(above.files, [])
  assert.match(above.note, /more than 12 levels below the folder are not listed/)
  const inside = tools.list_files({ subfolder: 'deep/d0/d1/d2', glob: 'bottom.md' })
  assert.equal(inside.files.length, 1)
  assert.equal(inside.note, undefined)
})

test('read_file can read part of a text file by line and says it is a part', () => {
  const tools = make()
  const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
  writeFileSync(join(folder, 'notes', 'long.md'), `${lines.join('\n')}\n`)
  const whole = tools.read_file({ path: 'notes/long.md' })
  const part = tools.read_file({ path: 'notes/long.md', start_line: 3, end_line: 5 })
  assert.equal(part.content, 'line 3\nline 4\nline 5')
  assert.deepEqual(part.lines, { from: 3, to: 5, of: 10 })
  assert.match(part.partial, /read the whole file before replacing/)
  assert.equal(part.fingerprint, whole.fingerprint, 'the fingerprint is the whole file')
  assert.equal(tools.read_file({ path: 'notes/long.md', start_line: 9 }).content, 'line 9\nline 10')
  assert.equal(tools.read_file({ path: 'notes/long.md', end_line: 2 }).content, 'line 1\nline 2')
  assert.equal(tools.read_file({ path: 'notes/long.md', start_line: 9, end_line: 99 }).lines.to, 10)
  refusal(
    () => tools.read_file({ path: 'notes/long.md', start_line: 0 }),
    /whole numbers, 1 or more/
  )
  refusal(
    () => tools.read_file({ path: 'notes/long.md', start_line: 5, end_line: 4 }),
    /start first/
  )
  refusal(() => tools.read_file({ path: 'notes/long.md', start_line: 11 }), /has only 10 lines/)
  writeFileSync(join(folder, 'pic.png'), Buffer.from([0x89, 0x50, 0, 0]))
  refusal(() => tools.read_file({ path: 'pic.png', start_line: 1 }), /not text/)
})
