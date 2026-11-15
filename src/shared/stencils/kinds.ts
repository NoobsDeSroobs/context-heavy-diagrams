import type { NodeStyle } from '../styling/schema.ts'

// The kinds a stencil can be (ADR 0180): events and verbs, not things. A kind is a base shape with an
// optional mark on it, one row of this table. The list is closed and built in; a person cannot add
// a kind, and the file stores only the id (`data.kind` of a node of type `stencil`).

export type StencilShape = 'circle' | 'square' | 'rounded'
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
  // What the kind is called elsewhere, for the picker's search: BPMN terms live here and nowhere
  // else, the app's own words stay neutral (ADR 0080).
  terms: readonly string[]
}

export const STENCIL_KINDS: readonly StencilKind[] = [
  {
    id: 'step',
    name: 'Step',
    group: 'Steps',
    shape: 'rounded',
    size: { width: 140, height: 56 },
    defaultLabel: 'Step',
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
  return stencilKind(id).shape !== 'rounded'
}

// A heavier border for the kinds that ask for it, as a multiple of the border width.
export const HEAVY_BORDER_FACTOR = 2.5

// What a search for this element also matches: its kind's name and terms.
export function stencilSearchText(id: string | undefined): string {
  const kind = stencilKind(id)
  return [kind.name, ...kind.terms].join(' ')
}

// The style a stencil is drawn with: its own, with the kind's default fill where it has none.
export function stencilStyle(
  id: string | undefined,
  style: NodeStyle | undefined
): NodeStyle | undefined {
  const kind = stencilKind(id)
  return kind.fill && !style?.fill ? { ...style, fill: kind.fill } : style
}
