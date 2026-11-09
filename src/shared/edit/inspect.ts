// What an assistant can ask about a diagram while it builds one: the elements as they stand (with
// absolute positions and the connection points an edge may name), how much room an edge label needs,
// and what is wrong with the layout so far. All read-only and all taking a diagram, not a file, so the
// open window can answer from its live state as well. The label geometry is layout/labelClearance.ts.
import type {
  DiagramFile,
  DiagramNode,
  HighlightDefinition,
  JsonValue,
  LegendEntry,
  MetadataEntry,
  RequiredTagDefinition
} from '../diagram/index.ts'
import {
  hiddenLabels,
  labelChipSize,
  labelNeededGap,
  labelTargetGap
} from '../layout/labelClearance.ts'
import { edgeIssues, type EdgeIssue } from './edgeRouting.ts'
import { LINE_HEIGHT_EM, measureText, wrapText, type FontSpec } from '../export/textLayout.ts'
import { NODE_STYLE_DEFAULTS, styledNodeType } from '../styling/styleDefaults.ts'
import { summarizeEdge, summarizeNode, type EdgeSummary, type NodeSummary } from './operations.ts'

export interface DescribedNode extends NodeSummary {
  tags?: Record<string, JsonValue>
  // The relative paths stored on the element: the diagram it links to, the Markdown file of its note.
  link?: string
  note?: string
  // Only when asked for: the style fields the element sets.
  style?: Record<string, unknown>
}

export interface DescribedEdge extends EdgeSummary {
  tags?: Record<string, JsonValue>
  style?: Record<string, unknown>
}

export interface DiagramDescription {
  nodes: DescribedNode[]
  edges: DescribedEdge[]
  // The diagram-level pieces, each present only when the diagram has any.
  diagramTags?: Record<string, JsonValue>
  requiredTags?: RequiredTagDefinition[]
  highlights?: HighlightDefinition[]
  legend?: LegendEntry[]
}

function tagsOf(
  metadata: Record<string, MetadataEntry> | undefined
): { tags: Record<string, JsonValue> } | Record<string, never> {
  const keys = Object.keys(metadata ?? {})
  if (!metadata || keys.length === 0) return {}
  return { tags: Object.fromEntries(keys.map((key) => [key, metadata[key].value])) }
}

// `styles` adds the style fields each element and edge sets (colours, line style, markers, label
// position): a long answer otherwise, so it is asked for.
export function describeDiagram(
  diagram: DiagramFile,
  { styles = false }: { styles?: boolean } = {}
): DiagramDescription {
  const styleOf = (style: object | undefined): { style?: Record<string, unknown> } =>
    styles && style && Object.keys(style).length > 0 ? { style: { ...style } } : {}
  return {
    nodes: diagram.nodes.map((n) => ({
      ...summarizeNode(diagram, n),
      ...tagsOf(n.metadata),
      ...(n.data.linkedDiagram ? { link: n.data.linkedDiagram } : {}),
      ...(n.data.notes ? { note: n.data.notes } : {}),
      ...styleOf(n.style)
    })),
    edges: diagram.edges.map((e) => ({
      ...summarizeEdge(e),
      ...tagsOf(e.metadata),
      ...styleOf(e.style)
    })),
    ...(diagram.metadata && Object.keys(diagram.metadata).length > 0
      ? { diagramTags: diagram.metadata }
      : {}),
    ...(diagram.requiredTags?.length ? { requiredTags: diagram.requiredTags } : {}),
    ...(diagram.highlights?.length ? { highlights: diagram.highlights } : {}),
    ...(diagram.legend?.length ? { legend: diagram.legend } : {})
  }
}

export interface RoomQuestion {
  label: string
  // 'horizontal': the two elements sit side by side; 'vertical': one above the other.
  direction: 'horizontal' | 'vertical'
  fontSize?: number
  bold?: boolean
  fontFamily?: string
  startMarker?: string
  endMarker?: string
  // How far along the edge from its source the label sits (0 to 1); absent means the middle.
  position?: number
}

export interface Room {
  // The clear space between the two elements, in px, below which the label hides the line or its end.
  minimum: number
  // Enough for the line to read as solid, dashed or dotted either side of the label.
  target: number
  chip: { width: number; height: number }
}

export function roomForLabel(question: RoomQuestion): Room {
  const font = {
    size: question.fontSize ?? 12,
    weight: question.bold ? ('bold' as const) : ('normal' as const),
    family: question.fontFamily
  }
  const horizontal = question.direction === 'horizontal'
  const chip = labelChipSize(question.label, font)
  return {
    minimum: labelNeededGap(question.label, font, horizontal, {
      startMarker: question.startMarker,
      endMarker: question.endMarker,
      position: question.position
    }),
    target: labelTargetGap(question.label, font, horizontal),
    chip: { width: Math.round(chip.width * 10) / 10, height: Math.round(chip.height * 10) / 10 }
  }
}

