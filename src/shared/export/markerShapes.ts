import type { MarkerKind } from '../diagram'

// The edge-end markers (ADR 0014) as data, so the canvas (renderer/edges/edgeMarkers.tsx draws these
// as <marker> elements with `context-stroke`) and the SVG export (ADR 0124, which writes one
// literal-colour copy per colour) cannot drift apart.
//
// React Flow's MarkerType covers only plain and closed arrows, so circles, diamonds and crow's-foot
// are hand-drawn. Every shape points toward +x (the node the edge connects to) with its attachment
// point (where it meets the node boundary) at the marker's refX. orient="auto-start-reverse"
// handles both ends: forward for markerEnd, flipped 180° for markerStart, so one definition serves
// both.
//
// Deliberately approximate, not pixel-correct ERD/UML notation (ADR 0014's Notes on why the
// notation question is out of scope): the shapes only need to be recognizably right.

export type MarkerElement =
  | { tag: 'path'; d: string; filled: boolean }
  | { tag: 'circle'; cx: number; cy: number; r: number; filled: boolean }

export interface MarkerShape {
  id: string
  viewBox: string
  refX: number
  refY: number
  markerWidth: number
  markerHeight: number
  elements: MarkerElement[]
}

export const MARKER_STROKE_WIDTH = 1.5

const line = (d: string): MarkerElement => ({ tag: 'path', d, filled: false })
const solid = (d: string): MarkerElement => ({ tag: 'path', d, filled: true })
const ring = (cx: number, cy: number, r: number): MarkerElement => ({
  tag: 'circle',
  cx,
  cy,
  r,
  filled: false
})
const disc = (cx: number, cy: number, r: number): MarkerElement => ({
  tag: 'circle',
  cx,
  cy,
  r,
  filled: true
})

export const MARKER_SHAPES: Record<Exclude<MarkerKind, 'none'>, MarkerShape> = {
  arrowOpen: {
    id: 'chd-marker-arrow-open',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    elements: [line('M1,1 L8,5 L1,9')]
  },
  arrowClosed: {
    id: 'chd-marker-arrow-closed',
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    elements: [solid('M1,1 L9,5 L1,9 Z')]
  },
  circle: {
    id: 'chd-marker-circle',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    elements: [ring(5, 5, 3)]
  },
  circleFilled: {
    id: 'chd-marker-circle-filled',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    elements: [disc(5, 5, 3)]
  },
  diamond: {
    id: 'chd-marker-diamond',
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 9,
    markerHeight: 8,
    elements: [line('M1,5 L5,1 L9,5 L5,9 Z')]
  },
  diamondFilled: {
    id: 'chd-marker-diamond-filled',
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 9,
    markerHeight: 8,
    elements: [solid('M1,5 L5,1 L9,5 L5,9 Z')]
  },
  crowsFootOne: {
    id: 'chd-marker-crows-one',
    viewBox: '0 0 10 10',
    refX: 6,
    refY: 5,
    markerWidth: 7,
    markerHeight: 8,
    elements: [line('M6,1 L6,9')]
  },
  crowsFootMany: {
    id: 'chd-marker-crows-many',
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    elements: [line('M9,5 L1,1 M9,5 L1,5 M9,5 L1,9')]
  },
  crowsFootOneOrMany: {
    id: 'chd-marker-crows-one-or-many',
    viewBox: '0 0 14 10',
    refX: 13,
    refY: 5,
    markerWidth: 11,
    markerHeight: 8,
    elements: [line('M13,5 L5,1 M13,5 L5,5 M13,5 L5,9 M3,1 L3,9')]
  },
  crowsFootZeroOrOne: {
    id: 'chd-marker-crows-zero-or-one',
    viewBox: '0 0 12 10',
    refX: 9,
    refY: 5,
    markerWidth: 9.6,
    markerHeight: 8,
    elements: [line('M9,1 L9,9'), ring(4.5, 5, 3)]
  },
  crowsFootZeroOrMany: {
    id: 'chd-marker-crows-zero-or-many',
    viewBox: '0 0 14 10',
    refX: 13,
    refY: 5,
    markerWidth: 11,
    markerHeight: 8,
    elements: [line('M13,5 L7,1 M13,5 L7,5 M13,5 L7,9'), ring(3.5, 5, 3)]
  }
}

export const MARKER_ID: Record<Exclude<MarkerKind, 'none'>, string> = Object.fromEntries(
  Object.entries(MARKER_SHAPES).map(([kind, shape]) => [kind, shape.id])
) as Record<Exclude<MarkerKind, 'none'>, string>
