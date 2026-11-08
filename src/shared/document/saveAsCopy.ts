// Pure planning of "Save As" as a copy (docs/decisions/0160-save-as-copies-into-a-folder-named-after-the-new-diagram.md).
//
// Every file a diagram refers to by a relative path is either copied into a folder named after the
// new diagram, or removed from the copy; nothing is left pointing at the old location. The module
// has no runtime imports and no I/O (the file system comes in as `PlanIo`), so it is tested with
// plain node:test. Paths are relative to the old diagram's folder (for sources) or the new one
// (for destinations), '/'-separated.
//
// The layout: the new diagram `B.chd` keeps its notes and images in `B/…`. Everything else keeps its
// position relative to the old diagram's folder, one level down: `child.chd` becomes
// `B/child.chd`, `sub/x.chd` becomes `B/sub/x.chd`. The old diagram's own folder `A/` maps onto
// `B/`, so a copy of a copy does not nest deeper. Every stored path in every copied diagram is then
// recomputed relative to where that diagram ends up, which is also what rewrites a child's link back
// to the old diagram.

import type { DiagramFile } from '../diagram'

export interface SaveAsOptions {
  notes: boolean
  // Reference images and custom icons.
  images: boolean
  // Linked diagrams, recursively, with the same settings.
  linked: boolean
}

export const DEFAULT_SAVE_AS_OPTIONS: SaveAsOptions = { notes: true, images: true, linked: false }

// What main does with the copied files, before the diagram itself is written.
export type AssetOp =
  // `from` is relative to the old diagram's folder, `to` to the new one.
  | { kind: 'copy'; from: string; to: string }
  // A linked diagram, rewritten for its new place.
  | { kind: 'write'; to: string; content: string }

export interface RemovedRef {
  // The diagram that held the reference, by its place in the copy.
  owner: string
  label: string
  path: string
  reason: string
}

// The reference fields of the root diagram after the copy: a field that is absent here is removed.
export type NodeRefs = Pick<RefData, 'linkedDiagram' | 'references' | 'icons'>

export interface SaveAsPlan {
  assets: AssetOp[]
  // nodeId -> that node's new linkedDiagram / references / icons. Notes of the root diagram are
  // not in here: they follow the save planner (documentSave.ts).
  rootRefs: Record<string, NodeRefs>
  counts: { notes: number; images: number; linked: number }
  removed: RemovedRef[]
  // Why the copy cannot be made. Empty = it can.
  problems: string[]
}

interface IconLike {
  source: string
  path?: string
  id?: string
}

export interface RefData {
  label?: string
  notes?: string
  linkedDiagram?: string
  references?: string[]
  icons?: Record<string, IconLike | undefined>
  [key: string]: unknown
}

export interface RefNode {
  id: string
  data: RefData
}

// What the renderer asks main for: the plan of a Save As.
export interface PlanSaveAsRequest {
  // The diagram being saved as, which the old folder belongs to.
  currentPath: string
  newPath: string
  options: SaveAsOptions
  // The diagram as it is in the window: its references may differ from what is on disk.
  nodes: RefNode[]
}

export interface PlanIo {
  // A file inside the old diagram's folder (never outside it).
  exists(rel: string): Promise<boolean>
  // The diagram at `rel`, or null if it is missing or cannot be read.
  readDiagram(rel: string): Promise<DiagramFile | null>
  serialize(diagram: DiagramFile): string
}

// ---------------------------------------------------------------------------
// Paths

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

function stemOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

// A stored path resolved against a folder inside the old diagram's folder. null = it reaches
// outside that folder, is absolute, or names a drive or stream: never copied (ADR 0115).
export function resolveRel(dir: string, stored: string): string | null {
  if (stored === '' || stored.includes(':') || /^[\\/]/.test(stored)) return null
  const stack = dir === '' ? [] : dir.split('/')
  for (const segment of stored.split(/[\\/]/)) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (stack.length === 0) return null
      stack.pop()
    } else stack.push(segment)
  }
  return stack.length > 0 ? stack.join('/') : null
}

