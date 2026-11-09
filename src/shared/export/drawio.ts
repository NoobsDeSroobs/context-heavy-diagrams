import type { DiagramFile, DiagramNode, IconRef, IconSlot, MarkerKind } from '../diagram/index.ts'
import { buildBendablePath } from '../geometry/bendablePath.ts'
import { flattenPath } from '../geometry/pathSampling.ts'
import { highlightId, matchingHighlights } from '../tagging/highlights.ts'
import { styledNodeType } from '../styling/styleDefaults.ts'
import type { Theme } from '../styling/theme.ts'
import {
  DEFAULT_FONT_FAMILY,
  PAGE_TOKENS,
  resolveBoxLook,
  resolveEdgeLabelLook,
  resolveEdgeLook,
  resolveLabelLook,
  resolveLineNodeLook,
  type LabelLook,
  type LineLook,
  type Paint
} from './appearance.ts'
import { iconKey, type IconAsset } from './renderDiagram.ts'
import { layoutEdges, layoutNodes, orientEdges, type LaidOutNode } from './model.ts'

// draw.io (diagrams.net) export: a diagram turned into the mxGraph XML of a `.drawio` file by a pure
// function, so the app and `chd export` produce the same file (ADR 0167). The file is plain,
// uncompressed XML with one cell per line, so it diffs and opens in draw.io, in its desktop app and
// in anything else that reads the format. Everything is deterministic: the same inputs give the same
// bytes.
//
// draw.io has no equivalent for some things this app has, so the result carries `notes`: one line
// per kind of thing that was dropped or only approximated, for the caller to show the person.

export interface DrawioExportOptions {
  theme: Theme
  // Highlights (ADR 0025) are session state, so they are off unless named here, by highlightId.
  enabledHighlightIds?: string[]
  // Icons by iconKey; an icon missing from here is left out.
  icons: Map<string, IconAsset>
  // Falls back to the diagram's own font, then the app's page font.
  fontFamily?: string
  // The name of the page in draw.io.
  title?: string
}

export interface DrawioExport {
  xml: string
  notes: string[]
}

export const DEFAULT_DRAWIO_EXPORT_OPTIONS = { theme: 'light' } as const

const ICON_SIZE = 18

// ---- output helpers -------------------------------------------------------------------------

// XML 1.0 forbids most control characters, even escaped (tab, newline and carriage return are fine).
function withoutInvalidXml(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) as number
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue
    out += char
  }
  return out
}

