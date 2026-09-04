import type { Edge, Node } from '@xyflow/react'
import type { IconRef, IconSlot } from '@shared/diagram'

// Real OS clipboard, not in-app-only state — this app already committed to
// one real BrowserWindow per diagram (ADR 0023), so an in-app
// React-state clipboard couldn't cross windows at all (separate renderer
// processes); the system clipboard makes cross-window/cross-diagram paste
// work for free, and matches what a user already expects from every other
// desktop app. Plain JSON text, not a custom native format — Electron's
// clipboard exposes `writeText`/`readText` directly in the (unsandboxed,
// see main/windows.ts's `sandbox: false`) preload with no IPC round-trip
// needed. The `chdClipboard` marker is what tells "this is our own payload"
// apart from arbitrary text the user copied from somewhere else — an
// unmarked or malformed clipboard is just a silent no-op on paste, never an
// error, same as duplicateSelected's own "nothing selected, do nothing."
export interface ClipboardPayload {
  chdClipboard: true
  version: 1
  nodes: Node[]
  edges: Edge[]
  // Base name (no extension) of the diagram this was copied *from* — e.g.
  // "Project Overview" for ".../Project Overview.chd", null for an
  // unsaved diagram. Used only by retargetResourcePath below to relabel a
  // default colocation-folder prefix on paste; see its own comment for why
  // this is a relabel, not a repair. Optional on read so a clipboard entry
  // written by an older build (before this field existed) still parses —
  // paste then just leaves resource paths untouched, today's behavior.
  sourceDiagramBaseName: string | null
}

// path.basename(p, path.extname(p)) without importing Node's `path` module
// (this renderer doesn't use it anywhere else — see the same manual-split
// convention at this file's other call site, Canvas.tsx's PNG-export
// suggested-filename derivation).
export function diagramBaseName(diagramPath: string | null): string | null {
  if (!diagramPath) return null
  const fileName = diagramPath.split(/[\\/]/).pop() ?? diagramPath
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

// Edges tag along only when *both* endpoints are also being copied — a
// dangling edge with a missing endpoint isn't representable once ids get
// regenerated on paste, and copying "just an edge" alone was never the
// ask ("copy/paste for nodes... edges between copied nodes").
export function buildClipboardPayload(
  selectedNodes: Node[],
  allEdges: Edge[],
  sourceDiagramPath: string | null
): ClipboardPayload {
  const selectedIds = new Set(selectedNodes.map((n) => n.id))
  const edges = allEdges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
  return {
    chdClipboard: true,
    version: 1,
    nodes: selectedNodes,
    edges,
    sourceDiagramBaseName: diagramBaseName(sourceDiagramPath)
  }
}

export function parseClipboardPayload(text: string): ClipboardPayload | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { chdClipboard?: unknown }).chdClipboard === true &&
      Array.isArray((parsed as { nodes?: unknown }).nodes) &&
      Array.isArray((parsed as { edges?: unknown }).edges)
    ) {
      return parsed as ClipboardPayload
    }
    return null
  } catch {
    return null
  }
}

// Regenerates every node/edge id (old id -> new id map built first so
// edges can remap source/target consistently) and repositions the whole
// group as a unit, preserving each node's offset from the group's own
// centroid — so a multi-node copy pastes back in the same relative
// arrangement, just recentered on `center` rather than reusing the
// original absolute position (which could be far outside the current
// viewport, especially pasting into a different diagram entirely — see
// ADR 0049). Connection point ids are left untouched: they're only ever
// looked up in combination with their owning node's id, so two different
// nodes reusing the same point id (e.g. both having a "cp-3") is already
// normal, not a collision.
//
// A node's four resource-path fields (`linkedDiagram`, `details`, a custom
// `icons[slot].path`, each entry of `references`) are all stored relative to
// *the diagram file that owns them* (docs/file-format.md's "Linking and
// file organization"). Paste never copies or moves the file a path points
// at, so it can never make a broken reference resolve on its own — deciding
// whether a paste is meant to share, fork, or drop those files is the
// user's call, not this app's to guess (only *they* know if this is a
// carbon copy, a move, or a copy-then-diverge). What paste *can* safely do:
// when a path starts with the source diagram's own name — this app's
// standing default for where a diagram's own resources live
// (`<diagram-name>/assets/...`, `<diagram-name>/details/...`, a freshly
// created `<diagram-name>/<child>.chd`; see linkPaths.ts/links.ts/icons.ts)
// — relabel that leading segment to the *destination* diagram's own name.
// This never turns a broken reference into a resolving one by itself: the
// underlying file hasn't moved, so the relabeled path is exactly as
// unresolved as the original one was, and Diagnostics (ADR 0084) still
// flags it either way. What it does do: if the user's actual next step is
// to copy the referenced file into the new diagram's own colocation folder
// (the same convention this app already uses everywhere), the path is
// already correct once they do — no separate manual Relink needed on top.
// If they never do that, nothing was lost: same "not found" row, same
// recovery options, just against the new diagram's own name instead of the
// old one's. A path that doesn't match the source name at all — hand-relinked,
// absolute, or an intentional pointer at some other diagram's file — is left
// completely untouched, since there's no colocation-default reasoning that
// applies to it.
function retargetResourcePath(
  path: string,
  sourceDiagramBaseName: string | null,
  destDiagramBaseName: string | null
): string {
  if (
    !sourceDiagramBaseName ||
    !destDiagramBaseName ||
    sourceDiagramBaseName === destDiagramBaseName
  ) {
    return path
  }
  if (path === sourceDiagramBaseName) return destDiagramBaseName
  const prefix = `${sourceDiagramBaseName}/`
  return path.startsWith(prefix) ? destDiagramBaseName + '/' + path.slice(prefix.length) : path
}