// `to` as written from a diagram that lives in `fromDir`.
export function relativeFrom(fromDir: string, to: string): string {
  const a = fromDir === '' ? [] : fromDir.split('/')
  const b = to.split('/')
  let i = 0
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

// ---------------------------------------------------------------------------
// Walking the references of a diagram's nodes. The one place that knows which fields hold a path.

export type RefKind = 'notes' | 'image' | 'linked'

export interface Ref {
  kind: RefKind
  path: string
  node: RefNode
}

// The fields of a node's `data` that hold a relative path (schema.ts files: `notes`,
// `linkedDiagram`, `references`, and the path of a custom icon). A test reads the schema and fails
// when a documented path field is missing from this list.
export const PATH_FIELDS = ['notes', 'linkedDiagram', 'references', 'icons'] as const

// Maps every stored path through `fn`: a string replaces it, null removes it. Returns copies.
export async function mapRefs<N extends RefNode>(
  nodes: N[],
  fn: (ref: Ref) => Promise<string | null>
): Promise<N[]> {
  const out: N[] = []
  for (const node of nodes) {
    const data: RefData = { ...node.data }
    const one = async (kind: RefKind, path: unknown): Promise<string | null | undefined> =>
      typeof path === 'string' && path !== '' ? fn({ kind, path, node }) : undefined

    for (const [field, kind] of [
      ['notes', 'notes'],
      ['linkedDiagram', 'linked']
    ] as const) {
      const result = await one(kind, data[field])
      if (result === null) delete data[field]
      else if (result !== undefined) data[field] = result
    }

    if (Array.isArray(data.references)) {
      const kept: string[] = []
      for (const path of data.references) {
        const result = await one('image', path)
        if (result === undefined) kept.push(path)
        else if (result !== null) kept.push(result)
      }
      if (kept.length > 0) data.references = kept
      else delete data.references
    }

    if (data.icons) {
      const icons: Record<string, IconLike | undefined> = {}
      for (const [slot, icon] of Object.entries(data.icons)) {
        if (icon?.source === 'custom') {
          const result = await one('image', icon.path)
          if (result === null) continue
          icons[slot] = result === undefined ? icon : { ...icon, path: result }
        } else icons[slot] = icon
      }
      if (Object.keys(icons).length > 0) data.icons = icons
      else delete data.icons
    }

    out.push({ ...node, data } as N)
  }
  return out
}

// ---------------------------------------------------------------------------
// Planning

export interface PlanInput {
  oldFileName: string
  newFileName: string
  // The diagram being saved, as far as references go (it may differ from what is on disk).
  rootNodes: RefNode[]
  options: SaveAsOptions
  io: PlanIo
}

export async function planSaveAsCopy(input: PlanInput): Promise<SaveAsPlan> {
  const { oldFileName, newFileName, options, io } = input
  const oldBase = stemOf(oldFileName)
  const newBase = stemOf(newFileName)

  const assets = new Map<string, AssetOp>()
  const sourceOf = new Map<string, string>()
  const removed: RemovedRef[] = []
  const problems: string[] = []
  const counts = { notes: 0, images: 0, linked: 0 }
  const counted = new Set<string>()
  const visited = new Set<string>([oldFileName.toLowerCase()])

  const mapDest = (source: string): string => {
    if (source === oldFileName) return newFileName
    if (source.startsWith(`${oldBase}/`)) return `${newBase}/${source.slice(oldBase.length + 1)}`
    return `${newBase}/${source}`
  }

  // One source per destination; two sources onto one name (or onto the same name in another case,
  // which Windows treats as one file) cannot be copied.
  const claim = (dest: string, source: string): void => {
    const key = dest.toLowerCase()
    const previous = sourceOf.get(key)
    if (previous !== undefined && previous.toLowerCase() !== source.toLowerCase()) {
      problems.push(`Both "${previous}" and "${source}" would be copied to "${dest}".`)
    }
    sourceOf.set(key, previous ?? source)
  }

  const count = (kind: 'notes' | 'images' | 'linked', source: string): void => {
    const key = `${kind}:${source.toLowerCase()}`
    if (counted.has(key)) return
    counted.add(key)
    counts[kind] += 1
  }

  // Maps the references of one diagram. `fromRel` is the diagram's file in the old folder, `toRel` its
  // place in the copy ('' for the root, whose own references are not written here).
  const walk = async <N extends RefNode>(
    nodes: N[],
    fromRel: string,
    toRel: string,
    isRoot: boolean
  ): Promise<N[]> => {
    const fromDir = dirOf(fromRel)
    const toDir = dirOf(toRel)
    const owner = isRoot ? newFileName : toRel
    const drop = (ref: Ref, reason: string): null => {
      removed.push({ owner, label: ref.node.data.label ?? ref.node.id, path: ref.path, reason })
      return null
    }

    return mapRefs(nodes, async (ref) => {
      const isNote = ref.kind === 'notes'
      // The root's own notes are planned with the save (documentSave.ts); only counted here.
      const enabled =
        ref.kind === 'linked' ? options.linked : isNote ? options.notes : options.images
      const source = resolveRel(fromDir, ref.path)

      // What is not ticked is still counted, so the dialog can say how much goes.
      if (!enabled && ref.kind !== 'linked' && source !== null && (await io.exists(source))) {
        count(isNote ? 'notes' : 'images', source)
      }
      if (!enabled) return isRoot && isNote ? ref.path : null
      if (source === null) return drop(ref, "outside this diagram's folder")

      if (ref.kind !== 'linked') {
        if (!(await io.exists(source))) return drop(ref, 'file not found')
        count(isNote ? 'notes' : 'images', source)
        if (isRoot && isNote) return ref.path
        const dest = mapDest(source)
        claim(dest, source)
        assets.set(dest.toLowerCase(), { kind: 'copy', from: source, to: dest })
        return relativeFrom(toDir, dest)
      }

      const dest = mapDest(source)
      if (source.toLowerCase() === oldFileName.toLowerCase()) {
        return relativeFrom(toDir, newFileName)
      }
      if (visited.has(source.toLowerCase())) {
        count('linked', source)
        return relativeFrom(toDir, dest)
      }
      const child = await io.readDiagram(source)
      if (child === null) return drop(ref, 'diagram not found')
      visited.add(source.toLowerCase())
      count('linked', source)
      claim(dest, source)
      const childNodes = await walk(child.nodes, source, dest, false)
      assets.set(dest.toLowerCase(), {
        kind: 'write',
        to: dest,
        content: io.serialize({ ...child, nodes: childNodes })
      })
      return relativeFrom(toDir, dest)
    })
  }

  const rootNodes = await walk(input.rootNodes, oldFileName, newFileName, true)

  const rootRefs: Record<string, NodeRefs> = {}
  for (const [i, node] of rootNodes.entries()) {
    const before = input.rootNodes[i].data
    if (!before.linkedDiagram && !before.references && !before.icons) continue
    const { linkedDiagram, references, icons } = node.data
    const refs: NodeRefs = {}
    if (linkedDiagram !== undefined) refs.linkedDiagram = linkedDiagram
    if (references !== undefined) refs.references = references
    if (icons !== undefined) refs.icons = icons
    rootRefs[node.id] = refs
  }

  if (!options.linked) {
    // Not walked: say how many links go, so the dialog can tell.
    for (const node of input.rootNodes) {
      const link = node.data.linkedDiagram
      const source = typeof link === 'string' ? resolveRel('', link) : null
      if (source !== null && (await io.exists(source))) count('linked', source)
    }
  }

  return { assets: [...assets.values()], rootRefs, counts, removed, problems }
}

// ---------------------------------------------------------------------------
// The window's side of the plan

// The reference fields of the window's nodes, which is all main needs to plan a copy.
export function refNodesOf(nodes: { id: string; data?: Record<string, unknown> }[]): RefNode[] {
  return nodes.map((node) => {
    const data = node.data ?? {}
    const out: RefData = {}
    if (typeof data.label === 'string') out.label = data.label
    if (typeof data.notes === 'string') out.notes = data.notes
    if (typeof data.linkedDiagram === 'string') out.linkedDiagram = data.linkedDiagram
    if (Array.isArray(data.references)) out.references = data.references as string[]
    if (data.icons && typeof data.icons === 'object') out.icons = data.icons as RefData['icons']
    return { id: node.id, data: out }
  })
}

// The window's nodes as the copy will have them: the reference fields from the plan, and no notes
// when they were not ticked.
export function applySaveAsRefs<N extends { id: string; data: Record<string, unknown> }>(
  nodes: N[],
  plan: Pick<SaveAsPlan, 'rootRefs'>,
  options: SaveAsOptions
): N[] {
  return nodes.map((node) => {
    const refs = plan.rootRefs[node.id]
    if (!refs && (options.notes || !('notes' in node.data))) return node
    const data = { ...node.data }
    if (!options.notes) delete data.notes
    if (refs) {
      for (const key of ['linkedDiagram', 'references', 'icons'] as const) {
        if (key in refs) data[key] = refs[key]
        else delete data[key]
      }
    }
    return { ...node, data }
  })
}