function esc(text: string): string {
  return withoutInvalidXml(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#xa;')
}

function num(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

// A label is HTML in draw.io (the cells are `html=1`), so text typed as plain text is escaped as
// HTML and its line breaks become <br>.
function labelHtml(text: string): string {
  return withoutInvalidXml(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>')
}

function toBase64(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// A style string is `key=value;key=value`, so a value must not hold `;` or `=`.
function styleOf(
  parts: Array<[string, string | number | undefined]>,
  flags: string[] = []
): string {
  const pairs = parts
    .filter((p): p is [string, string | number] => p[1] !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'number' ? num(value) : value}`)
  return [...flags, ...pairs].join(';') + ';'
}

// ---- appearance → draw.io style ---------------------------------------------------------------

// draw.io wants #rrggbb or `none`; the opacity of a paint goes in its own key.
function colorOf(paint: Paint | null): string {
  return paint ? paint.color : 'none'
}

function opacityPercent(paint: Paint | null): number | undefined {
  return paint && paint.opacity < 1 ? Math.round(paint.opacity * 100) : undefined
}

// The CSS font stack as written, so a font that is not installed falls back the way it does in the
// app instead of to the browser's serif default; `;` and `=` would end the style value.
function fontStack(family: string): string {
  return family.replace(/[;=]/g, '')
}

function fontParts(look: LabelLook): Array<[string, string | number | undefined]> {
  return [
    ['fontSize', look.font.size],
    ['fontColor', look.fill.color],
    ['textOpacity', opacityPercent(look.fill)],
    ['fontFamily', fontStack(look.font.family ?? DEFAULT_FONT_FAMILY)],
    ['fontStyle', look.font.weight === 'bold' ? 1 : undefined]
  ]
}

const ALIGN = { start: 'left', center: 'center', end: 'right' } as const

const ARROWS: Record<Exclude<MarkerKind, 'none'>, { arrow: string; fill: 0 | 1 | undefined }> = {
  arrowOpen: { arrow: 'open', fill: 0 },
  arrowClosed: { arrow: 'block', fill: 1 },
  circle: { arrow: 'oval', fill: 0 },
  circleFilled: { arrow: 'oval', fill: 1 },
  diamond: { arrow: 'diamond', fill: 0 },
  diamondFilled: { arrow: 'diamond', fill: 1 },
  crowsFootOne: { arrow: 'ERone', fill: undefined },
  crowsFootMany: { arrow: 'ERmany', fill: undefined },
  crowsFootOneOrMany: { arrow: 'ERoneToMany', fill: undefined },
  crowsFootZeroOrOne: { arrow: 'ERzeroToOne', fill: undefined },
  crowsFootZeroOrMany: { arrow: 'ERzeroToMany', fill: undefined }
}

function arrowParts(
  look: Pick<LineLook, 'startMarker' | 'endMarker'>
): Array<[string, string | number | undefined]> {
  const one = (
    marker: MarkerKind,
    side: 'start' | 'end'
  ): Array<[string, string | number | undefined]> => {
    if (marker === 'none') return [[`${side}Arrow`, 'none']]
    const { arrow, fill } = ARROWS[marker]
    return [
      [`${side}Arrow`, arrow],
      [`${side}Fill`, fill]
    ]
  }
  return [...one(look.startMarker, 'start'), ...one(look.endMarker, 'end')]
}

// The stroke of a line. A dash is drawn at the length it has on the canvas, so the pattern is not
// scaled by the line's width (`fixDash`).
function strokeParts(look: LineLook): Array<[string, string | number | undefined]> {
  return [
    ['strokeColor', look.stroke.color],
    ['strokeOpacity', opacityPercent(look.stroke)],
    ['strokeWidth', look.strokeWidth],
    ['dashed', look.dasharray ? 1 : undefined],
    ['fixDash', look.dasharray ? 1 : undefined],
    ['dashPattern', look.dasharray]
  ]
}

// ---- ids and tags ---------------------------------------------------------------------------------

class CellIds {
  private used = new Set<string>(['0', '1'])

  take(wanted: string): string {
    let id = wanted === '' ? 'cell' : wanted
    while (this.used.has(id)) id = `${id}_`
    this.used.add(id)
    return id
  }
}

// An attribute name of an <object>: a valid XML name, and not one draw.io reads itself.
const RESERVED = new Set(['label', 'id', 'placeholders', 'link', 'tooltip'])

function attributeName(key: string, taken: Set<string>): string {
  let name = key.replace(/[^A-Za-z0-9_.-]/g, '_')
  if (!/^[A-Za-z_]/.test(name)) name = `_${name}`
  if (RESERVED.has(name)) name = `tag_${name}`
  while (taken.has(name)) name += '_'
  taken.add(name)
  return name
}

function tagValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'string'
    ? value
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
}

// ---- the export ---------------------------------------------------------------------------------

interface Cell {
  z: number
  layer: 0 | 1
  order: number
  xml: string
}

export function renderDiagramDrawio(
  diagram: DiagramFile,
  options: DrawioExportOptions
): DrawioExport {
  const theme = options.theme
  const tokens = PAGE_TOKENS[theme]
  const family = options.fontFamily ?? diagram.fontFamily ?? DEFAULT_FONT_FAMILY
  const enabled = new Set(options.enabledHighlightIds ?? [])
  const highlights = diagram.highlights ?? []

  const nodes = layoutNodes(diagram)
  const oriented = orientEdges(diagram)
  const edges = layoutEdges(oriented, nodes)
  const ids = new CellIds()
  const cellIdOfNode = new Map<string, string>()
  for (const id of nodes.keys()) cellIdOfNode.set(id, ids.take(id))

  // What could not be carried over, counted for the notes.
  const lost = {
    extraConnectionPoints: 0,
    approximatedRoutes: 0,
    pulse: 0,
    chips: 0,
    notes: 0,
    linkedDiagrams: 0,
    references: 0,
    missingEnds: oriented.length - edges.length,
    shortLines: 0,
    lockedTags: 0
  }

  // A node's parent cell: its container, unless that is missing or part of a cycle, when the node
  // is drawn at its absolute position on the page.
  const parentOf = (node: DiagramNode): LaidOutNode | null => {
    const seen = new Set<string>([node.id])
    let id = node.parentId
    while (id) {
      if (seen.has(id)) return null
      const parent = nodes.get(id)
      if (!parent) return null
      seen.add(id)
      id = parent.node.parentId
    }
    return node.parentId ? (nodes.get(node.parentId) ?? null) : null
  }

  const cells: Cell[] = []

  // -- nodes
  for (const laid of nodes.values()) {
    const { node, kind, x, y, width, height } = laid
    const cellId = cellIdOfNode.get(node.id) as string
    const parent = parentOf(node)
    const parentId = parent ? (cellIdOfNode.get(parent.node.id) as string) : '1'
    const at = parent ? { x: x - parent.x, y: y - parent.y } : { x, y }

    if (node.data.notes) lost.notes += 1
    if (node.data.linkedDiagram) lost.linkedDiagrams += 1
    if ((node.data.references ?? []).length > 0) lost.references += 1
    if ((node.connectionPoints ?? []).length > 0) lost.extraConnectionPoints += 1

    if (kind === 'line') {
      const look = resolveLineNodeLook(node.style, theme)
      const d = buildBendablePath(node.data.points ?? [])
      const flat = d ? flattenPath(d) : []
      const points = (node.data.points ?? []).map((p) => ({ x: x + p.x, y: y + p.y }))
      if (points.length < 2 || flat.length === 0) {
        lost.shortLines += 1
        continue
      }
      const style = styleOf(
        [['html', 1], ['curved', 1], ...strokeParts(look), ...arrowParts(look)],
        []
      )
      const inner = points.slice(1, -1)
      cells.push({
        z: laid.z,
        layer: 1,
        order: laid.order,
        xml:
          `<mxCell id="${esc(cellId)}" value="" style="${esc(style)}" edge="1" parent="1">` +
          `<mxGeometry relative="1" as="geometry">` +
          `<mxPoint x="${num(points[0].x)}" y="${num(points[0].y)}" as="sourcePoint"/>` +
          `<mxPoint x="${num(points[points.length - 1].x)}" y="${num(points[points.length - 1].y)}" as="targetPoint"/>` +
          (inner.length > 0
            ? `<Array as="points">${inner.map((p) => `<mxPoint x="${num(p.x)}" y="${num(p.y)}"/>`).join('')}</Array>`
            : '') +
          `</mxGeometry></mxCell>`
      })
      continue
    }

    const matches = matchingHighlights(node.metadata, highlights, enabled)
    if (matches.length >= 2) lost.chips += 1
    const type = styledNodeType(node.type)
    const look = resolveBoxLook(
      type,
      node.style,
      theme,
      matches.length === 1 ? matches[0] : undefined
    )
    const labelLook = resolveLabelLook(type, node.style, theme, family)
    const rotation = kind === 'text' ? (node.rotation ?? 0) : 0
    const style = styleOf(
      [
        ['rounded', kind === 'text' ? 0 : 1],
        ['absoluteArcSize', kind === 'text' ? undefined : 1],
        ['arcSize', kind === 'text' ? undefined : 12],
        ['whiteSpace', 'wrap'],
        ['html', 1],
        ['fillColor', colorOf(look.fill)],
        ['fillOpacity', opacityPercent(look.fill)],
        ['strokeColor', colorOf(look.stroke)],
        ['strokeOpacity', opacityPercent(look.stroke)],
        ['strokeWidth', look.stroke ? look.strokeWidth : undefined],
        ['dashed', look.stroke && look.dashed ? 1 : undefined],
        ['dashPattern', look.stroke && look.dashed ? '3 2' : undefined],
        ...fontParts(labelLook),
        ['align', ALIGN[labelLook.align]],
        ['verticalAlign', kind === 'container' ? 'top' : 'middle'],
        ['spacingLeft', kind === 'container' ? 8 : undefined],
        ['spacingTop', kind === 'container' ? 4 : undefined],
        ['container', kind === 'container' ? 1 : undefined],
        ['collapsible', kind === 'container' ? 0 : undefined],
        ['rotation', rotation % 360 !== 0 ? rotation : undefined]
      ],
      kind === 'text' ? ['text'] : []
    )

    const geometry = `<mxGeometry x="${num(at.x)}" y="${num(at.y)}" width="${num(width)}" height="${num(height)}" as="geometry"/>`
    const label = labelHtml(node.data.label ?? '')
    const entries = Object.entries(node.metadata ?? {})
    for (const [, entry] of entries) if (entry.lock) lost.lockedTags += 1
    let xml: string
    if (entries.length > 0) {
      const taken = new Set<string>(RESERVED)
      const attributes = entries
        .map(([key, entry]) => ` ${attributeName(key, taken)}="${esc(tagValue(entry.value))}"`)
        .join('')
      xml =
        `<object label="${esc(label)}" id="${esc(cellId)}"${attributes}>` +
        `<mxCell style="${esc(style)}" vertex="1" parent="${esc(parentId)}">${geometry}</mxCell></object>`
    } else {
      xml = `<mxCell id="${esc(cellId)}" value="${esc(label)}" style="${esc(style)}" vertex="1" parent="${esc(parentId)}">${geometry}</mxCell>`
    }
    cells.push({ z: laid.z, layer: 1, order: laid.order, xml })

    // Icons are image cells inside the node, so they move with it.
    if (kind === 'entity') {
      const ink = tokens.text.color
      for (const [slot, icon] of Object.entries(node.data.icons ?? {}) as [IconSlot, IconRef][]) {
        const asset = icon && options.icons.get(iconKey(icon))
        const image = asset ? imageOf(asset, ink) : null
        if (!image) continue
        const border = look.strokeWidth
        const left = slot === 'topLeft' || slot === 'bottomLeft'
        const top = slot === 'topLeft' || slot === 'topRight'
        const ix = left ? border + 2 : width - border - 2 - ICON_SIZE
        const iy = top ? border + 2 : height - border - 2 - ICON_SIZE
        const iconId = ids.take(`${node.id}-icon-${slot}`)
        cells.push({
          z: laid.z,
          layer: 1,
          order: laid.order + 0.5,
          xml:
            `<mxCell id="${esc(iconId)}" value="" style="${esc(
              styleOf([
                ['shape', 'image'],
                ['aspect', 'fixed'],
                ['image', image]
              ])
            )}" vertex="1" parent="${esc(cellId)}">` +
            `<mxGeometry x="${num(ix)}" y="${num(iy)}" width="${ICON_SIZE}" height="${ICON_SIZE}" as="geometry"/></mxCell>`
        })
      }
    }
  }

  // -- edges
  for (const laid of edges) {
    const { edge, from, to } = laid
    const source = nodes.get(edge.source) as LaidOutNode
    const target = nodes.get(edge.target) as LaidOutNode
    const cellId = ids.take(edge.id)
    const matches = matchingHighlights(edge.metadata, highlights, enabled)
    if (matches.length >= 2) lost.chips += 1
    const look = resolveEdgeLook(edge.style, theme, matches.length === 1 ? matches[0] : undefined)
    const labelLook = resolveEdgeLabelLook(edge.style, theme, family)
    const routing = edge.style?.routingStyle
    if (routing !== 'straight') lost.approximatedRoutes += 1
    if (edge.style?.animation === 'pulse') lost.pulse += 1

    // Where the line meets each node, as a fraction of the node's box: draw.io keeps this on the
    // edge, so an edge keeps its exact attachment point even though the node does not list it.
    const fraction = (
      end: { x: number; y: number },
      box: LaidOutNode,
      name: 'exit' | 'entry'
    ): Array<[string, number]> => [
      [`${name}X`, (end.x - box.x) / box.width],
      [`${name}Y`, (end.y - box.y) / box.height],
      [`${name}Dx`, 0],
      [`${name}Dy`, 0],
      [`${name}Perimeter`, 0]
    ]

    const style = styleOf([
      ['html', 1],
      ...edgeRouting(routing),
      ...fraction(from, source, 'exit'),
      ...fraction(to, target, 'entry'),
      ...strokeParts(look),
      ...arrowParts(look),
      ['flowAnimation', edge.style?.animation === 'flow' ? 1 : undefined],
      ...fontParts(labelLook),
      ['labelBackgroundColor', tokens.soft],
      ['labelBorderColor', tokens.border]
    ])
    // The label sits at a fraction of the line's length; draw.io places it from -1 (source) to 1.
    const position = (edge.style?.labelPosition ?? 0.5) * 2 - 1
    const waypoints = (edge.points ?? []).map((p) => `<mxPoint x="${num(p.x)}" y="${num(p.y)}"/>`)
    const geometry =
      `<mxGeometry x="${num(position)}" relative="1" as="geometry">` +
      (waypoints.length > 0 ? `<Array as="points">${waypoints.join('')}</Array>` : '') +
      `</mxGeometry>`
    const label = labelHtml(edge.label ?? '')
    const entries = Object.entries(edge.metadata ?? {})
    for (const [, entry] of entries) if (entry.lock) lost.lockedTags += 1
    const attrs = `style="${esc(style)}" edge="1" parent="1" source="${esc(cellIdOfNode.get(edge.source) as string)}" target="${esc(cellIdOfNode.get(edge.target) as string)}"`
    let xml: string
    if (entries.length > 0) {
      const taken = new Set<string>(RESERVED)
      const attributes = entries
        .map(([key, entry]) => ` ${attributeName(key, taken)}="${esc(tagValue(entry.value))}"`)
        .join('')
      xml = `<object label="${esc(label)}" id="${esc(cellId)}"${attributes}><mxCell ${attrs}>${geometry}</mxCell></object>`
    } else {
      xml = `<mxCell id="${esc(cellId)}" value="${esc(label)}" ${attrs}>${geometry}</mxCell>`
    }
    cells.push({ z: laid.z, layer: 0, order: laid.order, xml })
  }

  // Paint order is the order in the file: ascending z, an edge below a node of equal z.
  cells.sort((a, b) => a.z - b.z || a.layer - b.layer || a.order - b.order)

  const background = theme === 'dark' ? ` background="${tokens.background}"` : ''
  const xml =
    '<mxfile host="Context-Heavy Diagrams">\n' +
    `  <diagram id="chd" name="${esc(options.title ?? 'Page-1')}">\n` +
    `    <mxGraphModel grid="0" page="0" math="0" shadow="0"${background}>\n` +
    '      <root>\n' +
    '        <mxCell id="0"/>\n' +
    '        <mxCell id="1" parent="0"/>\n' +
    cells.map((c) => `        ${c.xml}\n`).join('') +
    '      </root>\n' +
    '    </mxGraphModel>\n' +
    '  </diagram>\n' +
    '</mxfile>\n'

  return { xml, notes: notesFor(diagram, lost, enabled) }
}

