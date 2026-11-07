// The answers both front doors (the extension's tools and the `chd` command line) give about a diagram
// being built, written once so they cannot drift apart (ADR 0138). Pure: a front door adds what only
// it knows, the path and the fingerprint.
import type { DiagramFile } from '../diagram/index.ts'
import { describeDiagram, layoutIssues } from './inspect.ts'
import { groupMessages } from './issues.ts'

// At most this many operations in one call.
export const MAX_OPERATIONS = 200
// At most this many nodes and edges in one inspection.
export const INSPECT_LIMIT = 400

// What is wrong with the layout so far, one line for each kind of problem.
export function editIssues(diagram: DiagramFile): string[] {
  return groupMessages(layoutIssues(diagram, diagram.fontFamily))
}

// The elements as they stand, the diagram-level pieces, and the problems. `styles` adds the style
// fields each element sets.
export function inspectAnswer(
  diagram: DiagramFile,
  { styles = false }: { styles?: boolean } = {}
): Record<string, unknown> {
  const { nodes, edges, ...catalogs } = describeDiagram(diagram, { styles })
  const truncated = nodes.length > INSPECT_LIMIT || edges.length > INSPECT_LIMIT
  return {
    ...catalogs,
    nodes: nodes.slice(0, INSPECT_LIMIT),
    edges: edges.slice(0, INSPECT_LIMIT),
    ...(truncated
      ? { truncated: `only the first ${INSPECT_LIMIT} nodes and edges are listed` }
      : {}),
    issues: editIssues(diagram)
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
