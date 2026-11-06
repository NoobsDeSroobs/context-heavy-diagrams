// The editing operations an assistant uses to build a diagram the way a person does: add an entity,
// move it, connect two elements, restyle one. Each is plain data ({ op: 'move', id, x, y }), and each
// answers with what it made or changed, so the next step can use it. A pure function from a diagram
// and a list of operations to a new diagram, so a file can run them today and the open window later
// (the live bridge must stay possible).
//
// Coordinates in operations are absolute canvas coordinates; the parent-relative form the file stores
// stays in here. Nothing here lays anything out: where things go is the caller's decision.
import type {
  ConnectionPoint,
  ConnectionPointSide,
  DiagramEdge,
  DiagramFile,
  DiagramNode,
  LinePoint
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
}

export interface OperationResult {
  op: string
  // What the operation made or changed.
  element?: NodeSummary | EdgeSummary
  // For `remove`: everything that went with the element (its edges).
  removed?: string[]
  // For `add_connection_point`: the id of the new point.
  pointId?: string
}

export interface ApplyOptions {
  // Makes a fresh id with the given prefix ('entity', 'edge', ...). Supplied by the caller so this
  // module stays free of Node and the DOM.
  newId: (prefix: string) => string
}

const SIDES: readonly ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']
const DEFAULT_SIZE = {
  entity: { width: 120, height: 80 },
  container: { width: 320, height: 180 },
  text: { width: 120, height: 48 }
} as const
const MIN_SIZE = 10
const MAX_POINTS_PER_SIDE = 12
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

const MARKERS = [
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

type StyleRule =
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'string' }
  | { kind: 'enum'; values: readonly string[] }