export interface LayoutIssue {
  kind: 'label-room' | 'label-overflow' | 'overlap' | 'outside-container' | EdgeIssue['kind']
  message: string
  ids: string[]
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function originOf(byId: Map<string, DiagramNode>, node: DiagramNode): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  for (
    let p = byId.get(node.parentId ?? ''), hops = 0;
    p && hops < 200;
    p = byId.get(p.parentId ?? ''), hops += 1
  ) {
    x += p.position.x
    y += p.position.y
  }
  return { x, y }
}

export function layoutIssues(diagram: DiagramFile, diagramFont?: string): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  const rectOf = (n: DiagramNode): Rect => {
    const o = originOf(byId, n)
    return { x: o.x, y: o.y, width: n.size?.width ?? 0, height: n.size?.height ?? 0 }
  }
  const label = (n: DiagramNode): string => n.data.label || n.id

  const hiddenList = hiddenLabels(diagram.nodes, diagram.edges, diagramFont)
  for (const hidden of hiddenList) {
    issues.push({
      kind: 'label-room',
      message: `edge ${hidden.edgeId} ("${hidden.label}") has ${Math.round(hidden.gap)}px between ${hidden.sourceId} and ${hidden.targetId}, but its label needs about ${hidden.needed}px`,
      ids: [hidden.edgeId, hidden.sourceId, hidden.targetId]
    })
  }

  const solid = diagram.nodes.filter((n) => n.type !== 'container' && n.type !== 'line')
  for (let i = 0; i < solid.length; i += 1) {
    for (let j = i + 1; j < solid.length; j += 1) {
      const a = rectOf(solid[i])
      const b = rectOf(solid[j])
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (overlapX > 1 && overlapY > 1) {
        issues.push({
          kind: 'overlap',
          message: `"${label(solid[i])}" (${solid[i].id}) and "${label(solid[j])}" (${solid[j].id}) overlap by ${Math.round(overlapX)} x ${Math.round(overlapY)}px`,
          ids: [solid[i].id, solid[j].id]
        })
      }
    }
  }

  // A label that does not fit its own box: too many lines for the height, or a word wider than the
  // box, which the canvas and the export break in the middle. The wrapping is the export's.
  for (const node of diagram.nodes) {
    if (node.type === 'line' || !node.data.label || !node.size) continue
    const type = styledNodeType(node.type)
    const defaults = NODE_STYLE_DEFAULTS[type]
    const font: FontSpec = {
      size: node.style?.fontSize ?? defaults.fontSize,
      weight: node.style?.fontWeight ?? defaults.fontWeight,
      family: node.style?.fontFamily ?? diagramFont
    }
    const stroke = node.style?.strokeWidth ?? defaults.strokeWidth
    const available = Math.max(0, node.size.width - stroke * 2 - (type === 'container' ? 8 : 16))
    const widest = node.data.label
      .split(/\s+/)
      .reduce((a, b) => (measureText(b, font) > measureText(a, font) ? b : a), '')
    if (available > 0 && measureText(widest, font) > available) {
      issues.push({
        kind: 'label-overflow',
        message: `the word "${widest}" in the label of "${label(node)}" (${node.id}) is wider than the box (${Math.round(node.size.width)}px) and breaks in the middle: widen the box or shorten the word`,
        ids: [node.id]
      })
      continue
    }
    if (type === 'container') continue
    const needed = wrapText(node.data.label, available, font).length * font.size * LINE_HEIGHT_EM
    if (needed > node.size.height - stroke * 2 + 1) {
      issues.push({
        kind: 'label-overflow',
        message: `the label of "${label(node)}" (${node.id}) needs about ${Math.round(needed)}px of height but the box is ${Math.round(node.size.height)}px high: make it taller or wider, or shorten the label`,
        ids: [node.id]
      })
    }
  }

  for (const node of diagram.nodes) {
    const parent = byId.get(node.parentId ?? '')
    if (!parent) continue
    const a = rectOf(node)
    const p = rectOf(parent)
    if (
      a.x < p.x - 0.5 ||
      a.y < p.y - 0.5 ||
      a.x + a.width > p.x + p.width + 0.5 ||
      a.y + a.height > p.y + p.height + 0.5
    ) {
      issues.push({
        kind: 'outside-container',
        message: `"${label(node)}" (${node.id}) sticks out of its container "${label(parent)}" (${parent.id})`,
        ids: [node.id, parent.id]
      })
    }
  }

  // The edges as drawn: over an element, crossing, and their labels (ADR 0161).
  issues.push(...edgeIssues(diagram, new Set(hiddenList.map((h) => h.edgeId))))
  return issues
}
