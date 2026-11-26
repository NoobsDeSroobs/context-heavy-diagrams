// Portals: an edge drawn broken, with a mark and a number at each end of the gap. A portal is only
// a way of drawing; the edge stays one whole edge to everything else (layout check, compare,
// search, the legend). The three style fields are in styling/schema.ts and docs/file-format.md.
//
// This file is the one place that works out where the gap is, so the canvas and the SVG/PNG export
// draw the same thing.
import { flattenPath } from '../geometry/pathSampling.ts'
import {
  formatPieces,
  headOfPiece,
  parsePieces,
  reversePieces,
  type Piece
} from '../geometry/trimPath.ts'

// The gap a new portal has: 60 pixels, 30 on each side of the middle of the edge.
export const PORTAL_GAP_PX = 60
// A gap narrower than this is not drawn (the edge is drawn whole), and the two ends keep at least
// this much apart when one is moved.
export const PORTAL_MIN_GAP_PX = 24
// The drawn part kept at each element, so a mark never sits on the element it leaves.
export const PORTAL_MIN_STUB_PX = 14

export interface Portal {
  // Fractions (0-1) of the path's length where the drawn edge stops and starts again.
  start: number
  end: number
  // Typed by the person; absent means the number is made from the order in the file.
  number?: number
}

interface PortalStyleFields {
  portalStart?: unknown
  portalEnd?: unknown
  portalNumber?: unknown
}

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

// The portal an edge style holds, or undefined for a whole edge. A start that is not before the end,
// or a value outside 0-1, means no portal.
export function readPortal(style: PortalStyleFields | undefined): Portal | undefined {
  if (!style || !isFraction(style.portalStart) || !isFraction(style.portalEnd)) return undefined
  if (style.portalStart >= style.portalEnd) return undefined
  const number = style.portalNumber
  return {
    start: style.portalStart,
    end: style.portalEnd,
    ...(typeof number === 'number' && Number.isInteger(number) && number >= 1 ? { number } : {})
  }
}

const round = (value: number): number => Math.round(value * 10000) / 10000

// The portal a new one starts as: the gap in the middle of an edge `length` pixels long, or
// undefined when the edge is too short to hold it with a drawn part at each end.
export function defaultPortal(length: number): Portal | undefined {
  if (length < PORTAL_GAP_PX + 2 * PORTAL_MIN_STUB_PX) return undefined
  const half = PORTAL_GAP_PX / 2 / length
  return { start: round(0.5 - half), end: round(0.5 + half) }
}

// Moving one end: the other stays, and the gap keeps its minimum and the drawn parts theirs.
export function movePortalEnd(
  portal: Portal,
  which: 'start' | 'end',
  to: number,
  length: number
): Portal {
  const stub = PORTAL_MIN_STUB_PX / length
  const gap = PORTAL_MIN_GAP_PX / length
  if (which === 'start') {
    return { ...portal, start: round(Math.max(stub, Math.min(to, portal.end - gap))) }
  }
  return { ...portal, end: round(Math.min(1 - stub, Math.max(to, portal.start + gap))) }
}

// The portal seen from the other end of the edge, for when the edge's direction is reversed.
export function mirrorPortal(portal: Portal): Portal {
  return { ...portal, start: round(1 - portal.end), end: round(1 - portal.start) }
}

// An edge style as it reads from the other end of the edge (a reversed direction): the label's place
// and the portal are fractions measured from the source, so they mirror to 1 - x.
export function mirrorEdgeStylePositions<T extends PortalStyleFields & { labelPosition?: number }>(
  style: T
): T {
  const out: T = { ...style }
  if (style.labelPosition !== undefined) out.labelPosition = round(1 - style.labelPosition)
  const portal = readPortal(style)
  if (portal) {
    const mirrored = mirrorPortal(portal)
    out.portalStart = mirrored.start
    out.portalEnd = mirrored.end
  }
  return out
}

// -- the path

interface Mark {
  x: number
  y: number
  // The direction the edge runs in at this end, in degrees.
  angle: number
}

export interface PortalSplit {
  // The drawn part from the source to the gap, and from the gap to the target, as path strings.
  lead: string
  tail: string
  // Where the edge goes into the gap, and where it comes out.
  entry: Mark
  exit: Mark
  gapPx: number
}

