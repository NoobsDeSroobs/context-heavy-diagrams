// The answers both front doors (the extension's tools and the `chd` command line) give about a diagram
// being built, written once so they cannot drift apart (ADR 0138). Pure: a front door adds what only
// it knows, the path and the fingerprint.
import type { DiagramFile } from '../diagram/index.ts'
import { describeDiagram, layoutIssues } from './inspect.ts'
import { groupMessages } from './issues.ts'
import type { OperationResult } from './model.ts'

// At most this many operations in one call.
export const MAX_OPERATIONS = 200
// At most this many nodes and edges in one inspection.
export const INSPECT_LIMIT = 400

// What is wrong with the layout so far, one line for each kind of problem. `only` keeps the problems
// that involve one of those element ids.
export function editIssues(diagram: DiagramFile, only?: ReadonlySet<string>): string[] {
  const issues = layoutIssues(diagram, diagram.fontFamily)
  return groupMessages(
    only ? issues.filter((issue) => issue.ids.some((id) => only.has(id))) : issues
  )
}

// What an edit answers about the layout: the problems that involve an element the call touched (made,
// changed or named, with whatever sits inside a touched container), then one line with the number of
// the others, which `inspect` lists when asked (ADR 0171).
export function editAnswerIssues(
  diagram: DiagramFile,
  results: readonly OperationResult[]
): string[] {
  const touched = new Set<string>()
  for (const result of results) {
    if (result.element) touched.add(result.element.id)
    for (const id of result.removed ?? []) touched.add(id)
  }
  // Moving or resizing a container changes where everything inside it stands.
  const parent = new Map(diagram.nodes.map((n) => [n.id, n.parentId]))
  for (const node of diagram.nodes) {
    for (let at = node.parentId, hops = 0; at !== undefined && hops < 200; hops += 1) {
      if (touched.has(at)) {
        touched.add(node.id)
        break
      }
      at = parent.get(at)
    }
  }
  const all = layoutIssues(diagram, diagram.fontFamily)
  const mine = all.filter((issue) => issue.ids.some((id) => touched.has(id)))
  const lines = groupMessages(mine)
  const others = all.length - mine.length
  if (others > 0) {
    lines.push(
      `${others} other problem${others === 1 ? '' : 's'} elsewhere in the diagram ${others === 1 ? 'was' : 'were'} left out; list ${others === 1 ? 'it' : 'them'} with inspect_diagram issues_only (chd ask inspect --issues-only)`
    )
  }
  return lines
}

export interface InspectOptions {
  // Also the style fields each element sets.
  styles?: boolean
  // Only the problems, not the elements.
  issuesOnly?: boolean
  // Only these elements (nodes and edges), and the problems that involve them.
  ids?: string[]
  // Only this container, everything inside it at any depth, and the edges that touch them.
  container?: string
}

// The elements a narrowed inspection covers: the ids of its nodes and edges, and what was asked for
// but is not in the diagram. With both options an element must satisfy both.
function focusOf(
  diagram: DiagramFile,
  { ids, container }: InspectOptions
): { focus: Set<string>; unknown: string[] } {
  const nodeIds = new Set(diagram.nodes.map((n) => n.id))
  const edgeIds = new Set(diagram.edges.map((e) => e.id))
  const unknown = (ids ?? []).filter((id) => !nodeIds.has(id) && !edgeIds.has(id))
  const nodes = new Set(nodeIds)
  if (container !== undefined) {
    const parent = new Map(diagram.nodes.map((n) => [n.id, n.parentId]))
    const inside = (id: string): boolean => {
      for (let at: string | undefined = id, hops = 0; at !== undefined && hops < 200; hops += 1) {
        if (at === container) return true
        at = parent.get(at)
      }
      return false
    }
    if (!nodeIds.has(container)) unknown.push(container)
    for (const id of nodeIds) if (!inside(id)) nodes.delete(id)
  }
  const wanted = ids ? new Set(ids) : undefined
  const focus = new Set<string>()
  for (const id of nodes) if (!wanted || wanted.has(id)) focus.add(id)
  for (const edge of diagram.edges) {
    const touches = container === undefined || nodes.has(edge.source) || nodes.has(edge.target)
    if (touches && (!wanted || wanted.has(edge.id))) focus.add(edge.id)
  }
  return { focus, unknown }
}

// The elements as they stand, the diagram-level pieces, and the problems; or, narrowed with
// `issuesOnly`, `ids` or `container`, only what was asked for, which is far shorter and what is
// usually needed after an edit.
export function inspectAnswer(
  diagram: DiagramFile,
  options: InspectOptions = {}
): Record<string, unknown> {
  const narrowed = options.ids !== undefined || options.container !== undefined
  const { focus, unknown } = narrowed
    ? focusOf(diagram, options)
    : { focus: undefined, unknown: [] as string[] }
  const unknownNote = unknown.length > 0 ? { unknown } : {}
  const issues = editIssues(diagram, focus)
  if (options.issuesOnly) return { ...unknownNote, issues }

  const { nodes, edges, ...catalogs } = describeDiagram(diagram, { styles: options.styles })
  if (focus) {
    return {
      partial:
        'only the elements asked for; the legend, highlights, required tags and diagram tags are left out',
      ...unknownNote,
      nodes: nodes.filter((n) => focus.has(n.id)),
      edges: edges.filter((e) => focus.has(e.id)),
      issues
    }
  }
  const truncated = nodes.length > INSPECT_LIMIT || edges.length > INSPECT_LIMIT
  return {
    ...catalogs,
    nodes: nodes.slice(0, INSPECT_LIMIT),
    edges: edges.slice(0, INSPECT_LIMIT),
    ...(truncated
      ? { truncated: `only the first ${INSPECT_LIMIT} nodes and edges are listed` }
      : {}),
    issues
  }
}

// JSON with one line per key and per item of a list, instead of one per field: the same data in far
// fewer tokens, since a long answer is mostly lists of small objects.
export function compactJson(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value)
  }
  const joined = (items: string[], indent: string): string => items.join(`,\n${indent}`)
  const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    Array.isArray(item) && item.length > 0
      ? `${JSON.stringify(key)}: [\n    ${joined(
          item.map((one) => JSON.stringify(one)),
          '    '
        )}\n  ]`
      : `${JSON.stringify(key)}: ${JSON.stringify(item)}`
  )
  return `{\n  ${joined(entries, '  ')}\n}`
}

// The folders an operation puts things in, from the diagram's own file name: a note goes in
// `<name>/notes/` and a new linked diagram in `<name>/`, as the editor does (ADR 0005).
export function foldersFor(fileStem: string): { notesFolder: string; linkedFolder: string } {
  return { notesFolder: `${fileStem}/notes`, linkedFolder: fileStem }
}
