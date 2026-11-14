// What a walk of the folder leaves out because a .gitignore names it (ADR 0173). Both list_files and
// search_files use it, so they see the same files. The .gitignore files are read here and nowhere else:
// their text is never returned, and no other dot-file becomes readable.
import { lstatSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ignore from 'ignore'

const MAX_GITIGNORE_BYTES = 256 * 1024
const NAMED_LIMIT = 12

const slashed = (path) => path.split(sep).join('/')

// The patterns of one folder's .gitignore, or null when there is none worth reading (missing, a
// symlink, too large or unreadable): a repository is then walked as if it had no such file.
function readPatterns(dir) {
  try {
    const file = join(dir, '.gitignore')
    const stats = lstatSync(file)
    if (!stats.isFile() || stats.size > MAX_GITIGNORE_BYTES) return null
    return ignore().add(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

// `scope` is the list of .gitignore files in force, from the folder's own down to the current folder:
// each with the folder it sits in, as a path from the root.
export function createIgnoreRules(root, start) {
  const leftDirs = []
  let leftFiles = 0

  const into = (scope, dir) => {
    const patterns = readPatterns(dir)
    return patterns ? [...scope, { base: slashed(relative(root, dir)), patterns }] : scope
  }

  // Git reads a path against the nearest file first; a rule there, to ignore or to bring back, decides.
  const ignores = (scope, path, isDirectory) => {
    for (let i = scope.length - 1; i >= 0; i -= 1) {
      const { base, patterns } = scope[i]
      const inside = base === '' ? path : path.slice(base.length + 1)
      const verdict = patterns.test(isDirectory ? `${inside}/` : inside)
      if (verdict.ignored) return true
      if (verdict.unignored) return false
    }
    return false
  }

  // The files in force where the walk starts: those of the folder and of every folder above it. A
  // start the person asked for by name is listed even when a file above ignores it.
  let scope = into([], root)
  if (start !== root) {
    let dir = root
    for (const segment of slashed(relative(root, start)).split('/')) {
      dir = join(dir, segment)
      scope = into(scope, dir)
    }
    const startPath = slashed(relative(root, start))
    scope = scope.filter(({ base, patterns }) => {
      const inside = base === '' ? startPath : startPath.slice(base.length + 1)
      return inside === '' || !patterns.test(`${inside}/`).ignored
    })
  }

  return {
    scope,
    into,
    // Whether to leave `path` (from the root, with "/") out, remembering that it was.
    skips(scopeHere, path, isDirectory) {
      if (!ignores(scopeHere, path, isDirectory)) return false
      if (isDirectory) leftDirs.push(`${path}/`)
      else leftFiles += 1
      return true
    },
    // One line for an answer, or undefined when nothing was left out.
    note() {
      if (leftDirs.length === 0 && leftFiles === 0) return undefined
      const named = leftDirs.slice(0, NAMED_LIMIT)
      const more = leftDirs.length - named.length
      const parts = [
        ...named,
        ...(more > 0 ? [`${more} more folders`] : []),
        ...(leftFiles > 0 ? [`${leftFiles} ${leftFiles === 1 ? 'file' : 'files'}`] : [])
      ]
      return `left out because .gitignore names them: ${parts.join(', ')}; to look inside a folder, give it as subfolder`
    }
  }
}