const STEPS = 24

interface Walk {
  piece: Piece
  length: number
  // Cumulative length at each of STEPS+1 samples (2 for a line).
  samples: number[]
  points: { x: number; y: number }[]
}

function sampled(piece: Piece): Walk {
  const lerp = (t: number): { x: number; y: number } => {
    const u = 1 - t
    if (piece.length === 2) {
      return {
        x: u * piece[0].x + t * piece[1].x,
        y: u * piece[0].y + t * piece[1].y
      }
    }
    if (piece.length === 3) {
      return {
        x: u * u * piece[0].x + 2 * u * t * piece[1].x + t * t * piece[2].x,
        y: u * u * piece[0].y + 2 * u * t * piece[1].y + t * t * piece[2].y
      }
    }
    return {
      x:
        u * u * u * piece[0].x +
        3 * u * u * t * piece[1].x +
        3 * u * t * t * piece[2].x +
        t * t * t * piece[3].x,
      y:
        u * u * u * piece[0].y +
        3 * u * u * t * piece[1].y +
        3 * u * t * t * piece[2].y +
        t * t * t * piece[3].y
    }
  }
  const count = piece.length === 2 ? 1 : STEPS
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= count; i++) points.push(lerp(i / count))
  const samples = [0]
  for (let i = 1; i < points.length; i++) {
    samples.push(
      samples[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    )
  }
  return { piece, length: samples[samples.length - 1], samples, points }
}

// Where `distance` falls: the piece, the parameter t inside it, the point and the direction.
function locate(
  walks: Walk[],
  distance: number
): { index: number; t: number; mark: Mark } | undefined {
  let rest = distance
  for (let index = 0; index < walks.length; index++) {
    const walk = walks[index]
    if (rest > walk.length && index < walks.length - 1) {
      rest -= walk.length
      continue
    }
    const local = Math.max(0, Math.min(rest, walk.length))
    const count = walk.points.length - 1
    let k = 1
    while (k < count && walk.samples[k] < local) k++
    const span = walk.samples[k] - walk.samples[k - 1]
    const f = span === 0 ? 0 : (local - walk.samples[k - 1]) / span
    const a = walk.points[k - 1]
    const b = walk.points[k]
    return {
      index,
      t: (k - 1 + f) / count,
      mark: {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      }
    }
  }
  return undefined
}

// The pieces from the start of the path up to a place found by `locate`.
function leadPieces(walks: Walk[], at: { index: number; t: number }): Piece[] {
  const kept = walks.slice(0, at.index).map((w) => w.piece)
  kept.push(headOfPiece(walks[at.index].piece, at.t))
  return kept
}

// The edge cut into its two drawn parts for `portal`, with the marks, or undefined when the edge is
// drawn whole: a path this module cannot read, a gap narrower than PORTAL_MIN_GAP_PX, or a drawn
// part at either end shorter than PORTAL_MIN_STUB_PX.
export function splitPath(d: string, portal: Portal): PortalSplit | undefined {
  const pieces = parsePieces(d)
  if (!pieces) return undefined
  const walks = pieces.map(sampled)
  const length = walks.reduce((sum, w) => sum + w.length, 0)
  const startAt = portal.start * length
  const endAt = portal.end * length
  if (
    endAt - startAt < PORTAL_MIN_GAP_PX ||
    startAt < PORTAL_MIN_STUB_PX ||
    length - endAt < PORTAL_MIN_STUB_PX
  ) {
    return undefined
  }
  const entry = locate(walks, startAt)
  const exit = locate(walks, endAt)
  if (!entry || !exit) return undefined
  const lead = leadPieces(walks, entry)
  // The tail is the lead of the reversed path, turned back.
  const flipped = [...walks].reverse().map((w) => sampled(reversePieces([w.piece])[0]))
  const back = locate(flipped, length - endAt)
  if (!back) return undefined
  const tail = reversePieces(leadPieces(flipped, back))
  return {
    lead: formatPieces(lead),
    tail: formatPieces(tail),
    entry: entry.mark,
    exit: exit.mark,
    gapPx: endAt - startAt
  }
}

