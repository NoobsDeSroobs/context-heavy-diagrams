import type { DiagramFile } from '../diagram/index.ts'
import {
  classifyDiagrams,
  describeCount,
  flattenReview,
  type Classification,
  type NotesContent,
  type ReviewItem
} from './classify.ts'
import { applyIdMatches, detectIdChurn, matchReplaced, type IdMatches } from './match.ts'
import { diagramLevelText, itemLines, reviewSection } from './format.ts'
import { previewTextChange, sameText } from './textPreview.ts'

// The review of two versions of a diagram as text or JSON, with no file, git or process in it.
// `chd diff` and the MCP server's `diff_diagrams` both call this (ADR 0138), so they cannot give
// different answers for the same two versions: each only reads its inputs and passes them in.

// Notes whose text differs between two diagrams, for the elements that have the same note path in
// both. The caller supplies the readers, which decide where a stored path may be read from (a path
// leaving the diagram's folder is never read, ADR 0115); null is a note that is not there.
export interface NoteReaders {
  before: (storedPath: string) => string | null
  after: (storedPath: string) => string | null
}

export function notesBetween(
  older: DiagramFile,
  newer: DiagramFile,
  read: NoteReaders
): Record<string, NotesContent> {
  const olderNotes = new Map(older.nodes.map((n) => [n.id, n.data.notes]))
  const found: Record<string, NotesContent> = {}
  for (const node of newer.nodes) {
    const stored = node.data.notes
    if (!stored || stored !== olderNotes.get(node.id)) continue
    const before = read.before(stored)
    const after = read.after(stored)
    if (before === null && after === null) continue
    if (before === null && after !== null) {
      found[node.id] = { state: 'added', preview: previewTextChange('', after) }
    } else if (before !== null && after === null) {
      found[node.id] = { state: 'removed', preview: previewTextChange(before, '') }
    } else if (before !== null && after !== null && !sameText(before, after)) {
      found[node.id] = { state: 'changed', preview: previewTextChange(before, after) }
    }
  }
  return found
}

export interface Compared {
  olderName: string
  newerName: string
  classification: Classification
  matches: IdMatches | null
  churnSuspected: boolean
  churnTwins: number
  churnRemoved: number
}

export interface CompareOptions {
  olderName: string
  newerName: string
  // The ids were replaced (an assistant rewrote the diagram): pair removed and added elements.
  match?: boolean
  notes?: Record<string, NotesContent>
}

export function compareDiagrams(
  older: DiagramFile,
  newer: DiagramFile,
  options: CompareOptions
): Compared {
  const suspicion = detectIdChurn(older, newer)
  const matches = options.match ? matchReplaced(older, newer) : null
  const classification = classifyDiagrams(matches ? applyIdMatches(older, matches) : older, newer, {
    notesContent: new Map(Object.entries(options.notes ?? {}))
  })
  return {
    olderName: options.olderName,
    newerName: options.newerName,
    classification,
    matches,
    churnSuspected: suspicion.suspected,
    churnTwins: suspicion.twins,
    churnRemoved: suspicion.removed
  }
}

export function hasChanges(c: Classification): boolean {
  return c.review.length > 0 || c.diagramLevel.length > 0
}

export function formatDiffText(result: Compared): string {
  const { classification: c } = result
  const lines: string[] = [`${result.newerName} against ${result.olderName}`]
  if (result.matches) {
    lines.push(
      `Matched ${result.matches.nodes.size} elements and ${result.matches.edges.size} connections by name and place (a guess).` +
        (result.matches.fuzzySkipped
          ? ' The similarity pass was cut short: the diagram is large.'
          : '')
    )
  }
  if (!hasChanges(c)) {
    lines.push('No changes.')
  } else {
    const all = flattenReview(c.review)
    const elements = all.filter((i) => i.kind === 'node').length
    const connections = all.length - elements
    const cosmetic = c.restyledNodes.size + c.restyledEdges.size
    lines.push(
      `${describeCount({ nodes: elements, edges: connections })} changed` +
        (cosmetic > 0 ? `; ${cosmetic} with a cosmetic look change (font, text, route)` : '')
    )
    let current = ''
    for (const item of c.review) {
      const heading = reviewSection(item)
      if (heading !== current) {
        lines.push('', heading)
        current = heading
      }
      lines.push(...itemLines(item))
    }
    if (c.diagramLevel.length > 0) {
      lines.push('', 'DIAGRAM-LEVEL CHANGES')
      for (const change of c.diagramLevel) lines.push(`  ${diagramLevelText(change)}`)
    }
  }
  if (!result.matches && result.churnSuspected) {
    lines.push(
      '',
      `Note: ${result.churnTwins} of ${result.churnRemoved} removed elements have an added element with the same name and type, so the ids probably changed. Run again with --match to pair them.`
    )
  }
  return lines.join('\n')
}

function itemToJson(item: ReviewItem): Record<string, unknown> {
  return {
    kind: item.kind,
    id: item.id,
    label: item.label,
    status: item.change.status,
    security: item.change.security,
    fields: item.change.fields.map((f) => ({
      field: f.field,
      category: f.category,
      lines: f.lines,
      // A look is a plain value, so the old and new one come with it.
      ...(f.category === 'style' ? { before: f.before ?? null, after: f.after ?? null } : {})
    })),
    ...(item.connections && item.connections.length > 0
      ? { connections: item.connections.map(itemToJson) }
      : {})
  }
}

// The JSON of `chd diff --json`.
export function diffToJson(result: Compared): unknown {
  const { classification: c } = result
  return {
    older: result.olderName,
    newer: result.newerName,
    changed: hasChanges(c),
    counts: c.counts,
    cosmeticLook: { elements: c.restyledNodes.size, connections: c.restyledEdges.size },
    changes: c.review.map(itemToJson),
    diagramLevel: c.diagramLevel,
    matched: result.matches
      ? {
          elements: result.matches.nodes.size,
          connections: result.matches.edges.size,
          similarityCutShort: result.matches.fuzzySkipped
        }
      : null,
    idsProbablyChanged: !result.matches && result.churnSuspected
  }
}
