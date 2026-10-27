// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyGitError, gitShow, isSafeRevision } from './git.ts'

test('a revision that could be read as an option, or as more than a revision, is refused', () => {
  for (const ok of ['HEAD', 'main', 'origin/main', 'v1.2.0', 'HEAD~3', 'abc1234', 'HEAD@{1}']) {
    assert.equal(isSafeRevision(ok), true, ok)
  }
  for (const bad of ['', '-p', '--output=x', 'a b', 'a:b', 'a\nb', 'x'.repeat(201)]) {
    assert.equal(isSafeRevision(bad), false, JSON.stringify(bad))
  }
})

test('git failures are told apart', () => {
  assert.equal(classifyGitError('fatal: not a git repository (or any parent)'), 'not-a-repo')
  assert.equal(classifyGitError("fatal: path 'a.chd' does not exist in 'HEAD'"), 'not-in-revision')
  assert.equal(
    classifyGitError("fatal: path 'a.chd' exists on disk, but not in 'HEAD'"),
    'not-in-revision'
  )
  assert.equal(classifyGitError("fatal: invalid object name 'nosuch'."), 'bad-revision')
  assert.equal(classifyGitError('something else'), 'error')
})

let git = true
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' })
} catch {
  git = false
}

test(
  'reads a file as it was at a revision, from the folder it sits in',
  { skip: !git },
  async () => {
    const repo = mkdtempSync(join(tmpdir(), 'chd-git-'))
    try {
      const run = (...args) =>
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
      run('init', '-q')
      mkdirSync(join(repo, 'sub', 'notes'), { recursive: true })
      writeFileSync(join(repo, 'sub', 'd.chd'), 'first')
      writeFileSync(join(repo, 'sub', 'notes', 'n.md'), 'note v1\n')
      run('add', '.')
      run('commit', '-q', '-m', 'one')
      writeFileSync(join(repo, 'sub', 'd.chd'), 'second')
      run('commit', '-q', '-am', 'two')
      writeFileSync(join(repo, 'sub', 'untracked.chd'), 'x')

      const folder = join(repo, 'sub')
      assert.deepEqual(await gitShow(folder, 'HEAD', 'd.chd'), { ok: true, text: 'second' })
      assert.deepEqual(await gitShow(folder, 'HEAD~1', 'd.chd'), { ok: true, text: 'first' })
      assert.deepEqual(await gitShow(folder, 'HEAD', 'notes/n.md'), { ok: true, text: 'note v1\n' })
      assert.equal((await gitShow(folder, 'HEAD', 'untracked.chd')).reason, 'not-in-revision')
      assert.equal((await gitShow(folder, 'nosuch', 'd.chd')).reason, 'bad-revision')
      assert.equal((await gitShow(folder, '--output=x', 'd.chd')).reason, 'bad-revision')
      assert.equal((await gitShow(tmpdir(), 'HEAD', 'd.chd')).reason, 'not-a-repo')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
)
