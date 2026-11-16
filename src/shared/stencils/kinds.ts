import type { NodeStyle } from '../styling/schema.ts'

// The kinds a stencil can be (ADR 0180): events and verbs, not things. A kind is a base shape with an
// optional mark on it, one row of this table. The list is closed and built in; a person cannot add
// a kind, and the file stores only the id (`data.kind` of a node of type `stencil`).

// An arrow is a rectangle with an arrow-shaped band down its left side, so a step does not look like
// an entity. The band is fixed, not a direction: the flow's direction is given by its edges.
export type StencilShape = 'circle' | 'square' | 'arrow'

// The band of an arrow shape: flat for `flat` px from the left edge, then a point reaching `tip` px.
export const ARROW_BAND = { flat: 16, tip: 28 } as const

// The outline of the band inside a box with the given left, top and bottom edges (the middle of the
// border), its two left corners rounded with the box's own radius so it does not poke out of them.
// `scale` shrinks the band for a legend swatch.
export function arrowBandPath(
  left: number,
  top: number,
  bottom: number,
  radius: number,
  scale = 1
): string {
  const r = Math.max(0, Math.min(radius, (bottom - top) / 2))
  const mid = (top + bottom) / 2
  const flat = ARROW_BAND.flat * scale
  const tip = ARROW_BAND.tip * scale
  return (
    `M${left + r} ${top}H${left + flat}L${left + tip} ${mid}` +
    `L${left + flat} ${bottom}H${left + r}` +
    `A${r} ${r} 0 0 1 ${left} ${bottom - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`
  )
}
// Drawn by the app as vector graphics, never an image.
export type StencilMark = 'cross' | 'plus'

export interface StencilKind {
  id: string
  // The neutral name shown in the picker, the legend and the property panel.
  name: string
  // The picker's section.
  group: string
  shape: StencilShape
  mark?: StencilMark
  // Drawn with a heavier border than other kinds (an end).
  heavyBorder?: boolean
  // The size a new one gets.
  size: { width: number; height: number }
  // Fills the label of a new one when the person has not typed one.
  defaultLabel: string
  // The default fill in the stored form (the dark-theme colour, flipped for the light theme as every
  // stored colour is). Absent: the entity's own default.
  fill?: string
  // The same for the border; an arrow's band takes this colour.
  stroke?: string
  // What the kind is called elsewhere, for the picker's search: BPMN terms live here and nowhere
  // else, the app's own words stay neutral (ADR 0080).
  terms: readonly string[]
}

export const STENCIL_KINDS: readonly StencilKind[] = [
  {
    id: 'step',
    name: 'Step',
    group: 'Steps',
    shape: 'arrow',
    size: { width: 150, height: 56 },
    defaultLabel: 'Step',
    fill: '#1d3b40',
    stroke: '#4e939e',
    terms: ['task', 'activity', 'action', 'process step', 'bpmn task']
  },
  {
    id: 'decision',
    name: 'Decision',
    group: 'Gateways',
    shape: 'square',
    mark: 'cross',
    size: { width: 48, height: 48 },
    defaultLabel: 'Decision',
    fill: '#4d3d14',
    terms: [
      'gateway',
      'exclusive gateway',
      'xor',
      'choice',
      'exclusive choice',
      'branch',
      'bpmn gateway'
    ]
  },
  {
    id: 'parallel',
    name: 'Parallel split or join',
    group: 'Gateways',
    shape: 'square',
    mark: 'plus',
    size: { width: 48, height: 48 },
    defaultLabel: 'Parallel',
    fill: '#1c3550',
    terms: [
      'gateway',
      'parallel gateway',
      'and',
      'fork',
      'join',
      'split',
      'concurrent',
      'bpmn gateway'
    ]
  },
  {
    id: 'start',
    name: 'Start',
    group: 'Events',
    shape: 'circle',
    size: { width: 40, height: 40 },
    defaultLabel: 'Start',
    fill: '#1f3d26',
    terms: ['start event', 'begin', 'trigger', 'bpmn start event']
  },
  {
    id: 'end',
    name: 'End',
    group: 'Events',
    shape: 'circle',
    heavyBorder: true,
    size: { width: 40, height: 40 },
    defaultLabel: 'End',
    fill: '#4a2326',
    terms: ['end event', 'finish', 'stop', 'terminate', 'bpmn end event']
  }
]

export const DEFAULT_STENCIL_KIND = 'step'

const BY_ID = new Map(STENCIL_KINDS.map((kind) => [kind.id, kind]))

// A kind id this version does not know (a file from a newer one) is drawn as a step, so the element
// is still there and can still be connected.
export function stencilKind(id: string | undefined): StencilKind {
  return BY_ID.get(id ?? '') ?? (BY_ID.get(DEFAULT_STENCIL_KIND) as StencilKind)
}

// The small shapes carry their label below them, since text does not fit inside; a step's label
// sits inside it.
export function stencilLabelOutside(id: string | undefined): boolean {
  return stencilKind(id).shape !== 'arrow'
}

// The room an arrow's band takes on the left of the label, so the label is centred in what is left.
export function stencilLabelInset(id: string | undefined): number {
  return stencilKind(id).shape === 'arrow' ? ARROW_BAND.tip : 0
}

// A heavier border for the kinds that ask for it, as a multiple of the border width.
export const HEAVY_BORDER_FACTOR = 2.5

// What a search for this element also matches: its kind's name and terms.
export function stencilSearchText(id: string | undefined): string {
  const kind = stencilKind(id)
  return [kind.name, ...kind.terms].join(' ')
}

// The style a stencil is drawn with: its own, with the kind's default colours where it has none.
export function stencilStyle(
  id: string | undefined,
  style: NodeStyle | undefined
): NodeStyle | undefined {
  const { fill, stroke } = stencilKind(id)
  if (!fill && !stroke) return style
  return {
    ...style,
    ...(fill && !style?.fill ? { fill } : {}),
    ...(stroke && !style?.stroke ? { stroke } : {})
  }
}
