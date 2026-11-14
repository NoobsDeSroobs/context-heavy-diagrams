// Searching the text of the files in the folder, in plain Node: no shell and no other program, so it
// works the same on every system (ADR 0149). It reads what list_files lists and nothing else: the same
// folder, the same skipped names, never a symlink, never a dot-file, never what a .gitignore names
// (ADR 0173), never the types that cannot be read.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { createContext, Script } from 'node:vm'
import { ToolError, isDotOrIgnoredEntry, isReadBlockedName, resolveInFolder } from './fileRules.mjs'
import { createIgnoreRules } from './gitignore.mjs'

export const SEARCH_DEFAULT_MATCHES = 50
export const SEARCH_MAX_MATCHES = 300
export const SEARCH_MAX_CONTEXT = 5
const MAX_DEPTH = 12
const MAX_PATTERN_LENGTH = 300
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_FILES_VISITED = 50000
const MAX_MS = 10000
// A regular expression can backtrack for ever: each file's scan runs in a script with a time limit,
// and a line is cut at this length before a regular expression sees it.
const REGEX_FILE_MS = 500
const REGEX_LINE_CHARS = 2000
const SHOWN_CHARS = 240

// A glob over the path from the folder, with "/": * (not across folders), ** (across), ? and {a,b}. A
// glob without a "/" is tried against the file name alone, so "*.ts" finds every .ts file.
function globToRegExp(glob) {
  let source = ''
  let braces = 0
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?'
        i += 2
      } else {
        source += '.*'
        i += 1
      }
    } else if (c === '*') source += '[^/]*'
    else if (c === '?') source += '[^/]'
    else if (c === '{') {
      braces += 1
      source += '(?:'
    } else if (c === '}' && braces > 0) {
      braces -= 1
      source += ')'
    } else if (c === ',' && braces > 0) source += '|'
    else source += c.replace(/[.+^$()|[\]\\{}]/g, '\\$&')
  }
  if (braces > 0) throw new ToolError('glob has a "{" without its "}"')
  return new RegExp(`^${source}$`, 'i')
}

// A test for a file: null when there is no glob, else (name, path) => whether it matches.
export function globTest(glob) {
  if (typeof glob !== 'string' || glob.trim() === '') return null
  const re = globToRegExp(glob.trim())
  const onName = !glob.includes('/')
  return (name, path) => re.test(onName ? name : path)
}

// Runs inside a script with a time limit; `text`, `source`, `flags` and `cut` are set on the context.
const REGEX_SCAN = new Script(`
  (() => {
    const re = new RegExp(source, flags)
    const hits = []
    const lines = text.split(/\\r?\\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].length > cut ? lines[i].slice(0, cut) : lines[i]
      re.lastIndex = 0
      const found = re.exec(line)
      if (found) hits.push([i, found.index])
    }
    return JSON.stringify(hits)
  })()
`)

function regexHits(context, text, source, flags) {
  Object.assign(context, { text, source, flags, cut: REGEX_LINE_CHARS })
  return JSON.parse(REGEX_SCAN.runInContext(context, { timeout: REGEX_FILE_MS }))
}

function literalHits(text, needle, ignoreCase) {
  const hits = []
  const lines = text.split(/\r?\n/)
  const wanted = ignoreCase ? needle.toLowerCase() : needle
  for (let i = 0; i < lines.length; i += 1) {
    const at = (ignoreCase ? lines[i].toLowerCase() : lines[i]).indexOf(wanted)
    if (at !== -1) hits.push([i, at])
  }
  return hits
}

// A line for the answer: cut around the match when it is long, so a minified file cannot flood it.
function shown(line, at) {
  if (line.length <= SHOWN_CHARS) return line
  const start = Math.max(0, Math.min(at - 80, line.length - SHOWN_CHARS))
  return `${start > 0 ? '…' : ''}${line.slice(start, start + SHOWN_CHARS)}${start + SHOWN_CHARS < line.length ? '…' : ''}`
}

