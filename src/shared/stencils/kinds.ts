import type { NodeStyle } from '../styling/schema.ts'

// The kinds a stencil can be: events and verbs, not things. A kind is a base shape with an
// optional mark on it, one row of this table. The list is closed and built in; a person cannot add
// a kind, and the file stores only the id (`data.kind` of a node of type `stencil`). An id says what
// the kind is, the base word first and the subtype after (`step-user`, `event-timer`), so related kinds sort together and a later
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
  | 'fork'
  | 'overlap'
  | 'bars'
  | 'merge'
  | 'first'
  | 'robot'
  | 'layers'
  | 'repeat'
  | 'person'
  | 'play'
  | 'clock'
  | 'envelope'
  | 'check'
  | 'check-warn'
  | 'cross'
  | 'stop'

// Each mark as stroked paths in a 24-unit box (round caps), so the canvas, the exports and the legend
// draw the same shapes at any size. A dot is a stroked point (`h.01`), which the round caps swell.
export const STENCIL_MARK_PATHS: Record<StencilMark, string> = {
  fork: 'M3 12h7M10 12L20 5M10 12L20 19',
  overlap:
    'M8.8 6.4a5.6 5.6 0 1 0 0 11.2a5.6 5.6 0 1 0 0-11.2M15.2 6.4a5.6 5.6 0 1 0 0 11.2a5.6 5.6 0 1 0 0-11.2',
  // Parallel paths, and the two ways to close them: every path meets in the middle, or two paths of
  // which the second stops (one is enough). The three share the lanes at 7 and 17.
  bars: 'M4 7h16M4 17h16',
  merge: 'M3 7H8C13 7 13 12 16 12M3 17H8C13 17 13 12 16 12M16 12H21',
  first: 'M3 7h18M3 17h11M14 14v6',
  robot:
    'M7.5 8h9a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-6A2.5 2.5 0 0 1 7.5 8z' +
    'M12 8V4.5M9.5 16.5h5M9.5 12.5h.01M14.5 12.5h.01',
  layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 13l8.5 4.5 8.5-4.5',
  repeat:
    'M17 2.5l3.5 3.5L17 9.5M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13M7 21.5L3.5 18 7 14.5M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5',
  person: 'M12 5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4M5.5 20c0-4.2 3-6 6.5-6s6.5 1.8 6.5 6',
  play: 'M8 5l11 7-11 7z',
  clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4.5l3 2',
  envelope: 'M4 7h16v10H4zM4 7l8 6l8-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  'check-warn': 'M2.5 13.5l3.8 3.8L13 9.5M19.5 5.5v7.5M19.5 18h.01',
  cross: 'M6 6L18 18M6 18L18 6',
  stop: 'M7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6z'
}

// The marks that are solid shapes: drawn filled with the mark's colour as well as stroked.
export const STENCIL_MARK_SOLID: ReadonlySet<StencilMark> = new Set(['play', 'stop'])

// Some marks read better a little larger or smaller than the standard size.
const MARK_SCALE: Partial<Record<StencilMark, number>> = {
  fork: 1.2,
  overlap: 1.2,
  bars: 1.2,
  merge: 1.2,
  first: 1.2,
  'check-warn': 1.15,
  stop: 0.85
}

export function stencilMarkScale(mark: StencilMark | undefined): number {
  return mark ? (MARK_SCALE[mark] ?? 1) : 1
}

// How an end finishes (the end's `outcome`, absent is `success`) and how far it reaches (its `reach`,
// absent is `path`): two named states, not flags, so a later value has room. An outcome is told by
// the mark; a reach of the whole flow by a solid disc with the mark cut out of it.
export const END_OUTCOMES = [
  { id: 'success', name: 'Success', mark: 'check' },
  { id: 'warnings', name: 'Success with warnings', mark: 'check-warn' },
  { id: 'failed', name: 'Failed', mark: 'cross' },
  { id: 'aborted', name: 'Aborted', mark: 'stop' }
] as const satisfies readonly { id: string; name: string; mark: StencilMark }[]

export type EndOutcome = (typeof END_OUTCOMES)[number]['id']
export const DEFAULT_END_OUTCOME: EndOutcome = 'success'

export const END_REACHES = [
  { id: 'path', name: 'This path ends' },
  { id: 'flow', name: 'The whole flow stops' }
] as const
export type EndReach = (typeof END_REACHES)[number]['id']
export const DEFAULT_END_REACH: EndReach = 'path'

// An outcome or a reach this version does not know (from a newer one) is drawn as the default.
export function endOutcomeOf(value: unknown): EndOutcome {
  return END_OUTCOMES.find((o) => o.id === value)?.id ?? DEFAULT_END_OUTCOME
}
export function endReachOf(value: unknown): EndReach {
  return END_REACHES.find((r) => r.id === value)?.id ?? DEFAULT_END_REACH
}

