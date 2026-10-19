import type { Edge, Node } from '@xyflow/react'
import type { IconRef, IconSlot } from '@shared/diagram'

// Real OS clipboard, not in-app state: each diagram has its own BrowserWindow (ADR 0023), so a
// React-state clipboard couldn't cross windows (separate renderer processes), while the system
// clipboard makes cross-window and cross-diagram paste work for free and matches what users expect.
// Plain JSON text, not a custom native format; Electron's clipboard is reached through two small
// IPC calls in the sandboxed preload (main/clipboard.ts, ADR 0112). The `chdClipboard` marker tells
// our payload from arbitrary copied text; an unmarked or malformed clipboard is a silent no-op on
// paste, never an error, like duplicateSelected with nothing selected.
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

// Regenerates every node/edge id (the old-to-new map is built first so edges remap source/target
// consistently) and repositions the group as a unit, keeping each node's offset from the group's
// centroid, so a multi-node copy pastes in the same arrangement recentred on `center` (the original
// absolute position could be far outside the current viewport, especially when pasting into another
// diagram; ADR 0049). Connection point ids are left alone: they are only looked up together with
// their owning node's id, so two nodes both having a "cp-3" is normal, not a collision.
//
// A node's four resource-path fields (`linkedDiagram`, `details`, a custom `icons[slot].path`, each
// entry of `references`) are stored relative to the diagram file that owns them
// (docs/file-format.md, "Linking and file organization"). Paste never copies or moves the file a
// path points at, so it can't make a broken reference resolve; whether a paste should share, fork
// or drop those files is the user's call. What it can do safely: when a path starts with the source
// diagram's own name, the default home for a diagram's resources (`<diagram-name>/assets/...`,
// `<diagram-name>/details/...`, a new `<diagram-name>/<child>.chd`; see
// linkPaths.ts/links.ts/icons.ts), that leading segment is relabelled to the destination diagram's
// name. The file hasn't moved, so the path is exactly as unresolved as before and Diagnostics (ADR
// 0084) flags it either way; but if the user then copies the file into the new diagram's own
// folder, the path is already right, with no separate Relink. If they never do, nothing is lost:
// the same "not found" row and recovery options, against the new name. A path that doesn't match
// the source name (hand-relinked, absolute, or deliberately pointing at another diagram's file) is
// left untouched.
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
  for (const n of payload.nodes) idMap.set(n.id, newId(n.type ?? 'entity'))
  const destDiagramBaseName = diagramBaseName(destDiagramPath)

  const hasParentInPayload = (n: Node): boolean => n.parentId != null && idMap.has(n.parentId)

  // The middle of the group's bounding box, over top-level-within-payload nodes
  // only — a contained child's coordinates are parent-relative (small numbers),
  // a different space than a top-level node's, and mixing the two skews where the
  // group lands. Sizes are included so the group's visual centre, not its
  // top-left corner, lands on the paste point (a lone entity used to hang off
  // the point by half its size). A node with no recorded size counts as a point.
  const topLevel = payload.nodes.filter((n) => !hasParentInPayload(n))
  const sizeOf = (n: Node): { w: number; h: number } => ({
    w: n.width ?? n.measured?.width ?? 0,
    h: n.height ?? n.measured?.height ?? 0
  })
  const left = Math.min(...topLevel.map((n) => n.position.x))
  const top = Math.min(...topLevel.map((n) => n.position.y))
  const right = Math.max(...topLevel.map((n) => n.position.x + sizeOf(n).w))
  const bottom = Math.max(...topLevel.map((n) => n.position.y + sizeOf(n).h))
  const centroid = topLevel.length
    ? { x: (left + right) / 2, y: (top + bottom) / 2 }
    : { x: 0, y: 0 }

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
