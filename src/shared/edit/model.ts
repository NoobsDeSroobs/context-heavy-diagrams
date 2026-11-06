// What the editing operations share: reading an operation's fields, the diagram while it is edited
// (absolute positions over the file's parent-relative ones), the summaries an answer carries and the
// style checks. The operations themselves are in operations.ts and annotations.ts.
import type {
  ConnectionPointSide,
  DiagramEdge,
  DiagramFile,
  DiagramNode,
  HighlightDefinition,
  JsonValue,
  LegendEntry,
  RequiredTagDefinition
} from '../diagram/index.ts'
import { effectivePointsForSide } from '../geometry/connectionPoints.ts'

export class OperationError extends Error {
  readonly index: number
  constructor(index: number, message: string) {
    super(`operation ${index + 1}: ${message}`)
    this.index = index
  }
}

export interface NodeSummary {
  id: string
  type: string
  label: string
  // Absolute canvas coordinates of the top-left corner, whatever the parent.
  x: number
  y: number
  width: number
  height: number
  parent: string | null
  // The connection point ids an edge can name (entities and containers only).
  handles: string[]
}

export interface EdgeSummary {
  id: string
  type: 'edge'
  from: string
  to: string
  fromHandle: string | null
  toHandle: string | null
  label: string
  // Only when set: the routing style and the manual routing points (absolute coordinates).
  routing?: string
  points?: { x: number; y: number; gravity?: number }[]
}

export interface OperationResult {
  op: string
  // What the operation made or changed.
  element?: NodeSummary | EdgeSummary
  // For `remove`: everything that went with the element (its edges).
  removed?: string[]
  // For `add_connection_point`: the id of the new point.
  pointId?: string
  // Tag operations: every tag the element carries afterwards, as key to value.
  tags?: Record<string, JsonValue>
  // Required-tag operations: what the template change did to existing elements, one line each.
  notices?: string[]
  // Catalog operations (required tags, highlights, legend): the entry as it now stands.
  requiredTag?: RequiredTagDefinition
  highlight?: HighlightDefinition
  legendEntry?: LegendEntry
  // set_link / set_note: the path now stored on the element (relative to the diagram, with "/").
  link?: string
  note?: string
}

// A file an operation asks the caller to write beside the diagram (a note). Nothing in the core
// touches a disk: the file executor writes these, the open window would use its own note handling.
export interface ProducedFile {
  // Relative to the diagram's folder, with "/".
  path: string
  content: string
}

export interface ApplyOptions {
  // Makes a fresh id with the given prefix ('entity', 'edge', ...). Supplied by the caller so this
  // module stays free of Node and the DOM.
  newId: (prefix: string) => string
  // The folder, relative to the diagram's own, where a new note goes ("shop/notes"). Without it
  // set_note is refused: this executor has nowhere to put a note.
  notesFolder?: string
  // The folder, relative to the diagram's own, where the diagrams linked from this one belong, named
  // after it ("shop" for shop.chd), as the editor does (ADR 0005). Without it link_new_diagram is
  // refused.
  linkedFolder?: string
  // Whether a file already exists at a path relative to the diagram, so a new linked diagram does not
  // take a name that is in use.
  fileExists?: (path: string) => boolean
  // Refuses a path that is about to be stored in the diagram (a link or a note): returns the reason,
  // or undefined if it is fine. The caller knows the folder the assistant may use; the core only
  // knows the path is relative.
  checkReference?: (path: string) => string | undefined
}

export const SIDES: readonly ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']
export const DEFAULT_SIZE = {
  entity: { width: 120, height: 80 },
  container: { width: 320, height: 180 },
  text: { width: 120, height: 48 }
} as const
export const MIN_SIZE = 10
export const MAX_POINTS_PER_SIDE = 12
export const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

export const MARKERS = [
  'none',
  'arrowOpen',
  'arrowClosed',
  'circle',
  'circleFilled',
  'diamond',
  'diamondFilled',
  'crowsFootOne',
  'crowsFootMany',
  'crowsFootOneOrMany',
  'crowsFootZeroOrOne',
  'crowsFootZeroOrMany'
]

export type StyleRule =
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'string' }
  | { kind: 'enum'; values: readonly string[] }

