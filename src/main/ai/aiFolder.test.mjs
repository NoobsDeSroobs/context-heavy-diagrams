// Run with `npm test`. Exercises the AI-folder installer, the Node validator
// and the dev-copy sync check against real temp directories (ADR 0105).
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installAiFiles } from './aiFolder.ts'
import { summarizeAiFolderResult } from '../../shared/ai/aiFolderResult.ts'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'

const source = join(import.meta.dirname, '..', '..', '..', 'resources', 'ai')
let dir
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-ai-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('fresh folder gets AGENTS.md, CLAUDE.md and the stamped skill', async () => {
  const r = await installAiFiles(source, dir, '9.9.9')
  assert.deepEqual(r.added, ['AGENTS.md', 'CLAUDE.md', '.claude/skills/chd-diagrams'])
  assert.deepEqual([r.updated, r.skipped], [[], []])
  assert.match(await readFile(join(dir, 'AGENTS.md'), 'utf-8'), /v9\.9\.9/)
  await stat(join(dir, '.claude', 'skills', 'chd-diagrams', 'SKILL.md'))
  await stat(join(dir, '.claude', 'skills', 'chd-diagrams', 'scripts', 'validate_chd.mjs'))
  assert.match(
    await readFile(join(dir, '.claude', 'skills', 'chd-diagrams', '.chd-ai-managed'), 'utf-8'),
    /9\.9\.9/
  )
})

test('AGENTS.md names the chd launcher only when its path is known', async () => {
  await installAiFiles(source, dir, '1.0.0')
  const without = await readFile(join(dir, 'AGENTS.md'), 'utf-8')
  assert.doesNotMatch(without, /CLI_NOTE|command-line tool/)
  assert.doesNotMatch(without, /\n\n\n/)

  await installAiFiles(source, dir, '1.0.0', 'C:\\Apps\\My App\\chd.cmd')
  const withCli = await readFile(join(dir, 'AGENTS.md'), 'utf-8')
  assert.match(withCli, /"C:\\Apps\\My App\\chd\.cmd" validate path\/to\/diagram\.chd/)
  assert.match(withCli, /"C:\\Apps\\My App\\chd\.cmd" spec/)
  assert.doesNotMatch(withCli, /CLI_NOTE/)
})

test("files the app didn't create are never overwritten", async () => {
  await writeFile(join(dir, 'AGENTS.md'), 'my own rules\n')
  await mkdir(join(dir, '.claude', 'skills', 'chd-diagrams'), { recursive: true })
  await writeFile(join(dir, '.claude', 'skills', 'chd-diagrams', 'SKILL.md'), 'mine')
  const r = await installAiFiles(source, dir, '1.0.0')
  assert.deepEqual(r.skipped, ['AGENTS.md', '.claude/skills/chd-diagrams'])
  assert.deepEqual(r.added, ['CLAUDE.md'])
  assert.equal(await readFile(join(dir, 'AGENTS.md'), 'utf-8'), 'my own rules\n')
  assert.equal(
    await readFile(join(dir, '.claude', 'skills', 'chd-diagrams', 'SKILL.md'), 'utf-8'),
    'mine'
  )
})

test('re-running refreshes what we wrote and drops stale skill files', async () => {
  await installAiFiles(source, dir, '1.0.0')
  const skill = join(dir, '.claude', 'skills', 'chd-diagrams')
  await writeFile(join(skill, 'old-file.py'), 'stale')
  const r = await installAiFiles(source, dir, '2.0.0')
  assert.deepEqual(r.updated, ['AGENTS.md', 'CLAUDE.md', '.claude/skills/chd-diagrams'])
  assert.match(await readFile(join(dir, 'AGENTS.md'), 'utf-8'), /v2\.0\.0/)
  await assert.rejects(stat(join(skill, 'old-file.py')))
})

test('summary lists added, updated and skipped', () => {
  const text = summarizeAiFolderResult({
    folder: '/x',
    added: ['a'],
    updated: ['b'],
    skipped: ['c']
  })
  for (const needle of ['/x', 'Added: a', 'Updated: b', 'Left alone', 'c', 'Claude Code']) {
    assert.ok(text.includes(needle), needle)
  }
})

test('validator accepts a sound diagram and flags the classic mistakes', async () => {
  const ok = join(dir, 'ok.chd')
  await writeFile(
    ok,
    JSON.stringify({
      version: 1,
      nodes: [
        { id: 'p', type: 'container' },
        { id: 'c', type: 'entity', parentId: 'p' }
      ],
      edges: [{ id: 'e', source: 'p', target: 'c' }]
    })
  )
  assert.deepEqual(validateFile(ok), { errors: [], warnings: [] })

  const bad = join(dir, 'bad.chd')
  await writeFile(
    bad,
    JSON.stringify({
      version: 1,
      nodes: [
        { id: 'c', parentId: 'p' },
        { id: 'p' },
        { id: 'p' },
        { id: 'n', data: { details: 'missing.md' } }
      ],
      edges: [{ id: 'e', source: 'c', target: 'ghost' }]
    })
  )
  const { errors, warnings } = validateFile(bad)
  assert.ok(errors.some((e) => e.includes('EARLIER')))
  assert.ok(errors.some((e) => e.includes('duplicate node id')))
  assert.ok(errors.some((e) => e.includes("target='ghost'")))
  assert.ok(warnings.some((w) => w.includes('missing.md')))
})

// The repo's own Claude Code copy (.claude/skills) is generated from the
// source of truth by `npm run sync-ai`; fail loudly if someone edits only one.
async function tree(root, prefix = '') {
  const out = {}
  for (const name of (await readdir(root)).sort()) {
    const full = join(root, name)
    const rel = `${prefix}${name}`
    if ((await stat(full)).isDirectory()) Object.assign(out, await tree(full, `${rel}/`))
    else out[rel] = (await readFile(full, 'utf-8')).replaceAll('\r\n', '\n')
  }
  return out
}

test('.claude/skills copy matches resources/ai (run `npm run sync-ai`)', async () => {
  const root = join(import.meta.dirname, '..', '..', '..')
  const a = await tree(join(root, 'resources', 'ai', 'skills', 'chd-diagrams'))
  const b = await tree(join(root, '.claude', 'skills', 'chd-diagrams'))
  assert.deepEqual(b, a)
})
