import type { NodeStyle } from '../styling/schema.ts'

// The kinds a stencil can be (ADR 0180): events and verbs, not things. A kind is a base shape with an
// optional mark on it, one row of this table. The list is closed and built in; a person cannot add
// a kind, and the file stores only the id (`data.kind` of a node of type `stencil`). An id says what
// the kind is, general first (`step-user`, `timer-event`), so related kinds sort together and a later
// kind has room beside them.

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
export type StencilMark =
  'cross' | 'plus' | 'ring' | 'clock' | 'envelope' | 'person' | 'gear' | 'sub-flow' | 'loop'

// Each mark as stroked paths in a 24-unit box (no fill, round caps), so the canvas, the exports and
// the legend draw the same shapes at any size.
export const STENCIL_MARK_PATHS: Record<StencilMark, string> = {
  cross: 'M6 6L18 18M6 18L18 6',
  plus: 'M5 12H19M12 5V19',
  ring: 'M12 5.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13',
  clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4.5l3 2',
  envelope: 'M4 7h16v10H4zM4 7l8 6l8-6',
  person: 'M12 5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4M5.5 20c0-4.2 3-6 6.5-6s6.5 1.8 6.5 6',
  gear:
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 3v3M12 18v3M3 12h3M18 12h3' +
    'M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  'sub-flow': 'M5 5h14v14H5zM12 8.5v7M8.5 12h7',
  loop: 'M18.5 11a6.5 6.5 0 0 0-11-3.5M7 4v4h4M5.5 13a6.5 6.5 0 0 0 11 3.5M17 20v-4h-4'
}

// The line width of a mark, in the units of its 24-unit box.
export const MARK_STROKE = 2

// An arrow's mark sits in a slot on its right, mirroring the band: `size` px square, `margin` px from
// the right edge.
export const ARROW_MARK = { size: 20, margin: 8 } as const

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
  // A circle drawn with a second ring inside the first (an event in the middle of a flow).
  doubleBorder?: boolean
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

const STEP = {
  group: 'Steps',
  shape: 'arrow',
  size: { width: 150, height: 56 },
  fill: '#1d3b40',
  stroke: '#4e939e'
} as const

const CHOICE = {
  group: 'Gateways',
  shape: 'square',
  size: { width: 48, height: 48 },
  fill: '#4d3d14'
} as const

const EVENT = { group: 'Events', shape: 'circle', size: { width: 40, height: 40 } } as const

export const STENCIL_KINDS: readonly StencilKind[] = [
  {
    ...STEP,
    id: 'step',
    name: 'Step',
    defaultLabel: 'Step',
    terms: ['task', 'activity', 'action', 'process step', 'bpmn task']
  },
  {
    ...STEP,
    id: 'step-user',
    name: 'User step',
    mark: 'person',
    defaultLabel: 'User step',
    terms: ['user task', 'manual task', 'manual', 'by hand', 'human', 'person', 'bpmn user task']
  },
  {
    ...STEP,
    id: 'step-automatic',
    name: 'Automatic step',
    mark: 'gear',
    defaultLabel: 'Automatic step',
    terms: [
      'service task',
      'script task',
      'automated',
      'automation',
      'system',
      'machine',
      'bpmn service task'
    ]
  },
  {
    ...STEP,
    id: 'step-sub-flow',
    name: 'Sub-flow',
    mark: 'sub-flow',
    defaultLabel: 'Sub-flow',
    terms: [
      'sub-process',
      'subprocess',
      'call activity',
      'collapsed sub-process',
      'nested',
      'drill down',
      'bpmn sub-process'
    ]
  },
  {
    ...STEP,
    id: 'step-repeat',
    name: 'Repeated step',
    mark: 'loop',
    defaultLabel: 'Repeated step',
    terms: ['loop', 'loop task', 'multi-instance', 'repeat', 'recurring', 'iterate', 'bpmn loop']
  },
  {
    ...CHOICE,
    id: 'exclusive-choice',
    name: 'Decision',
    mark: 'cross',
    defaultLabel: 'Decision',
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
    ...CHOICE,
    id: 'inclusive-choice',
    name: 'Inclusive choice',
    mark: 'ring',
    defaultLabel: 'Inclusive choice',
    terms: [
      'gateway',
      'inclusive gateway',
      'or',
      'one or more',
      'some of',
      'choice',
      'branch',
      'bpmn gateway'
    ]
  },
  {
    ...CHOICE,
    id: 'parallel-split-join',
    name: 'Parallel split or join',
    mark: 'plus',
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
    ...EVENT,
    id: 'start-event',
    name: 'Start',
    defaultLabel: 'Start',
    fill: '#1f3d26',
    terms: ['start event', 'begin', 'trigger', 'bpmn start event']
  },
  {
    ...EVENT,
    id: 'event',
    name: 'Event',
    doubleBorder: true,
    defaultLabel: 'Event',
    fill: '#2f3350',
    terms: [
      'intermediate event',
      'intermediate',
      'catch event',
      'throw event',
      'happens',
      'bpmn event'
    ]
  },
  {
    ...EVENT,
    id: 'timer-event',
    name: 'Timer',
    mark: 'clock',
    doubleBorder: true,
    defaultLabel: 'Timer',
    fill: '#2f3350',
    terms: ['timer event', 'wait', 'delay', 'deadline', 'schedule', 'clock', 'bpmn timer event']
  },
  {
    ...EVENT,
    id: 'message-event',
    name: 'Message',
    mark: 'envelope',
    doubleBorder: true,
    defaultLabel: 'Message',
    fill: '#2f3350',
    terms: ['message event', 'receive', 'send', 'notify', 'mail', 'signal', 'bpmn message event']
  },
  {
    ...EVENT,
    id: 'end-event',
    name: 'End',
    heavyBorder: true,
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

// The room an arrow takes on each side of its label: the band on the left and, when the kind has a
// mark, the mark's slot on the right. The label is centred in what is left.
export function stencilLabelInsets(id: string | undefined): { left: number; right: number } {
  const kind = stencilKind(id)
  if (kind.shape !== 'arrow') return { left: 0, right: 0 }
  return { left: ARROW_BAND.tip, right: kind.mark ? ARROW_MARK.size + ARROW_MARK.margin : 0 }
}

// Where a kind's mark goes inside its shape's box (`width` × `height`, origin at the box's corner):
// centred for the small shapes, in the right-hand slot for an arrow. `small` is a legend swatch, where
// the slot shrinks with the box.
export function stencilMarkBox(
  kind: StencilKind,
  width: number,
  height: number,
  small = false
): { x: number; y: number; size: number } {
  if (kind.shape === 'arrow') {
    const size = small ? height * 0.62 : ARROW_MARK.size
    const margin = small ? 2.5 : ARROW_MARK.margin
    return { x: width - margin - size, y: (height - size) / 2, size }
  }
  const size = Math.min(width, height) * (kind.doubleBorder ? 0.42 : 0.46)
  return { x: (width - size) / 2, y: (height - size) / 2, size }
}

// A heavier border for the kinds that ask for it, as a multiple of the border width.
export const HEAVY_BORDER_FACTOR = 2.5

// The gap between the two rings of a double border, from line to line, beyond the line width.
export const DOUBLE_BORDER_GAP = 3

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