// Whether an event begins a flow or sits inside one (the node's `flowPosition`, absent is `in-flow`): a
// named state, not a flag, so a third can be added. An unknown value is drawn as `in-flow`.
export const FLOW_POSITIONS = [
  { id: 'start', name: 'Starts a flow' },
  { id: 'in-flow', name: 'In the flow' }
] as const
export type FlowPosition = (typeof FLOW_POSITIONS)[number]['id']
export const DEFAULT_FLOW_POSITION: FlowPosition = 'in-flow'
export function flowPositionOf(value: unknown): FlowPosition {
  return FLOW_POSITIONS.find((p) => p.id === value)?.id ?? DEFAULT_FLOW_POSITION
}

// What a node's own data changes in how its kind is drawn: an end's outcome and reach, an event's
// position in the flow.
export interface StencilState {
  outcome?: unknown
  reach?: unknown
  flowPosition?: unknown
}

// Whether a node is drawn with a second ring inside the first: an event in the flow, not one that
// starts it. Only the kinds with a position can start a flow; the plain start has one ring always.
export function stencilDoubleBorder(kind: StencilKind, data?: StencilState): boolean {
  if (!kind.doubleBorder) return false
  return !(kind.positioned && flowPositionOf(data?.flowPosition) === 'start')
}

// The mark a node is drawn with: its kind's, or for an end the one of its outcome.
export function stencilMarkOf(kind: StencilKind, data?: StencilState): StencilMark | undefined {
  if (!kind.endsFlow) return kind.mark
  return END_OUTCOMES.find((o) => o.id === endOutcomeOf(data?.outcome))?.mark
}

// Whether a node is drawn as a solid disc with its mark cut out: an end that stops the whole flow.
export function stencilSolid(kind: StencilKind, data?: StencilState): boolean {
  return kind.endsFlow === true && endReachOf(data?.reach) === 'flow'
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
  // Has a `flowPosition`: it can start a flow (one ring) or sit in one (two rings, the default).
  positioned?: boolean
  // An end: it has an outcome and a reach (see END_OUTCOMES), which set its mark and its disc.
  endsFlow?: boolean
  // The size a new one gets.
  size: { width: number; height: number }
  // Fills the label of a new one when the person has not typed one.
  defaultLabel: string
  // The default fill in the stored form (the dark-theme colour, flipped for the light theme as every
  // stored colour is). Absent: the entity's own default.
  fill?: string
  // The same for the border; an arrow's band takes this colour.
  stroke?: string
  // The colours as they look in the light theme (final colours, see stencilLightColors): the flip of the
  // dark ones above would not keep the three families at their own lightness.
  light?: { fill?: string; stroke?: string }
  // What the kind is called elsewhere, for the picker's search: BPMN terms live here and nowhere
  // else, the app's own words stay neutral (ADR 0080).
  terms: readonly string[]
}

// One colour per family (four: steps, decisions, parallel, events), so the families differ in lightness (for readers who do not see colour) and
// nothing varies inside one: a kind is told by its shape and mark. No red: it reads as an error.
const STEP = {
  group: 'Steps',
  shape: 'arrow',
  size: { width: 150, height: 56 },
  fill: '#345a60',
  stroke: '#4e939e',
  light: { fill: '#a5c8ce', stroke: '#3b6e77' }
} as const

const CHOICE = {
  group: 'Decisions',
  shape: 'square',
  size: { width: 48, height: 48 },
  fill: '#97782d',
  light: { fill: '#f7edd6' }
} as const

// The branches that run side by side and the joins that wait for them, told from the decisions by
// colour: a plum, a hue none of the other families has, and darker than they are in both themes (the
// light theme stops where its dark marks would lose contrast).
const PARALLEL = {
  ...CHOICE,
  group: 'Parallel',
  fill: '#2f0f34',
  stroke: '#c27fcb',
  light: { fill: '#ae62b3', stroke: '#6b2a72' }
} as const