export const FONT_STYLE: Record<string, StyleRule> = {
  fontSize: { kind: 'number', min: 1 },
  fontColor: { kind: 'string' },
  fontWeight: { kind: 'enum', values: ['normal', 'bold'] },
  fontFamily: { kind: 'string' },
  fontOpacity: { kind: 'number', min: 0, max: 100 }
}
export const ROUTING_STYLES = ['straight', 'step', 'smoothstep', 'catmullRom']

export const NODE_STYLE: Record<string, StyleRule> = {
  ...FONT_STYLE,
  fill: { kind: 'string' },
  fillOpacity: { kind: 'number', min: 0, max: 100 },
  stroke: { kind: 'string' },
  strokeOpacity: { kind: 'number', min: 0, max: 100 },
  strokeWidth: { kind: 'number', min: 0 },
  textAlign: { kind: 'enum', values: ['start', 'center', 'end'] },
  lineStyle: { kind: 'enum', values: ['solid', 'dashed', 'dotted'] },
  startMarker: { kind: 'enum', values: MARKERS },
  endMarker: { kind: 'enum', values: MARKERS }
}
export const EDGE_STYLE: Record<string, StyleRule> = {
  ...FONT_STYLE,
  stroke: { kind: 'string' },
  strokeOpacity: { kind: 'number', min: 0, max: 100 },
  strokeWidth: { kind: 'number', min: 0 },
  lineStyle: { kind: 'enum', values: ['solid', 'dashed', 'dotted'] },
  startMarker: { kind: 'enum', values: MARKERS },
  endMarker: { kind: 'enum', values: MARKERS },
  animation: { kind: 'enum', values: ['flow', 'pulse'] },
  animationSpeed: { kind: 'number', min: 0.1, max: 10 },
  animationDirection: { kind: 'enum', values: ['forward', 'reverse'] },
  pulseDistance: { kind: 'number', min: 0 },
  dashLength: { kind: 'number', min: 0 },
  dashGap: { kind: 'number', min: 0 },
  labelPosition: { kind: 'number', min: 0, max: 1 },
  routingStyle: { kind: 'enum', values: ROUTING_STYLES }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
export const round = (value: number): number => Math.round(value * 1000) / 1000

// --- reading an operation

export class Reader {
  private readonly index: number
  private readonly op: Record<string, unknown>
  constructor(index: number, op: Record<string, unknown>) {
    this.index = index
    this.op = op
  }
  fail(message: string): never {
    throw new OperationError(this.index, message)
  }
  string(key: string): string {
    const v = this.op[key]
    if (typeof v !== 'string') this.fail(`"${key}" must be text`)
    return v
  }
  optionalString(key: string): string | undefined {
    return this.op[key] === undefined ? undefined : this.string(key)
  }
  number(key: string): number {
    const v = this.op[key]
    if (!isNumber(v)) this.fail(`"${key}" must be a number`)
    return v
  }
  optionalNumber(key: string): number | undefined {
    return this.op[key] === undefined ? undefined : this.number(key)
  }
  positive(key: string): number | undefined {
    const v = this.optionalNumber(key)
    if (v !== undefined && v < MIN_SIZE) this.fail(`"${key}" must be at least ${MIN_SIZE}`)
    return v
  }
  has(key: string): boolean {
    return this.op[key] !== undefined
  }
  raw(key: string): unknown {
    return this.op[key]
  }
  // The fields that are not among `known`, for an operation that takes a set of optional fields.
  rest(known: readonly string[]): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this.op).filter(([key]) => !known.includes(key)))
  }
}

// --- the diagram while it is edited

export class Model {
  readonly diagram: DiagramFile
  readonly nodes: DiagramNode[]
  readonly edges: DiagramEdge[]
  readonly options: ApplyOptions
  // Files the operations asked the caller to write (notes), in the order they were asked for.
  readonly files: ProducedFile[] = []
  constructor(diagram: DiagramFile, options: ApplyOptions) {
    this.diagram = diagram
    this.nodes = diagram.nodes
    this.edges = diagram.edges
    this.options = options
  }