const FONT_STYLE: Record<string, StyleRule> = {
  fontSize: { kind: 'number', min: 1 },
  fontColor: { kind: 'string' },
  fontWeight: { kind: 'enum', values: ['normal', 'bold'] },
  fontFamily: { kind: 'string' },
  fontOpacity: { kind: 'number', min: 0, max: 100 }
}
const NODE_STYLE: Record<string, StyleRule> = {
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
const EDGE_STYLE: Record<string, StyleRule> = {
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
  routingStyle: { kind: 'enum', values: ['straight', 'step', 'smoothstep', 'catmullRom'] }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const round = (value: number): number => Math.round(value * 1000) / 1000

// --- reading an operation

class Reader {
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
}

// --- the diagram while it is edited

class Model {
  readonly diagram: DiagramFile
  readonly nodes: DiagramNode[]
  readonly edges: DiagramEdge[]
  private readonly newId: (prefix: string) => string
  constructor(diagram: DiagramFile, newId: (prefix: string) => string) {
    this.diagram = diagram
    this.nodes = diagram.nodes
    this.edges = diagram.edges
    this.newId = newId
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
      const id = this.newId(prefix)
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

function sizeOf(node: DiagramNode): { width: number; height: number } {
  return node.size ?? { width: 0, height: 0 }
}

export function summarizeNode(diagram: DiagramFile, node: DiagramNode): NodeSummary {
  const model = new Model(diagram, () => '')
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
    label: edge.label ?? ''
  }
}

// --- styles

function checkedStyle(
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

function mergeStyle<T extends object>(
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

// --- the operations

function addNode(
  model: Model,
  reader: Reader,
  kind: 'entity' | 'container' | 'text'
): OperationResult {
  const id = model.freshId(reader, kind)
  const x = reader.number('x')
  const y = reader.number('y')
  const width = reader.positive('width') ?? DEFAULT_SIZE[kind].width
  const height = reader.positive('height') ?? DEFAULT_SIZE[kind].height
  const parent = placementParent(model, reader)
  const origin = parent ? model.origin(parent) : { x: 0, y: 0 }
  const node: DiagramNode = {
    id,
    type: kind,
    position: { x: round(x - origin.x), y: round(y - origin.y) },
    size: { width, height },
    data: { label: reader.optionalString('label') ?? '' }
  }
  if (parent) node.parentId = parent.id
  if (reader.has('style')) {
    const style = mergeStyle(undefined, checkedStyle(reader, reader.raw('style'), NODE_STYLE))
    if (style) node.style = style
  }
  model.nodes.push(node)
  return { op: `add_${kind}`, element: summarizeNode(model.diagram, node) }
}

function placementParent(model: Model, reader: Reader): DiagramNode | undefined {
  const id = reader.optionalString('parent')
  if (id === undefined) return undefined
  const parent = model.node(id)
  if (!parent) reader.fail(`parent "${id}" does not exist`)
  if (parent.type !== 'container') reader.fail(`parent "${id}" is not a container`)
  return parent
}

function addLine(model: Model, reader: Reader): OperationResult {
  const raw = reader.raw('points')
  if (!Array.isArray(raw) || raw.length < 2) reader.fail('"points" needs at least two points')
  const points: LinePoint[] = raw.map((p: unknown, i: number) => {
    if (!isRecord(p) || !isNumber(p.x) || !isNumber(p.y))
      reader.fail(`point ${i + 1} needs numeric x and y`)
    if (p.gravity !== undefined && !isNumber(p.gravity))
      reader.fail(`point ${i + 1}: gravity must be a number`)
    return isNumber(p.gravity) ? { x: p.x, y: p.y, gravity: p.gravity } : { x: p.x, y: p.y }
  })
  const id = model.freshId(reader, 'line')
  const parent = placementParent(model, reader)
  const origin = parent ? model.origin(parent) : { x: 0, y: 0 }
  const minX = Math.min(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxX = Math.max(...points.map((p) => p.x))
  const maxY = Math.max(...points.map((p) => p.y))
  const node: DiagramNode = {
    id,
    type: 'line',
    position: { x: round(minX - origin.x), y: round(minY - origin.y) },
    size: { width: Math.max(round(maxX - minX), 1), height: Math.max(round(maxY - minY), 1) },
    data: {
      label: '',
      points: points.map((p) => ({ ...p, x: round(p.x - minX), y: round(p.y - minY) }))
    }
  }
  if (parent) node.parentId = parent.id
  if (reader.has('style')) {
    const style = mergeStyle(undefined, checkedStyle(reader, reader.raw('style'), NODE_STYLE))
    if (style) node.style = style
  }
  model.nodes.push(node)
  return { op: 'add_line', element: summarizeNode(model.diagram, node) }
}

function connectable(model: Model, reader: Reader, key: string): DiagramNode {
  const id = reader.string(key)
  const node = model.node(id)
  if (!node) reader.fail(`"${key}": "${id}" is not an element of this diagram`)
  if (node.type === 'text' || node.type === 'line') {
    reader.fail(`"${key}": "${id}" is a ${node.type}, which edges cannot join`)
  }
  return node
}

// The side of `a` that faces `b`, and the side of `b` that faces `a`, by where their centres are.
function facingSides(
  model: Model,
  a: DiagramNode,
  b: DiagramNode
): [ConnectionPointSide, ConnectionPointSide] {
  const oa = model.origin(a)
  const ob = model.origin(b)
  const sa = sizeOf(a)
  const sb = sizeOf(b)
  const dx = ob.x + sb.width / 2 - (oa.x + sa.width / 2)
  const dy = ob.y + sb.height / 2 - (oa.y + sa.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right']
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']
}

// The point on a side nearest its middle, as an id.
function middleHandle(node: DiagramNode, side: ConnectionPointSide): string {
  const points = effectivePointsForSide(node.connectionPoints ?? [], side)
  const best = [...points].sort((p, q) => Math.abs(p.offset - 0.5) - Math.abs(q.offset - 0.5))[0]
  return best ? best.id : side
}

function connect(model: Model, reader: Reader): OperationResult {
  const from = connectable(model, reader, 'from')
  const to = connectable(model, reader, 'to')
  if (from.id === to.id) reader.fail('an edge needs two different elements')
  const [fromSide, toSide] = facingSides(model, from, to)
  const sourceHandle = reader.optionalString('fromHandle') ?? middleHandle(from, fromSide)
  const targetHandle = reader.optionalString('toHandle') ?? middleHandle(to, toSide)
  if (!handlesOf(from).includes(sourceHandle)) {
    reader.fail(
      `"fromHandle": "${sourceHandle}" is not a connection point of "${from.id}" (it has ${handlesOf(from).join(', ')})`
    )
  }
  if (!handlesOf(to).includes(targetHandle)) {
    reader.fail(
      `"toHandle": "${targetHandle}" is not a connection point of "${to.id}" (it has ${handlesOf(to).join(', ')})`
    )
  }
  const id = model.freshId(reader, 'edge')
  const edge: DiagramEdge = {
    id,
    type: 'labeled',
    source: from.id,
    target: to.id,
    sourceHandle,
    targetHandle
  }
  const label = reader.optionalString('label')
  if (label) edge.label = label
  if (reader.has('style')) {
    const style = mergeStyle(undefined, checkedStyle(reader, reader.raw('style'), EDGE_STYLE))
    if (style) edge.style = style
  }
  model.edges.push(edge)
  return { op: 'connect', element: summarizeEdge(edge) }
}

function addConnectionPoint(model: Model, reader: Reader): OperationResult {
  const node = connectable(model, reader, 'id')
  const side = reader.string('side')
  if (!SIDES.includes(side as ConnectionPointSide))
    reader.fail('"side" must be top, right, bottom or left')
  const offset = reader.number('offset')
  if (offset < 0 || offset > 1)
    reader.fail('"offset" must be between 0 (start of the side) and 1 (end)')
  const stored: ConnectionPoint[] = [...(node.connectionPoints ?? [])]
  const onSide = stored.filter((p) => p.side === side)
  // A side with nothing stored has one implicit, centred point named after the side; edges may use
  // it. Once the side gets a stored point, only stored ids exist, so the centred one is written out.
  if (onSide.length === 0) stored.push({ id: side, side: side as ConnectionPointSide, offset: 0.5 })
  if (stored.filter((p) => p.side === side).length >= MAX_POINTS_PER_SIDE) {
    reader.fail(`a side holds at most ${MAX_POINTS_PER_SIDE} connection points`)
  }
  const taken = new Set([...stored.map((p) => p.id), ...SIDES])
  let pointId = reader.optionalString('pointId')
  if (pointId !== undefined) {
    if (!ID_PATTERN.test(pointId) || taken.has(pointId))
      reader.fail(`"${pointId}" is not a free point id on this element`)
  } else {
    let n = 1
    while (taken.has(`cp-${n}`)) n += 1
    pointId = `cp-${n}`
  }
  stored.push({ id: pointId, side: side as ConnectionPointSide, offset: round(offset) })
  node.connectionPoints = stored
  return { op: 'add_connection_point', element: summarizeNode(model.diagram, node), pointId }
}

function anyElement(model: Model, reader: Reader, key = 'id'): DiagramNode | DiagramEdge {
  const id = reader.string(key)
  const found = model.node(id) ?? model.edge(id)
  if (!found) reader.fail(`"${id}" is not an element of this diagram`)
  return found
}

function nodeOnly(model: Model, reader: Reader): DiagramNode {
  const id = reader.string('id')
  const node = model.node(id)
  if (!node) reader.fail(`"${id}" is not an element of this diagram`)
  return node
}

function setParentAndKeepPlace(
  model: Model,
  node: DiagramNode,
  parent: DiagramNode | undefined
): void {
  const origin = model.origin(node)
  const parentOrigin = parent ? model.origin(parent) : { x: 0, y: 0 }
  if (parent) node.parentId = parent.id
  else delete node.parentId
  node.position = { x: round(origin.x - parentOrigin.x), y: round(origin.y - parentOrigin.y) }
}

function move(model: Model, reader: Reader): OperationResult {
  const node = nodeOnly(model, reader)
  const x = reader.number('x')
  const y = reader.number('y')
  const parent = model.parentOf(node)
  const origin = parent ? model.origin(parent) : { x: 0, y: 0 }
  node.position = { x: round(x - origin.x), y: round(y - origin.y) }
  return { op: 'move', element: summarizeNode(model.diagram, node) }
}

function resize(model: Model, reader: Reader): OperationResult {
  const node = nodeOnly(model, reader)
  if (node.type === 'line') reader.fail('a line is sized by its points; add a new line instead')
  const width = reader.positive('width')
  const height = reader.positive('height')
  if (width === undefined && height === undefined) reader.fail('give "width", "height" or both')
  const size = sizeOf(node)
  node.size = { width: width ?? size.width, height: height ?? size.height }
  return { op: 'resize', element: summarizeNode(model.diagram, node) }
}

function setLabel(model: Model, reader: Reader): OperationResult {
  const target = anyElement(model, reader)
  const label = reader.string('label')
  if ('source' in target) {
    if (label) target.label = label
    else delete target.label
    return { op: 'set_label', element: summarizeEdge(target) }
  }
  target.data.label = label
  return { op: 'set_label', element: summarizeNode(model.diagram, target) }
}

function setStyle(model: Model, reader: Reader): OperationResult {
  const target = anyElement(model, reader)
  const isEdge = 'source' in target
  const change = checkedStyle(reader, reader.raw('style'), isEdge ? EDGE_STYLE : NODE_STYLE)
  const next = mergeStyle(target.style, change)
  if (next) target.style = next as never
  else delete target.style
  return {
    op: 'set_style',
    element: 'source' in target ? summarizeEdge(target) : summarizeNode(model.diagram, target)
  }
}

function reparent(model: Model, reader: Reader): OperationResult {
  const node = nodeOnly(model, reader)
  const raw = reader.raw('parent')
  let parent: DiagramNode | undefined
  if (raw !== null) {
    const id = reader.string('parent')
    parent = model.node(id)
    if (!parent) reader.fail(`parent "${id}" does not exist`)
    if (parent.type !== 'container') reader.fail(`parent "${id}" is not a container`)
    if (parent.id === node.id || model.isDescendant(parent, node.id)) {
      reader.fail('an element cannot go inside itself or something inside it')
    }
  }
  setParentAndKeepPlace(model, node, parent)
  // A parent must come before its children in the file: move the element and what is inside it to
  // the end, after every possible parent.
  if (parent) {
    const subtree = model.nodes.filter((n) => n.id === node.id || model.isDescendant(n, node.id))
    const ids = new Set(subtree.map((n) => n.id))
    const rest = model.nodes.filter((n) => !ids.has(n.id))
    model.nodes.length = 0
    model.nodes.push(...rest, ...subtree)
  }
  return { op: 'reparent', element: summarizeNode(model.diagram, node) }
}

function remove(model: Model, reader: Reader): OperationResult {
  const id = reader.string('id')
  const edge = model.edge(id)
  if (edge) {
    model.edges.splice(model.edges.indexOf(edge), 1)
    return { op: 'remove', removed: [id] }
  }
  const node = model.node(id)
  if (!node) reader.fail(`"${id}" is not an element of this diagram`)
  // As in the editor, what was inside a removed container moves up a level and keeps its place.
  const grandparent = model.parentOf(node)
  for (const child of model.nodes.filter((n) => n.parentId === node.id)) {
    setParentAndKeepPlace(model, child, grandparent)
  }
  const removed = [id]
  for (const e of [...model.edges]) {
    if (e.source === id || e.target === id) {
      model.edges.splice(model.edges.indexOf(e), 1)
      removed.push(e.id)
    }
  }
  model.nodes.splice(model.nodes.indexOf(node), 1)
  return { op: 'remove', removed }
}

const OPERATIONS: Record<string, (model: Model, reader: Reader) => OperationResult> = {
  add_entity: (m, r) => addNode(m, r, 'entity'),
  add_container: (m, r) => addNode(m, r, 'container'),
  add_text: (m, r) => addNode(m, r, 'text'),
  add_line: addLine,
  add_connection_point: addConnectionPoint,
  connect,
  move,
  resize,
  set_label: setLabel,
  set_style: setStyle,
  reparent,
  remove
}

export const OPERATION_NAMES: readonly string[] = Object.keys(OPERATIONS)

// Runs the operations in order on a copy of the diagram. If one fails, nothing is applied and the error
// names it (OperationError.index), so a batch is all or nothing.
export function applyOperations(
  diagram: DiagramFile,
  operations: readonly unknown[],
  options: ApplyOptions
): { diagram: DiagramFile; results: OperationResult[] } {
  const copy = JSON.parse(JSON.stringify(diagram)) as DiagramFile
  const model = new Model(copy, options.newId)
  const results: OperationResult[] = []
  operations.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.op !== 'string') {
      throw new OperationError(
        index,
        `each operation is an object with an "op" (one of ${OPERATION_NAMES.join(', ')})`
      )
    }
    const run = OPERATIONS[raw.op]
    if (!run) {
      throw new OperationError(
        index,
        `unknown op "${raw.op}" (use one of ${OPERATION_NAMES.join(', ')})`
      )
    }
    results.push(run(model, new Reader(index, raw)))
  })
  return { diagram: copy, results }
}