function retargetNodeData(
  data: Record<string, unknown>,
  sourceDiagramBaseName: string | null,
  destDiagramBaseName: string | null
): Record<string, unknown> {
  if (!sourceDiagramBaseName || !destDiagramBaseName) return data
  const retarget = (p: string): string =>
    retargetResourcePath(p, sourceDiagramBaseName, destDiagramBaseName)
  const next = { ...data }
  if (typeof next.linkedDiagram === 'string') next.linkedDiagram = retarget(next.linkedDiagram)
  if (typeof next.details === 'string') next.details = retarget(next.details)
  const icons = next.icons as Partial<Record<IconSlot, IconRef>> | undefined
  if (icons) {
    next.icons = Object.fromEntries(
      Object.entries(icons).map(([slot, ref]) => [
        slot,
        ref?.source === 'custom' ? { ...ref, path: retarget(ref.path) } : ref
      ])
    )
  }
  if (Array.isArray(next.references)) {
    next.references = (next.references as string[]).map(retarget)
  }
  return next
}

// `parentId` (container nesting, ADR 0012 / ADR 0075): if the node's parent
// container is also in the payload, the link is remapped through `idMap` and
// the child's parent-relative `position` is left untouched (still valid
// relative to the remapped parent). If it isn't — an orphaned child, or a
// cross-diagram paste — `parentId` is stripped and the node becomes a normal
// top-level paste. Only top-level nodes get the centroid recenter; a child's
// position stays relative to its parent.
export function remapForPaste(
  payload: ClipboardPayload,
  newId: (prefix: string) => string,
  center: { x: number; y: number },
  destDiagramPath: string | null
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>()
  for (const n of payload.nodes) idMap.set(n.id, newId(n.type ?? 'shape'))
  const destDiagramBaseName = diagramBaseName(destDiagramPath)

  const hasParentInPayload = (n: Node): boolean => n.parentId != null && idMap.has(n.parentId)

  // Centroid over top-level-within-payload nodes only — a contained child's
  // coordinates are parent-relative (small numbers), a different space than a
  // top-level node's, and averaging the two together skews where the group lands.
  const topLevel = payload.nodes.filter((n) => !hasParentInPayload(n))
  const count = topLevel.length || 1
  const centroid = {
    x: topLevel.reduce((sum, n) => sum + n.position.x, 0) / count,
    y: topLevel.reduce((sum, n) => sum + n.position.y, 0) / count
  }

  const nodes = payload.nodes.map((n) => {
    const base = {
      ...n,
      id: idMap.get(n.id)!,
      selected: true,
      data: retargetNodeData(n.data, payload.sourceDiagramBaseName, destDiagramBaseName)
    }
    if (hasParentInPayload(n)) {
      return { ...base, parentId: idMap.get(n.parentId!)! }
    }
    // Top-level (or a child whose parent wasn't copied): drop any dangling
    // parentId and recenter on the paste point.
    delete base.parentId
    return {
      ...base,
      position: {
        x: center.x + (n.position.x - centroid.x),
        y: center.y + (n.position.y - centroid.y)
      }
    }
  })

  const edges = payload.edges.map((e) => {
    // Drop any per-set direction records (ADR 0081) — their stored
    // source/target node ids point at the *original* nodes, not the
    // remapped copies. The pasted edge re-seeds every set from its own
    // (correctly remapped) live direction at the next save or set switch.
    const data: Record<string, unknown> = { ...e.data }
    delete data.directionSets
    return {
      ...e,
      id: newId('edge'),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: true,
      data
    }
  })

  return { nodes, edges }
}