// The length the path would have for the ratio fields, as the canvas and the export measure it.
export function pathLength(d: string): number {
  const points = flattenPath(d)
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

// -- the marks

export type PortalMarkKind = 'tilde' | 'oval'

// A curved S turned across the edge, drawn about the origin and moved and turned onto the edge.
export const PORTAL_TILDE_PATH = 'M -11 0 C -7 -6.5 -3.5 -6.5 0 0 S 7 6.5 11 0'
export const PORTAL_OVAL = { rx: 5.5, ry: 12 }
export const PORTAL_MARK_WIDTH = 2.4
// One colour for every portal; the number matches the ends, never the colour.
export const PORTAL_COLOR = { light: '#4a9be8', dark: '#8ec1f3' }
const NUMBER_DISTANCE = 19

// The mark's turn: across the edge for a tilde, along it for an oval.
export const markTransform = (mark: Mark, kind: PortalMarkKind): string =>
  `translate(${round(mark.x)} ${round(mark.y)}) rotate(${round(mark.angle + (kind === 'tilde' ? 90 : 0))})`

// Where the number sits: beside the mark, on the side of the gap.
export function numberPoint(mark: Mark, towardsGap: 1 | -1): { x: number; y: number } {
  const rad = (mark.angle * Math.PI) / 180
  return {
    x: round(mark.x + Math.cos(rad) * NUMBER_DISTANCE * towardsGap),
    y: round(mark.y + Math.sin(rad) * NUMBER_DISTANCE * towardsGap + 4)
  }
}

// -- numbers

interface EdgeWithStyle {
  id: string
  style?: PortalStyleFields
}

// The number each portalled edge shows: the one the person typed, else the next free number counted
// from 1 in file order, skipping numbers typed on other edges so an automatic number never repeats
// one the person chose.
export function portalNumbers(edges: readonly EdgeWithStyle[]): Map<string, number> {
  const typed = new Set<number>()
  for (const edge of edges) {
    const portal = readPortal(edge.style)
    if (portal?.number !== undefined) typed.add(portal.number)
  }
  const out = new Map<string, number>()
  let next = 1
  for (const edge of edges) {
    const portal = readPortal(edge.style)
    if (!portal) continue
    if (portal.number !== undefined) {
      out.set(edge.id, portal.number)
      continue
    }
    while (typed.has(next)) next++
    out.set(edge.id, next)
    next++
  }
  return out
}

// Numbers shown on more than one edge, with the edges that show them (a typed number repeated).
export function duplicatePortalNumbers(
  edges: readonly EdgeWithStyle[]
): { number: number; edgeIds: string[] }[] {
  const byNumber = new Map<number, string[]>()
  for (const [id, number] of portalNumbers(edges)) {
    byNumber.set(number, [...(byNumber.get(number) ?? []), id])
  }
  return [...byNumber]
    .filter(([, ids]) => ids.length > 1)
    .map(([number, edgeIds]) => ({ number, edgeIds }))
}

// Whether a point on the path, at `ratio` of its length, falls in the hidden middle of the portal.
export const inPortalGap = (portal: Portal, ratio: number): boolean =>
  ratio > portal.start && ratio < portal.end

interface NoticeEdge extends EdgeWithStyle {
  label?: string
}

// What is worth telling the person about their portals, as lines for the Diagnostics panel: a number
// shown on more than one edge, and an edge label that falls in the hidden middle (it is left where it
// is; moving it is the person's call).
export function portalNotices(edges: readonly NoticeEdge[]): string[] {
  const name = (id: string): string => {
    const edge = edges.find((e) => e.id === id)
    return edge?.label ? `"${edge.label}"` : id
  }
  const out: string[] = []
  for (const { number, edgeIds } of duplicatePortalNumbers(edges)) {
    out.push(
      `Portal number ${number} is on ${edgeIds.length} edges: ${edgeIds.map(name).join(', ')}`
    )
  }
  for (const edge of edges) {
    const portal = readPortal(edge.style)
    const position = (edge.style as { labelPosition?: unknown } | undefined)?.labelPosition
    const at = typeof position === 'number' ? position : 0.5
    if (portal && edge.label && inPortalGap(portal, at)) {
      out.push(`The label of ${name(edge.id)} is in the hidden part of its portal`)
    }
  }
  return out
}
