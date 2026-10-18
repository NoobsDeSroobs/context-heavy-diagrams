// Run with `npm test`. Runs the real `chd` CLI (resources/cli/chd.mjs) as a child
// process, the same way the launchers do (ADR 0106).
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'cli', 'chd.mjs')
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8' })

let dir
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-cli-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('--help tells an AI assistant to run `chd spec`', () => {
  const r = run('--help')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /If you are an AI assistant: run `chd spec` first/)
})

test('no arguments prints help and is a usage error', () => {
  const r = run()
  assert.equal(r.status, 2)
  assert.match(r.stdout, /Usage:/)
})

test('--version prints the package version', async () => {
  const pkg = JSON.parse(await readFile(join(cli, '..', '..', '..', 'package.json'), 'utf-8'))
  assert.equal(run('--version').stdout.trim(), pkg.version)
})

test('spec prints the skill without its frontmatter, and points at the topics', () => {
  const r = run('spec')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /# \.chd diagram format/)
  assert.doesNotMatch(r.stdout, /^name: chd-diagrams/m)
  assert.match(r.stdout, /chd spec fields/)
  assert.doesNotMatch(r.stdout, /# Field reference/)
})

test('spec fields / all add the reference documents; an unknown topic is a usage error', () => {
  assert.match(run('spec', 'fields').stdout, /# Field reference/)
  const all = run('spec', 'all').stdout
  for (const title of [
    '# .chd diagram format',
    '# Field reference',
    '# Authoring guide',
    '# Layout guide'
  ]) {
    assert.ok(all.includes(title), title)
  }
  assert.equal(run('spec', 'nope').status, 2)
})

test('hash prints the SHA-256 of the raw bytes, changes when the file does, and rejects bad usage', async () => {
  const file = join(dir, 'h.chd')
  await writeFile(file, 'hello')
  const first = run('hash', file)
  assert.equal(first.status, 0)
  // sha256("hello")
  assert.equal(
    first.stdout.trim(),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
  )
  await writeFile(file, 'hello!')
  assert.notEqual(run('hash', file).stdout.trim(), first.stdout.trim())
  assert.equal(run('hash').status, 2)
  assert.equal(run('hash', join(dir, 'missing.chd')).status, 1)
})

test('validate: ok file exits 0, structural error exits 1, no file is a usage error', async () => {
  const good = join(dir, 'good.chd')
  await writeFile(good, JSON.stringify({ version: 1, nodes: [{ id: 'a' }], edges: [] }))
  const ok = run('validate', good)
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /OK/)

  const bad = join(dir, 'bad.chd')
  await writeFile(
    bad,
    JSON.stringify({
      version: 1,
      nodes: [{ id: 'a' }],
      edges: [{ id: 'e', source: 'a', target: 'zzz' }]
    })
  )
  const r = run('validate', bad)
  assert.equal(r.status, 1)
  assert.match(r.stdout, /ERROR/)

  assert.equal(run('validate').status, 2)
})

test('an unknown command is a usage error', () => {
  const r = run('frobnicate')
  assert.equal(r.status, 2)
  assert.match(r.stderr, /unknown command/)
})
