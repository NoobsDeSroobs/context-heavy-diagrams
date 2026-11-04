import { readFile } from 'fs/promises'
import { basename, dirname, isAbsolute, relative, sep } from 'path'
// Relative imports with extensions, not aliases: the Claude Desktop extension and its node tests
// load this file without a bundler's alias (ADR 0142).
import { parseDiagram, type DiagramFile } from '../../shared/diagram/index.ts'
import type { NotesContent } from '../../shared/compare/classify.ts'
import type { CompareSession } from '../../shared/compare/session.ts'
import { previewTextChange, sameText } from '../../shared/compare/textPreview.ts'
import { resolveLinkPath } from '../links/linkPaths.ts'
import { gitShow, isSafeRevision, type GitFailure } from './git.ts'

export type GitCompareResult =
  { ok: true; session: CompareSession } | { ok: false; message: string }

// Notes are read a few at a time: each one is a git process.
const NOTE_PARALLELISM = 6

const GIT_MESSAGES: Record<GitFailure, (revision: string, detail: string) => string> = {
  'git-missing': () =>
    'Git was not found. Install git, or add it to your PATH, to compare with a revision.',
  'not-a-repo': () => 'This diagram is not inside a git repository.',
  'not-in-revision': (revision) =>
    `This diagram is not in git at "${revision}" (it may be new or not added yet).`,
  'bad-revision': (revision) => `Git does not know the revision "${revision}".`,
  error: (_revision, detail) => `Git could not read the earlier version: ${detail}`
}

// A path stored in a diagram is untrusted (ADR 0115): only one that stays inside the diagram's
// folder is read, and git gets it relative to that folder.
function insideFolder(folder: string, target: string): string | null {
  const path = relative(folder, target)
  if (path === '' || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) return null
  return path.split(sep).join('/')
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Which notes changed content, for the elements that have the same note path in
// both versions. A changed path is already a link change; only the text needs reading here.
async function changedNotes(
  diagramPath: string,
  revision: string,
  base: DiagramFile,
  next: DiagramFile,
  access: NoteAccess
): Promise<Record<string, NotesContent>> {
  const folder = dirname(diagramPath)
  const baseNotes = new Map(base.nodes.map((n) => [n.id, n.data.notes]))
  const candidates = next.nodes.filter((n) => n.data.notes && n.data.notes === baseNotes.get(n.id))
  const found: Record<string, NotesContent> = {}
  await mapLimit(candidates, NOTE_PARALLELISM, async (node) => {
    const stored = node.data.notes as string
    const absolute = resolveLinkPath(diagramPath, stored)
    const path = insideFolder(folder, absolute)
    if (!path) return
    // A note the caller keeps closed is skipped in git as well as on disk.
    if (access.allowed && !access.allowed(absolute)) return
    const [now, then] = await Promise.all([
      (access.read ?? readText)(absolute),
      gitShow(folder, revision, path)
    ])
    // Any failure other than "not in that revision" says nothing about this note.
    if (!then.ok && then.reason !== 'not-in-revision') return
    const before = then.ok ? then.text : null
    if (before === null && now === null) return
    if (before === null && now !== null) {
      found[node.id] = { state: 'added', preview: previewTextChange('', now) }
    } else if (before !== null && now === null) {
      found[node.id] = { state: 'removed', preview: previewTextChange(before, '') }
    } else if (before !== null && now !== null && !sameText(before, now)) {
      found[node.id] = { state: 'changed', preview: previewTextChange(before, now) }
    }
  })
  return found
}

// Which notes may be read, and how the one on disk is read, both by absolute path. The app uses the
// defaults; the Claude Desktop extension passes its folder rules, so a note it keeps closed (a
// dot-folder, a link leading out of the folder) is not read from disk or from git (ADR 0142).
export interface NoteAccess {
  allowed?: (absolutePath: string) => boolean
  read?: (absolutePath: string) => Promise<string | null> | string | null
}

// The file on disk against the same file at a git revision, with the notes compared too.
export async function buildGitSession(
  diagramPath: string,
  revision: string,
  access: NoteAccess = {}
): Promise<GitCompareResult> {
  if (!isSafeRevision(revision)) {
    return { ok: false, message: `"${revision}" is not a usable git revision.` }
  }
  let next: DiagramFile
  try {
    next = parseDiagram(await readFile(diagramPath, 'utf-8'))
  } catch {
    return { ok: false, message: 'The diagram on disk could not be read.' }
  }
  const name = basename(diagramPath)
  const earlier = await gitShow(dirname(diagramPath), revision, name)
  if (!earlier.ok) {
    return { ok: false, message: GIT_MESSAGES[earlier.reason](revision, earlier.message) }
  }
  let base: DiagramFile
  try {
    base = parseDiagram(earlier.text)
  } catch {
    return { ok: false, message: `The version at "${revision}" is not a readable diagram.` }
  }
  return {
    ok: true,
    session: {
      base,
      next,
      diagramPath,
      title: `Compare with ${revision}: ${name} (git revision → file on disk)`,
      notesContent: await changedNotes(diagramPath, revision, base, next, access)
    }
  }
}
