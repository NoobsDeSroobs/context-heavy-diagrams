import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { parseDiagram, type DiagramFile } from '../shared/diagram/index.ts'
import type { NotesContent } from '../shared/compare/classify.ts'
import {
  compareDiagrams,
  diffToJson,
  formatDiffText,
  hasChanges,
  notesBetween,
  type Compared
} from '../shared/compare/report.ts'
import { containedPath } from '../main/containedPath.ts'
import { buildGitSession } from '../main/compare/gitCompare.ts'

// `chd diff`: what changed in a diagram between two versions, the same review the app's compare
// window gives, for a terminal, CI and an assistant that wants to tell a person what it changed.
// Bundled into resources/cli/diff.mjs by scripts/build-cli.mjs; chd.mjs loads it only for this
// command. Read-only, so the stale-edit rule (ADR 0109) does not apply.

export const DIFF_USAGE = `Usage: chd diff <old.chd> <new.chd> [options]
       chd diff <file.chd> [--rev <revision>] [options]

Shows what changed in a diagram between two versions, in the order a reviewer should look:
security assessments, links and notes, modified elements, removed, added. Moving or resizing an
element is not a change; a changed note, link, label, tag or connection is.

  <old.chd> <new.chd>   Two files; the first is the earlier version.
  <file.chd>            One file: the file on disk against the same file in git at --rev.
  --rev <revision>      A branch, a tag, a commit or HEAD~2 (default HEAD). Needs git.
  --match               The ids were replaced (an assistant rewrote the diagram): pair removed and
                        added elements with the same type and similar name and place, so they show
                        as edited, not replaced. A guess; it says how many it paired.
  --json                Print the result as JSON instead of text.
  --exit-code           Exit 1 when anything changed (like git diff --exit-code).

It only reads the diagrams. A changed note (a note file) is found by comparing the note files
beside the two diagrams, or the note at the revision.

Exit codes: 0 ok, 1 something changed (only with --exit-code), 2 usage error, 3 a version could
not be read.
`

class UsageError extends Error {}
class ReadError extends Error {}

interface Parsed {
  files: string[]
  rev?: string
  match: boolean
  json: boolean
  exitCode: boolean
}

function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = { files: [], match: false, json: false, exitCode: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--rev') {
      if (i + 1 >= args.length) throw new UsageError('--rev needs a value')
      parsed.rev = args[i + 1]
      i += 1
    } else if (arg === '--match') parsed.match = true
    else if (arg === '--json') parsed.json = true
    else if (arg === '--exit-code') parsed.exitCode = true
    else if (arg.startsWith('-')) throw new UsageError(`unknown option '${arg}'`)
    else parsed.files.push(arg)
  }
  if (parsed.files.length === 0) throw new UsageError('no diagram file given')
  if (parsed.files.length > 2) throw new UsageError(`unexpected argument '${parsed.files[2]}'`)
  if (parsed.files.length === 2 && parsed.rev !== undefined) {
    throw new UsageError('--rev compares one file with git; give one file, or two without --rev')
  }
  return parsed
}

function readDiagram(path: string): DiagramFile {
  try {
    return parseDiagram(readFileSync(path, 'utf-8'))
  } catch (error) {
    throw new ReadError(`can't read '${path}': ${error instanceof Error ? error.message : error}`)
  }
}

function readNote(path: string | null): string | null {
  if (path === null || !existsSync(path)) return null
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

// Notes whose text differs between two diagrams on disk, for the elements that
// have the same note path in both. A path leaving the diagram's folder is never read (ADR 0115).
function notesBetweenFiles(
  olderPath: string,
  newerPath: string,
  older: DiagramFile,
  newer: DiagramFile
): Record<string, NotesContent> {
  return notesBetween(older, newer, {
    before: (stored) => readNote(containedPath(dirname(olderPath), stored)),
    after: (stored) => readNote(containedPath(dirname(newerPath), stored))
  })
}

async function compare(parsed: Parsed): Promise<Compared> {
  let older: DiagramFile
  let newer: DiagramFile
  let olderName: string
  let newerName: string
  let notes: Record<string, NotesContent>
  if (parsed.files.length === 2) {
    const [olderPath, newerPath] = parsed.files.map((f) => resolve(f))
    older = readDiagram(olderPath)
    newer = readDiagram(newerPath)
    olderName = parsed.files[0]
    newerName = parsed.files[1]
    notes = notesBetweenFiles(olderPath, newerPath, older, newer)
  } else {
    const path = resolve(parsed.files[0])
    const revision = parsed.rev ?? 'HEAD'
    const result = await buildGitSession(path, revision)
    if (!result.ok) throw new ReadError(result.message)
    older = result.session.base
    newer = result.session.next
    olderName = `${basename(path)} at ${revision}`
    newerName = `${basename(path)} on disk`
    notes = result.session.notesContent ?? {}
  }
  return compareDiagrams(older, newer, { olderName, newerName, match: parsed.match, notes })
}

export async function runDiff(args: string[]): Promise<number> {
  let parsed: Parsed
  try {
    parsed = parseArgs(args)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`chd: ${error.message}\n\n${DIFF_USAGE}`)
    return 2
  }
  let result: Compared
  try {
    result = await compare(parsed)
  } catch (error) {
    if (!(error instanceof ReadError)) throw error
    console.error(`chd: ${error.message}`)
    return 3
  }
  console.log(parsed.json ? JSON.stringify(diffToJson(result), null, 2) : formatDiffText(result))
  return parsed.exitCode && hasChanges(result.classification) ? 1 : 0
}