export function searchFiles(
  root,
  {
    pattern,
    regex = false,
    ignore_case: ignoreCase = false,
    subfolder,
    glob,
    context = 0,
    max_matches: maxMatches = SEARCH_DEFAULT_MATCHES,
    files_only: filesOnly = false
  } = {}
) {
  if (typeof pattern !== 'string' || pattern === '') throw new ToolError('pattern is required')
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new ToolError(`pattern is longer than ${MAX_PATTERN_LENGTH} characters`)
  }
  if (!Number.isInteger(context) || context < 0 || context > SEARCH_MAX_CONTEXT) {
    throw new ToolError(`context must be a whole number from 0 to ${SEARCH_MAX_CONTEXT}`)
  }
  if (!Number.isInteger(maxMatches) || maxMatches < 1 || maxMatches > SEARCH_MAX_MATCHES) {
    throw new ToolError(`max_matches must be a whole number from 1 to ${SEARCH_MAX_MATCHES}`)
  }
  const flags = ignoreCase ? 'i' : ''
  if (regex) {
    try {
      new RegExp(pattern, flags)
    } catch (error) {
      throw new ToolError(`pattern is not a valid regular expression: ${error.message}`)
    }
  }
  const fileWanted = globTest(glob)

  let start = root
  if (typeof subfolder === 'string' && subfolder.trim() !== '') {
    const found = resolveInFolder(root, subfolder, 'read', { mustExist: true })
    if (!statSync(found.absolute).isDirectory()) {
      throw new ToolError(`"${found.relative}" is not a folder`)
    }
    start = found.absolute
  }

  const sandbox = regex ? createContext({}) : null
  const startedAt = Date.now()
  const matches = []
  const perFile = []
  let totalMatches = 0
  let filesVisited = 0
  let filesSearched = 0
  let stopped = null
  const skipped = { tooLarge: 0, notText: 0, tooSlow: 0 }

  const scan = (absolute, path) => {
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      skipped.tooLarge += 1
      return
    }
    const bytes = readFileSync(absolute)
    if (bytes.subarray(0, 8000).includes(0)) {
      skipped.notText += 1
      return
    }
    const text = bytes.toString('utf-8')
    filesSearched += 1
    let hits
    try {
      hits = regex
        ? regexHits(sandbox, text, pattern, flags)
        : literalHits(text, pattern, ignoreCase)
    } catch (error) {
      if (error?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        skipped.tooSlow += 1
        return
      }
      throw error
    }
    if (hits.length === 0) return
    perFile.push({ path, count: hits.length })
    if (filesOnly) {
      totalMatches += hits.length
      return
    }
    const lines = text.split(/\r?\n/)
    let printedUpTo = -1
    for (const [index, at] of hits) {
      if (totalMatches >= maxMatches) {
        stopped = `stopped after ${maxMatches} matches`
        return
      }
      totalMatches += 1
      const first = Math.max(index - context, printedUpTo + 1)
      if (context > 0 && printedUpTo !== -1 && first > printedUpTo + 1) matches.push('--')
      for (let n = first; n <= Math.min(index + context, lines.length - 1); n += 1) {
        matches.push(
          `${path}${n === index ? ':' : '-'}${n + 1}${n === index ? ':' : '-'} ${shown(lines[n], n === index ? at : 0)}`
        )
        printedUpTo = n
      }
    }
  }

  const rules = createIgnoreRules(root, start)
  const walk = (dir, depth, scope) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )
    for (const entry of entries) {
      if (stopped) return
      if (isDotOrIgnoredEntry(entry.name) || entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      const path = full
        .slice(root.length + 1)
        .split(sep)
        .join('/')
      if (entry.isDirectory()) {
        if (rules.skips(scope, path, true)) continue
        if (depth < MAX_DEPTH) walk(full, depth + 1, rules.into(scope, full))
        continue
      }
      if (!entry.isFile() || isReadBlockedName(entry.name)) continue
      if (fileWanted && !fileWanted(entry.name, path)) continue
      if (rules.skips(scope, path, false)) continue
      filesVisited += 1
      if (filesVisited > MAX_FILES_VISITED) {
        stopped = `stopped after looking at ${MAX_FILES_VISITED} files`
        return
      }
      if (Date.now() - startedAt > MAX_MS) {
        stopped = `stopped after ${MAX_MS / 1000} seconds`
        return
      }
      scan(full, path)
    }
  }
  walk(start, 0, rules.scope)

  const skippedNote = Object.entries({
    [`files over ${MAX_FILE_BYTES / (1024 * 1024)} MB`]: skipped.tooLarge,
    'files that are not text': skipped.notText,
    'files where the regular expression took too long': skipped.tooSlow
  })
    .filter(([, count]) => count > 0)
    .map(([what, count]) => `${count} ${what}`)
  const answer = {
    summary: `${totalMatches}${stopped && !filesOnly ? '+' : ''} ${totalMatches === 1 ? 'line matches' : 'lines match'} in ${perFile.length} ${perFile.length === 1 ? 'file' : 'files'} (${filesSearched} files searched)`
  }
  if (filesOnly) {
    answer.files = perFile.map((file) => `${file.path} (${file.count})`)
  } else {
    answer.matches = matches
  }
  if (stopped) {
    answer.stopped = `${stopped}; narrow it with subfolder or glob, or a more exact pattern`
  }
  if (skippedNote.length > 0) answer.skipped = `not searched: ${skippedNote.join(', ')}`
  const ignored = rules.note()
  if (ignored) answer.ignored = ignored
  return answer
}