const EVENT = {
  group: 'Events',
  shape: 'circle',
  size: { width: 40, height: 40 },
  fill: '#2f3141',
  stroke: '#c1c5ef',
  light: { fill: '#8f96e2', stroke: '#4f537c' }
} as const

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
    id: 'step-human',
    name: 'Human step',
    mark: 'person',
    defaultLabel: 'Human step',
    terms: [
      'user step',
      'user task',
      'manual task',
      'manual',
      'by hand',
      'human',
      'person',
      'bpmn user task'
    ]
  },
  {
    ...STEP,
    id: 'step-automatic',
    name: 'Automatic step',
    mark: 'robot',
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
    mark: 'layers',
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
    mark: 'repeat',
    defaultLabel: 'Repeated step',
    terms: ['loop', 'loop task', 'multi-instance', 'repeat', 'recurring', 'iterate', 'bpmn loop']
  },
  {
    ...CHOICE,
    id: 'branch-exclusive',
    name: 'Decision',
    mark: 'fork',
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
    id: 'branch-inclusive',
    name: 'Inclusive choice',
    mark: 'overlap',
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
    ...PARALLEL,
    id: 'branch-parallel',
    name: 'Run in parallel',
    mark: 'bars',
    defaultLabel: 'Parallel',
    terms: [
      'gateway',
      'parallel gateway',
      'parallel split or join',
      'and',
      'fork',
      'join',
      'split',
      'concurrent',
      'bpmn gateway'
    ]
  },
  // The two ways to close parallel paths: when every path has arrived, or when the first has.
  {
    ...PARALLEL,
    id: 'branch-all',
    name: 'Wait for all',
    mark: 'merge',
    defaultLabel: 'All',
    terms: [
      'gateway',
      'and',
      'all of',
      'every path',
      'join',
      'merge',
      'synchronise',
      'wait for all',
      'pick all',
      'bpmn gateway'
    ]
  },
  {
    ...PARALLEL,
    id: 'branch-one',
    name: 'Wait for first',
    mark: 'first',
    defaultLabel: 'First',
    terms: [
      'gateway',
      'or',
      'any',
      'any of',
      'one of',
      'first of',
      'race',
      'discriminator',
      'pick one',
      'join',
      'merge',
      'bpmn gateway'
    ]
  },
  {
    ...EVENT,
    id: 'event-start',
    name: 'Start',
    mark: 'play',
    defaultLabel: 'Start',
    terms: ['start event', 'begin', 'trigger', 'bpmn start event']
  },
  {
    ...EVENT,
    id: 'event',
    name: 'Event',
    doubleBorder: true,
    positioned: true,
    defaultLabel: 'Event',
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
    id: 'event-timer',
    name: 'Timer',
    mark: 'clock',
    doubleBorder: true,
    positioned: true,
    defaultLabel: 'Timer',
    terms: ['timer event', 'wait', 'delay', 'deadline', 'schedule', 'clock', 'bpmn timer event']
  },
  {
    ...EVENT,
    id: 'event-message',
    name: 'Message',
    mark: 'envelope',
    doubleBorder: true,
    positioned: true,
    defaultLabel: 'Message',
    terms: ['message event', 'receive', 'send', 'notify', 'mail', 'signal', 'bpmn message event']
  },
  {
    ...EVENT,
    id: 'event-human',
    name: 'Human action',
    mark: 'person',
    doubleBorder: true,
    positioned: true,
    defaultLabel: 'Human action',
    terms: [
      'user action',
      'user event',
      'approval',
      'approve',
      'request',
      'waits for a person',
      'manual',
      'human',
      'person'
    ]
  },
  {
    ...EVENT,
    id: 'event-end',
    name: 'End',
    heavyBorder: true,
    endsFlow: true,
    mark: 'check',
    defaultLabel: 'End',
    terms: ['end event', 'finish', 'stop', 'terminate', 'bpmn end event']
  }
]

export const DEFAULT_STENCIL_KIND = 'step'

const BY_ID = new Map(STENCIL_KINDS.map((kind) => [kind.id, kind]))

// Ids a kind had before it was renamed, read as the current one and never written. `step-user` became
// `step-human`: the person a step waits for is often part of the system, not the one using it.
export const LEGACY_KIND_IDS: Readonly<Record<string, string>> = { 'step-user': 'step-human' }

export function currentKindId(id: string | undefined): string | undefined {
  return id === undefined ? undefined : (LEGACY_KIND_IDS[id] ?? id)
}

// A kind id this version does not know (a file from a newer one) is drawn as a step, so the element
// is still there and can still be connected.
export function stencilKind(id: string | undefined): StencilKind {
  return BY_ID.get(currentKindId(id) ?? '') ?? (BY_ID.get(DEFAULT_STENCIL_KIND) as StencilKind)
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
  small = false,
  mark: StencilMark | undefined = kind.mark,
  doubled: boolean | undefined = kind.doubleBorder
): { x: number; y: number; size: number } {
  if (kind.shape === 'arrow') {
    const size = small ? height * 0.62 : ARROW_MARK.size
    const margin = small ? 2.5 : ARROW_MARK.margin
    return { x: width - margin - size, y: (height - size) / 2, size }
  }
  const size =
    Math.min(width, height) * (doubled ? 0.42 : 0.46) * (mark ? (MARK_SCALE[mark] ?? 1) : 1)
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

// The colours a kind's defaults have in the light theme, as final colours and not stored ones: a stored
// colour is flipped in lightness for the light theme, and a warm pale one cannot be stored in a form
// that flips back to itself. Only where the style has no colour of its own.
export function stencilLightColors(
  id: string | undefined,
  style: NodeStyle | undefined
): { fill?: string; stroke?: string } {
  const { light } = stencilKind(id)
  return {
    ...(light?.fill && !style?.fill ? { fill: light.fill } : {}),
    ...(light?.stroke && !style?.stroke ? { stroke: light.stroke } : {})
  }
}

// The style a stencil is drawn with: its own, with the kind's default colours where it has none (in
// the stored form, the dark-theme colour; the light theme takes `stencilLightColors` instead).
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
