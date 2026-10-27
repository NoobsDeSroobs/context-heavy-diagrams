import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { classifyDiagrams } from '@shared/compare/classify'
import { buildGitSession } from './gitCompare'

let git = true
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' })
} catch {
  git = false
}

const node = (id: string, label: string, details?: string): object => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label, ...(details ? { details } : {}) }
})
const diagram = (...nodes: object[]): string =>
  JSON.stringify({ version: 1, nodes, edges: [] }, null, 2)

describe.skipIf(!git)('buildGitSession', () => {
  let repo = ''
  let folder = ''
  let file = ''
  const run = (...args: string[]): void => {
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
      { cwd: repo, stdio: 'ignore' }
    )
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'chd-session-'))
    folder = join(repo, 'diagrams')
    file = join(folder, 'd.chd')
    mkdirSync(join(folder, 'd', 'details'), { recursive: true })
    writeFileSync(join(folder, 'd', 'details', 'a.md'), '# A\nowner: team a\n')
    writeFileSync(join(folder, 'd', 'details', 'b.md'), '# B\nunchanged\n')
    writeFileSync(
      file,
      diagram(
        node('a', 'Alpha', 'd/details/a.md'),
        node('b', 'Beta', 'd/details/b.md'),
        node('c', 'Gamma', '../outside.md')
      )
    )
    run('init', '-q')
    run('add', '.')
    run('commit', '-q', '-m', 'one')
    // After the commit: Alpha is renamed and its note edited, Beta is left alone, and Gamma's
    // note path leaves the folder (never read).
    writeFileSync(join(folder, 'd', 'details', 'a.md'), '# A\nowner: team b\n')
    writeFileSync(
      file,
      diagram(
        node('a', 'Alpha 2', 'd/details/a.md'),
        node('b', 'Beta', 'd/details/b.md'),
        node('c', 'Gamma', '../outside.md')
      )
    )
  })

  afterAll(() => rmSync(repo, { recursive: true, force: true }))

  it('compares the file on disk with HEAD and finds the note that changed', async () => {
    const result = await buildGitSession(file, 'HEAD')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.detailsContent).toEqual({
      a: { state: 'changed', preview: ['− owner: team a', '+ owner: team b'] }
    })
    const c = classifyDiagrams(result.session.base, result.session.next, {
      detailsContent: new Map(Object.entries(result.session.detailsContent ?? {}))
    })
    // Alpha was renamed (yellow) and its note changed (orange beats yellow).
    expect(c.nodes.get('a')?.status).toBe('links')
    expect(c.nodes.get('b')).toBeUndefined()
    expect(c.nodes.get('c')).toBeUndefined()
  })

  it('says why it could not compare', async () => {
    const unknown = await buildGitSession(file, 'nosuch')
    expect(unknown).toEqual({ ok: false, message: 'Git does not know the revision "nosuch".' })
    const option = await buildGitSession(file, '--output=x')
    expect(option.ok).toBe(false)
    writeFileSync(join(folder, 'new.chd'), diagram(node('a', 'New')))
    const untracked = await buildGitSession(join(folder, 'new.chd'), 'HEAD')
    expect(untracked.ok).toBe(false)
    if (!untracked.ok) expect(untracked.message).toContain('not in git')
    const outside = await buildGitSession(join(tmpdir(), 'nowhere.chd'), 'HEAD')
    expect(outside.ok).toBe(false)
  })
})
