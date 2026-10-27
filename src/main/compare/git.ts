import { execFile } from 'child_process'
import { join } from 'path'

// Reads a file as it was at a git revision, for the compare window. Git is the only way to get an
// earlier version this tool did not keep itself, and the one place the app starts another program,
// so it is deliberately narrow: only `git show <revision>:<path>`, run without a shell and with the
// arguments as an array, never a command that refreshes the index (a repository's own configuration
// can name a program for those, `core.fsmonitor`, and a repository is not always trusted).

export type GitFailure = 'git-missing' | 'not-a-repo' | 'not-in-revision' | 'bad-revision' | 'error'

export type GitShow =
  { ok: true; text: string } | { ok: false; reason: GitFailure; message: string }

const MAX_BUFFER = 64 * 1024 * 1024
const TIMEOUT_MS = 30_000

// A branch, tag, `HEAD~2` or a commit: no spaces or control characters, no colon (the path part is
// ours), and no leading dash, which git would read as an option.
export function isSafeRevision(revision: string): boolean {
  return (
    revision.length > 0 &&
    revision.length <= 200 &&
    !revision.startsWith('-') &&
    // eslint-disable-next-line no-control-regex
    !/[\s:\x00-\x1f\x7f]/.test(revision)
  )
}

export function classifyGitError(stderr: string): GitFailure {
  if (/not a git repository/i.test(stderr)) return 'not-a-repo'
  if (/exists on disk, but not in|does not exist in/i.test(stderr)) return 'not-in-revision'
  if (/unknown revision|bad revision|invalid object name|ambiguous argument/i.test(stderr)) {
    return 'bad-revision'
  }
  return 'error'
}

interface RunResult {
  missing: boolean
  stdout: string
  stderr: string
  failed: boolean
}

function run(executable: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER,
        timeout: TIMEOUT_MS,
        windowsHide: true,
        // Never wait for a password, and never take the repository's lock for a read.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }
      },
      (error, stdout, stderr) => {
        const code = (error as NodeJS.ErrnoException | null)?.code
        resolve({
          missing: code === 'ENOENT',
          stdout,
          stderr: stderr || (error ? String(error.message) : ''),
          failed: error !== null
        })
      }
    )
  })
}

// An app started from a menu or a dock can have a shorter PATH than a terminal. On Windows, git
// is nearly always in its default folder.
function executables(): string[] {
  const list = ['git']
  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
    list.push(join(programFiles, 'Git', 'cmd', 'git.exe'))
  }
  return list
}

// `path` is relative to `directory` (the diagram's folder), with forward slashes.
export async function gitShow(directory: string, revision: string, path: string): Promise<GitShow> {
  if (!isSafeRevision(revision)) {
    return { ok: false, reason: 'bad-revision', message: `Not a usable revision: ${revision}` }
  }
  const args = [
    '-c',
    'core.fsmonitor=false',
    '--no-pager',
    '-C',
    directory,
    'show',
    `${revision}:./${path}`
  ]
  for (const executable of executables()) {
    const result = await run(executable, args)
    if (result.missing) continue
    if (!result.failed) return { ok: true, text: result.stdout }
    return { ok: false, reason: classifyGitError(result.stderr), message: result.stderr.trim() }
  }
  return { ok: false, reason: 'git-missing', message: 'git was not found' }
}