// How draw.io is told to route an edge. Its curved connector is the closest to the canvas's default
// (a curve that leaves each connection point sideways), so the default and the Catmull-Rom spline
// both use it.
function edgeRouting(
  routing: 'straight' | 'step' | 'smoothstep' | 'catmullRom' | undefined
): Array<[string, string | number | undefined]> {
  switch (routing) {
    case 'straight':
      return []
    case 'step':
      return [
        ['edgeStyle', 'orthogonalEdgeStyle'],
        ['rounded', 0]
      ]
    case 'smoothstep':
      return [
        ['edgeStyle', 'orthogonalEdgeStyle'],
        ['rounded', 1]
      ]
    default:
      return [
        ['edgeStyle', 'orthogonalEdgeStyle'],
        ['curved', 1]
      ]
  }
}

// A draw.io image cell takes its picture as `data:image/<type>,<base64>`: the `;base64` of a normal
// data URL would end the style value.
function imageOf(asset: IconAsset, ink: string): string | null {
  if (asset.kind === 'image') {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(asset.dataUrl)
    return match ? `data:${match[1]},${match[2]}` : null
  }
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(asset.markup)?.[1]
  if (inner === undefined) return null
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ink}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner.replace(/currentColor/g, ink)}</svg>`
  return `data:image/svg+xml,${toBase64(svg)}`
}

interface Lost {
  extraConnectionPoints: number
  approximatedRoutes: number
  pulse: number
  chips: number
  notes: number
  linkedDiagrams: number
  references: number
  missingEnds: number
  shortLines: number
  lockedTags: number
}

function notesFor(diagram: DiagramFile, lost: Lost, enabled: Set<string>): string[] {
  const out: string[] = []
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
  if (lost.missingEnds > 0)
    out.push(
      `${plural(lost.missingEnds, 'connection was', 'connections were')} left out: an end is missing`
    )
  if (lost.shortLines > 0)
    out.push(`${plural(lost.shortLines, 'line was', 'lines were')} left out: fewer than two points`)
  if (lost.approximatedRoutes > 0)
    out.push(
      `${plural(lost.approximatedRoutes, 'connection', 'connections')} drawn with draw.io's own routing, so the exact path differs`
    )
  if (lost.extraConnectionPoints > 0)
    out.push(
      `${plural(lost.extraConnectionPoints, 'element has', 'elements have')} extra connection points: each connection keeps its exact attachment, but draw.io does not offer them on the element`
    )
  if (lost.pulse > 0)
    out.push(
      `${plural(lost.pulse, 'connection has', 'connections have')} a pulse animation, which draw.io lacks`
    )
  if (lost.chips > 0)
    out.push(
      `${plural(lost.chips, 'element matches', 'elements match')} several highlights; draw.io shows no highlight chips`
    )
  if (lost.notes > 0)
    out.push(
      `${plural(lost.notes, 'note', 'notes')} not exported (they are separate Markdown files)`
    )
  if (lost.linkedDiagrams > 0)
    out.push(
      `${plural(lost.linkedDiagrams, 'link to another diagram', 'links to other diagrams')} not exported`
    )
  if (lost.references > 0)
    out.push(`reference images on ${plural(lost.references, 'element', 'elements')} not exported`)
  if (lost.lockedTags > 0)
    out.push(
      `${plural(lost.lockedTags, 'locked tag', 'locked tags')} exported as plain data: draw.io does not enforce locks`
    )
  const legendRows =
    (diagram.legend ?? []).length +
    (diagram.highlights ?? []).filter((h) => enabled.has(highlightId(h))).length
  if (legendRows > 0) out.push('the legend is not exported')
  if (diagram.security) out.push('the threat matrix is not exported')
  return out
}