  node(id: string): DiagramNode | undefined {
    return this.nodes.find((n) => n.id === id)
  }
  edge(id: string): DiagramEdge | undefined {
    return this.edges.find((e) => e.id === id)
  }
  has(id: string): boolean {
    return this.node(id) !== undefined || this.edge(id) !== undefined
  }
  parentOf(node: DiagramNode): DiagramNode | undefined {
    return node.parentId === undefined ? undefined : this.node(node.parentId)
  }
  // The absolute top-left of a node: its position plus those of its parents.
  origin(node: DiagramNode): { x: number; y: number } {
    let x = node.position.x
    let y = node.position.y
    for (let p = this.parentOf(node), hops = 0; p && hops < 200; p = this.parentOf(p), hops += 1) {
      x += p.position.x
      y += p.position.y
    }
    return { x, y }
  }
  isDescendant(node: DiagramNode, ancestorId: string): boolean {
    for (let p = this.parentOf(node), hops = 0; p && hops < 200; p = this.parentOf(p), hops += 1) {
      if (p.id === ancestorId) return true
    }
    return false
  }
  freshId(reader: Reader, prefix: string): string {
    const given = reader.optionalString('id')
    if (given !== undefined) {
      if (!ID_PATTERN.test(given))
        reader.fail('"id" may use letters, digits, ".", "_" and "-" (up to 64)')
      if (this.has(given)) reader.fail(`"${given}" is already an id in this diagram`)
      return given
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.options.newId(prefix)
      if (!this.has(id)) return id
    }
    return reader.fail('could not make a unique id')
  }
}

export function handlesOf(node: DiagramNode): string[] {
  if (node.type === 'text' || node.type === 'line') return []
  const stored = node.connectionPoints ?? []
  return SIDES.flatMap((side) => effectivePointsForSide(stored, side).map((p) => p.id))
}

export function sizeOf(node: DiagramNode): { width: number; height: number } {
  return node.size ?? { width: 0, height: 0 }
}

export function summarizeNode(diagram: DiagramFile, node: DiagramNode): NodeSummary {
  const model = new Model(diagram, { newId: () => '' })
  const origin = model.origin(node)
  const size = sizeOf(node)
  return {
    id: node.id,
    type: node.type ?? 'entity',
    label: node.data.label,
    x: round(origin.x),
    y: round(origin.y),
    width: round(size.width),
    height: round(size.height),
    parent: node.parentId ?? null,
    handles: handlesOf(node)
  }
}

export function summarizeEdge(edge: DiagramEdge): EdgeSummary {
  return {
    id: edge.id,
    type: 'edge',
    from: edge.source,
    to: edge.target,
    fromHandle: edge.sourceHandle ?? null,
    toHandle: edge.targetHandle ?? null,
    label: edge.label ?? '',
    ...(edge.style?.routingStyle ? { routing: edge.style.routingStyle } : {}),
    ...(edge.points?.length ? { points: edge.points } : {})
  }
}

// --- styles

export function checkedStyle(
  reader: Reader,
  raw: unknown,
  rules: Record<string, StyleRule>
): Record<string, string | number | null> {
  if (!isRecord(raw)) reader.fail('"style" must be an object')
  const out: Record<string, string | number | null> = {}
  for (const [key, value] of Object.entries(raw)) {
    const rule = rules[key]
    if (!rule)
      reader.fail(`"${key}" is not a style field here (use: ${Object.keys(rules).join(', ')})`)
    if (value === null) {
      out[key] = null
      continue
    }
    if (rule.kind === 'number') {
      if (!isNumber(value)) reader.fail(`style "${key}" must be a number`)
      if (rule.min !== undefined && value < rule.min)
        reader.fail(`style "${key}" must be at least ${rule.min}`)
      if (rule.max !== undefined && value > rule.max)
        reader.fail(`style "${key}" must be at most ${rule.max}`)
      out[key] = value
    } else if (rule.kind === 'string') {
      if (typeof value !== 'string' || value.trim() === '')
        reader.fail(`style "${key}" must be text`)
      out[key] = value
    } else {
      if (typeof value !== 'string' || !rule.values.includes(value)) {
        reader.fail(`style "${key}" must be one of ${rule.values.join(', ')}`)
      }
      out[key] = value
    }
  }
  return out
}

export function mergeStyle<T extends object>(
  current: T | undefined,
  change: Record<string, string | number | null>
): T | undefined {
  const next: Record<string, unknown> = { ...(current ?? {}) }
  for (const [key, value] of Object.entries(change)) {
    if (value === null) delete next[key]
    else next[key] = value
  }
  return Object.keys(next).length > 0 ? (next as T) : undefined
}
