import { ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative } from 'path'
import {
  parseDiagram,
  serializeDiagram,
  type DiagramFile,
  type RequiredTagDefinition
} from '@shared/diagram'
import { resolveLinkPath } from './linkPaths'

function normalizePath(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

// A diagram's own children/assets/details colocate in a same-named
// sibling folder (ADR 0005/0006) — e.g. main.chd's children live in
// main/, not directly next to main.chd itself. Mirrors
// linkedDiagramDirFor in links.ts.
function colocationDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase)
}

// A link can legitimately point entirely outside its own diagram's folder
// (ADR 0005 — e.g. a diagram for an externally-maintained integrated
// service), including as a plain sibling file sitting right next to it
// rather than nested in its colocation folder. Propagating this diagram's
// own required-tags template onto something like that would reach into a
// file this diagram doesn't own — so the walk never crosses outside the
// root diagram's own colocation folder. A same-level sibling .chd is
// therefore treated as external too, not "under" the root, even though
// it's technically inside the same containing directory. See ADR 0024.
function isUnderRoot(rootColocationDir: string, candidatePath: string): boolean {
  const rel = relative(rootColocationDir, candidatePath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// Display form for the preview/result lists the renderer shows the user —
// relative to the root diagram's own directory (not its colocation
// folder), matching how a linkedDiagram path already reads on a node
// (e.g. "main/internal.chd"), so an external path outside that tree
// still reads sensibly instead of degenerating to "..".
function toDisplayPath(rootDiagramPath: string, absolutePath: string): string {
  return relative(dirname(rootDiagramPath), absolutePath).split('\\').join('/')
}

function childRelativePaths(diagram: DiagramFile): string[] {
  const paths: string[] = []
  for (const node of diagram.nodes) {
    if (typeof node.data?.linkedDiagram === 'string') paths.push(node.data.linkedDiagram)
  }
  return paths
}

// Parent wins on a key collision; a child's own extra required tags (keys
// the parent doesn't have) survive — a sub-diagram's genuinely
// diagram-specific fields aren't destroyed by a copy. See ADR 0024.
function mergeRequiredTags(
  parentTags: RequiredTagDefinition[],
  childTags: RequiredTagDefinition[] | undefined
): RequiredTagDefinition[] {
  const parentKeys = new Set(parentTags.map((t) => t.key))
  const childOnly = (childTags ?? []).filter((t) => !parentKeys.has(t.key))
  return [...parentTags, ...childOnly]
}

// Paths here are display-relative (toDisplayPath), not absolute — the
// only consumer is the renderer's preview/result UI.
interface WalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

// Shared by the read-only preview and the actual copy — visit() is called
// once per reachable, in-tree, readable diagram; for the preview it's a
// no-op read, for the copy it merges and writes. Cycle-guarded (visited,
// keyed by normalized absolute path) even though links are only supposed
// to point downward (ADR 0005) — a hand-edited file could still create
// one, and two branches can legitimately share a child.
async function walk(
  rootPath: string,
  directChildRelativePaths: string[],
  visit: (path: string, diagram: DiagramFile) => Promise<DiagramFile>
): Promise<WalkResult> {
  const rootColocationDir = colocationDirFor(rootPath)
  const visited = new Set<string>()
  const reached: string[] = []
  const external: string[] = []
  const unreadable: string[] = []
  const queue = directChildRelativePaths.map((rel) => resolveLinkPath(rootPath, rel))

  while (queue.length > 0) {
    const path = queue.shift() as string
    const key = normalizePath(path)
    if (visited.has(key)) continue
    visited.add(key)

    if (!isUnderRoot(rootColocationDir, path)) {
      external.push(toDisplayPath(rootPath, path))
      continue
    }

    let diagram: DiagramFile
    try {
      diagram = parseDiagram(await readFile(path, 'utf-8'))
    } catch {
      unreadable.push(toDisplayPath(rootPath, path))
      continue
    }

    const finalDiagram = await visit(path, diagram)
    reached.push(toDisplayPath(rootPath, path))

    for (const rel of childRelativePaths(finalDiagram)) {
      queue.push(resolveLinkPath(path, rel))
    }
  }

  return { reached, external, unreadable }
}

export function registerRequiredTagsHandlers(): void {
  ipcMain.handle(
    'requiredTags:previewChildren',
    async (_event, diagramPath: string, directChildRelativePaths: string[]) =>
      walk(diagramPath, directChildRelativePaths, async (_path, diagram) => diagram)
  )

  ipcMain.handle(
    'requiredTags:copyToChildren',
    async (
      _event,
      diagramPath: string,
      requiredTags: RequiredTagDefinition[],
      directChildRelativePaths: string[]
    ) =>
      walk(diagramPath, directChildRelativePaths, async (path, diagram) => {
        const merged = mergeRequiredTags(requiredTags, diagram.requiredTags)
        if (JSON.stringify(merged) === JSON.stringify(diagram.requiredTags ?? [])) return diagram
        const updated: DiagramFile = { ...diagram, requiredTags: merged }
        await writeFile(path, serializeDiagram(updated), 'utf-8')
        return updated
      })
  )
}
