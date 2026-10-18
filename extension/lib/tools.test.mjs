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
  const created = tools.create_file({ path: 'details/new-note.md', content: '# Hi' })
  assert.equal(created.fingerprint, sha('# Hi'))
  assert.equal(readFileSync(join(folder, 'details', 'new-note.md'), 'utf-8'), '# Hi')
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
