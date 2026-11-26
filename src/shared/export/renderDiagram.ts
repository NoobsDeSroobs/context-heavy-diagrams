import type { DiagramFile, IconRef, IconSlot, MarkerKind } from '../diagram/index.ts'
import { buildEdgePath } from '../geometry/edgePath.ts'
import { buildBendablePath } from '../geometry/bendablePath.ts'
import { flattenPath, pointAtRatio, type Point } from '../geometry/pathSampling.ts'
import { highlightId, matchingHighlights } from '../tagging/highlights.ts'
import { styledNodeType } from '../styling/styleDefaults.ts'
import {
  edgeCrossing,
  GATE_HALF,
  GATE_WIDTH,
  GATE_COLOR,
  gatesOnPath
} from '../crossings/crossings.ts'
import {
  containerLabelPlace,
  containerLabelRoom,
  containerLabelSideOf,
  containerLabelTurn
} from '../nodes/containerLabel.ts'
import {
  labelAlign,
  labelBox,
  LABEL_GAP,
  labelPositionOf,
  leaderLine,
  offsetOf
} from '../stencils/labelPlacement.ts'
import {
  arrowBandPath,
  DOUBLE_BORDER_GAP,
  HEAVY_BORDER_FACTOR,
  MARK_STROKE,
  STENCIL_MARK_PATHS,
  STENCIL_MARK_SOLID,
  stencilDoubleBorder,
  stencilMarkOf,
  stencilSolid,
  type StencilState,
  type StencilMark,
  stencilKind,
  stencilLabelInsets,
  stencilLabelOutside,
  stencilMarkBox,
  stencilStyle,
  type StencilKind
} from '../stencils/kinds.ts'
import { STENCIL_SWATCH_SIZE, STENCIL_SWATCH_ZOOM } from '../stencils/swatch.ts'
import { dasharrayOf, dashPattern } from '../styling/edgeDash.ts'
import type { Theme } from '../styling/theme.ts'
import {
  DEFAULT_FONT_FAMILY,
  PAGE_TOKENS,
  resolveBoxLook,
  withStencilLightColors,
  resolveEdgeLabelLook,
  resolveEdgeLook,
  resolveLabelLook,
  resolveLineNodeLook,
  type BoxLook,
  type LabelLook,
  type LineLook,
  type Paint
} from './appearance.ts'
import { MARKER_SHAPES, MARKER_STROKE_WIDTH, markerTrim } from './markerShapes.ts'
import { trimPath } from '../geometry/trimPath.ts'
import {
  PORTAL_COLOR,
  PORTAL_MARK_WIDTH,
  PORTAL_OVAL,
  PORTAL_TILDE_PATH,
  markTransform,
  numberPoint,
  portalNumbers,
  readPortal,
  splitPath,
  type PortalMarkKind,
  type PortalSplit
} from '../portals/portals.ts'
import { plainColor } from './color.ts'
import { iconParts } from './iconMarkup.ts'
import {
  buildExportLegendItems,
  stencilLegendRows,
  directionSetLegendRow,
  type ExportLegendItem
} from '../legend/legendItems.ts'
import { placeLegend, type LegendCorner, type Rect } from '../legend/legendPlacement.ts'
import { layoutEdges, layoutNodes, orientEdges, type LaidOutNode } from './model.ts'
import { LINE_HEIGHT_EM, measureText, wrapText, type FontSpec } from './textLayout.ts'

// SVG export (ADR 0124): a diagram file turned into native SVG elements by a pure function, so the
// app and the `chd export` command produce the same image and neither needs a display. Everything
// here is deterministic: the same inputs give the same bytes.

// A resolved icon. A pack's icon (the built-in Tabler ones too) is markup the app has already
// cleaned (ADR 0188) and is drawn inline as vector; a custom icon is a data URL drawn as an <image>
// and never inlined, since a user-supplied SVG may contain script.
export type IconAsset = { kind: 'svg'; markup: string } | { kind: 'image'; dataUrl: string }

export function iconKey(icon: IconRef): string {
  if (icon.source === 'builtin') return `b:${icon.id}`
  return icon.source === 'custom' ? `c:${icon.path}` : `i:${icon.pack}:${icon.path}`
}

export interface SvgExportOptions {
  theme: Theme
  // Margin around the diagram's drawn extent, in pixels.
  paddingPx: number
  // 'transparent', 'theme' (the page colour of the chosen theme) or an explicit colour.
  background: 'transparent' | 'theme' | { color: string }
  // The legend is added when there are items. Corner as in the PNG export.
  legend?: { items: ExportLegendItem[]; corner: LegendCorner }
  // Highlights (ADR 0025) are session state, so they are off unless named here, by highlightId.
  enabledHighlightIds?: string[]
  // The global edgeStraightSegmentLength preference.
  edgeStraightSegmentLength: number
  // Icons by iconKey; an icon missing from here is left out.
  icons: Map<string, IconAsset>
  // Falls back to the diagram's own font, then the app's page font.
  fontFamily?: string
  // Written as the document <title>, for accessibility.
  title?: string
  // A gate where an edge goes through the border of a container. Off unless named here, as
  // on the canvas, where it is a session switch.
  crossings?: boolean
  // How a portal's gap is marked, as on the canvas (the person's preference); a tilde when absent.
  portalMark?: PortalMarkKind
}

export const DEFAULT_SVG_EXPORT_OPTIONS = {
  theme: 'light',
  paddingPx: 24,
  background: 'theme',
  edgeStraightSegmentLength: 8
} as const

// The legend a diagram carries by itself: its own entries and the active direction set's row, plus
// a row for each highlight named in `enabledHighlightIds`.
export function defaultLegendItems(
  diagram: DiagramFile,
  enabledHighlightIds: string[] = []
): ExportLegendItem[] {
  const sets = diagram.edgeDirectionSets ?? []
  return buildExportLegendItems(
    diagram.legend ?? [],
    diagram.highlights ?? [],
    new Set(enabledHighlightIds),
    directionSetLegendRow(sets, diagram.activeEdgeDirectionSetId),
    stencilLegendRows(diagram.nodes)
  )
}

// Every icon the export may draw: the nodes' slots and the legend's icon rows.
export function collectIconRefs(diagram: DiagramFile, legendItems: ExportLegendItem[]): IconRef[] {
  const found = new Map<string, IconRef>()
  for (const node of diagram.nodes) {
    for (const icon of Object.values(node.data.icons ?? {})) {
      if (icon) found.set(iconKey(icon), icon)
    }
  }
  for (const item of legendItems) {
    if (item.swatch.kind === 'icon') found.set(iconKey(item.swatch.icon), item.swatch.icon)
  }
  return [...found.values()]
}

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
}

function num(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function paintAttrs(name: 'fill' | 'stroke', paint: Paint | null): string {
  if (!paint) return ` ${name}="none"`
  return ` ${name}="${esc(paint.color)}"${paint.opacity < 1 ? ` ${name}-opacity="${num(paint.opacity)}"` : ''}`
}

// A stencil's base shape with its mark on it, drawn as vector shapes. `small` is the
// legend swatch: the arrow's band is narrower and the mark's line is a fixed 1.2 px.
function stencilShape(
  kind: StencilKind,
  box: Rect,
  look: BoxLook,
  strokeWidth: number,
  markPaint: Paint,
  small = false,
  ending?: StencilState,
  // A legend swatch drawn larger (LEGEND_STENCIL_ZOOM): its fixed small-size details grow with it.
  zoom = 1
): string {
  const { x, y, width, height } = box
  const inset = look.stroke ? strokeWidth / 2 : 0
  // An end that stops the whole flow is a solid disc: the border colour fills it, the mark is cut out.
  const solid = stencilSolid(kind, ending) && look.stroke !== null
  const mark: StencilMark | undefined = stencilMarkOf(kind, ending)
  const cutOut = solid ? (look.fill ?? markPaint) : markPaint
  const paint =
    paintAttrs('fill', solid ? look.stroke : look.fill) +
    paintAttrs('stroke', look.stroke) +
    (look.stroke ? ` stroke-width="${num(strokeWidth)}"` : '')
  const cx = x + width / 2
  const cy = y + height / 2
  const radius = Math.max(0, Math.min(width, height) / 2 - inset)
  let out =
    kind.shape === 'circle'
      ? `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}"${paint}/>`
      : `<rect x="${num(x + inset)}" y="${num(y + inset)}" width="${num(width - inset * 2)}" height="${num(height - inset * 2)}" rx="4"${paint}/>`
  const doubled = stencilDoubleBorder(kind, ending)
  if (kind.shape === 'circle' && doubled && look.stroke) {
    const inner = Math.max(0, radius - strokeWidth - (small ? 1.5 * zoom : DOUBLE_BORDER_GAP))
    out += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(inner)}" fill="none"${paintAttrs('stroke', look.stroke)} stroke-width="${num(strokeWidth)}"/>`
  }
  if (kind.shape === 'arrow') {
    // The band takes the colour of the border (of the mark where the border is switched off).
    const band = arrowBandPath(x + inset, y + inset, y + height - inset, 4, small ? 0.35 * zoom : 1)
    out += `<path d="${band}"${paintAttrs('fill', look.stroke ?? markPaint)}/>`
  }
  if (!mark) return out
  const at = stencilMarkBox(kind, width, height, small, mark, doubled)
  const scale = Math.round((at.size / 24) * 10000) / 10000
  const line = small ? (1.2 * zoom) / scale : MARK_STROKE
  return (
    out +
    `<g transform="translate(${num(x + at.x)} ${num(y + at.y)}) scale(${scale})">` +
    `<path d="${STENCIL_MARK_PATHS[mark]}"${paintAttrs('fill', STENCIL_MARK_SOLID.has(mark) ? cutOut : null)}${paintAttrs('stroke', cutOut)} stroke-width="${num(line)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  )
}

// ---- arrowheads ------------------------------------------------------------------------------

// The end markers drawn as ordinary shapes placed at the end of the line, not as SVG
// <marker> elements: editors such as Affinity Designer ignore markers or lose their orientation, and
// the canvas's `context-stroke` is SVG 2. A shape is scaled by the stroke width and turned to the
// line's direction, as a marker with markerUnits="strokeWidth" and orient="auto" would be.
function arrowhead(
  kind: MarkerKind,
  at: Point,
  angleDegrees: number,
  stroke: Paint,
  strokeWidth: number
): string {
  if (kind === 'none') return ''
  const shape = MARKER_SHAPES[kind]
  const [, , viewWidth, viewHeight] = shape.viewBox.split(' ').map(Number)
  const scale =
    Math.min(shape.markerWidth / viewWidth, shape.markerHeight / viewHeight) * strokeWidth
  const body = shape.elements
    .map((el) => {
      const own = el.filled
        ? `${paintAttrs('fill', stroke)} stroke="none"`
        : `fill="none"${paintAttrs('stroke', stroke)} stroke-width="${MARKER_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`
      return el.tag === 'path'
        ? `<path d="${el.d}" ${own}/>`
        : `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" ${own}/>`
    })
    .join('')
  return `<g class="chd-arrowhead" transform="translate(${num(at.x)} ${num(at.y)}) rotate(${num(angleDegrees)}) scale(${num(scale)}) translate(${-shape.refX} ${-shape.refY})">${body}</g>`
}

// The direction a path leaves its first point and arrives at its last, from the flattened path.
function endAngles(d: string): { start: number; end: number } | null {
  const points = flattenPath(d)
  const distinct = (a: Point, b: Point): boolean => Math.hypot(a.x - b.x, a.y - b.y) > 0.001
  const last = points[points.length - 1]
  const first = points[0]
  const beforeLast = [...points].reverse().find((p) => distinct(p, last))
  const afterFirst = points.find((p) => distinct(p, first))
  if (!beforeLast || !afterFirst) return null
  const degrees = (from: Point, to: Point): number =>
    (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return {
    // A start marker points back out of the line, the way orient="auto-start-reverse" turns it.
    start: degrees(first, afterFirst) + 180,
    end: degrees(beforeLast, last)
  }
}

// The path a line is stroked along: `d` stopped short of the tip of a pointed head, which is drawn
// at the end of `d` itself.
function strokedPath(d: string, look: LineLook): string {
  return trimPath(
    d,
    markerTrim(look.startMarker, look.strokeWidth),
    markerTrim(look.endMarker, look.strokeWidth)
  )
}

// The start and end markers of a line along path `d`, as shapes.
function arrowheadsFor(d: string, look: LineLook): string {
  if (look.startMarker === 'none' && look.endMarker === 'none') return ''
  const angles = endAngles(d)
  if (!angles) return ''
  const points = flattenPath(d)
  return (
    arrowhead(look.startMarker, points[0], angles.start, look.stroke, look.strokeWidth) +
    arrowhead(look.endMarker, points[points.length - 1], angles.end, look.stroke, look.strokeWidth)
  )
}

// ---- text -----------------------------------------------------------------------------------

function fontAttrs(font: FontSpec, fill: Paint): string {
  return (
    `font-family="${esc(font.family ?? DEFAULT_FONT_FAMILY)}" font-size="${num(font.size)}"` +
    (font.weight === 'bold' ? ' font-weight="bold"' : '') +
    paintAttrs('fill', fill)
  )
}

// Lines inside a block whose left edge is `left` and whose width is `blockWidth`, aligned within it
// the way CSS text-align does. `top` is the block's top edge.
function textLines(
  lines: string[],
  look: LabelLook,
  left: number,
  blockWidth: number,
  top: number
): string {
  if (lines.every((line) => line === '')) return ''
  const lineHeight = look.font.size * LINE_HEIGHT_EM
  const anchorX =
    look.align === 'center'
      ? left + blockWidth / 2
      : look.align === 'end'
        ? left + blockWidth
        : left
  const anchor = look.align === 'center' ? 'middle' : look.align === 'end' ? 'end' : 'start'
  const spans = lines
    .map((line, i) => {
      // Baseline of a line box: its middle plus a third of the font size (the middle of the
      // x-height sits slightly below the middle of the em box).
      const y = top + (i + 0.5) * lineHeight + 0.32 * look.font.size
      return `<tspan x="${num(anchorX)}" y="${num(y)}">${esc(line)}</tspan>`
    })
    .join('')
  return `<text ${fontAttrs(look.font, look.fill)} text-anchor="${anchor}">${spans}</text>`
}

function blockWidthOf(lines: string[], font: FontSpec): number {
  return Math.max(0, ...lines.map((line) => measureText(line, font)))
}

// ---- icons ----------------------------------------------------------------------------------

const ICON_SIZE = 18

// A pack's icon is drawn as a nested <svg> with its own viewBox and the colours it sets; a shape in
// `currentColor` takes the text colour of the export (ADR 0188).
function iconElement(asset: IconAsset, x: number, y: number, size: number, ink: Paint): string {
  if (asset.kind === 'image') {
    if (!/^data:image\//i.test(asset.dataUrl)) return ''
    return `<image href="${esc(asset.dataUrl)}" x="${num(x)}" y="${num(y)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
  }
  const parts = iconParts(asset.markup, esc(ink.color))
  if (!parts) return ''
  return `<svg x="${num(x)}" y="${num(y)}" width="${size}" height="${size}" viewBox="${parts.viewBox}" preserveAspectRatio="xMidYMid meet"${parts.attrs}>${parts.inner}</svg>`
}

const SLOT_OFFSET: Record<IconSlot, (box: LaidOutNode, border: number) => Point> = {
  topLeft: (b, border) => ({ x: b.x + border + 2, y: b.y + border + 2 }),
  topRight: (b, border) => ({ x: b.x + b.width - border - 2 - ICON_SIZE, y: b.y + border + 2 }),
  bottomLeft: (b, border) => ({ x: b.x + border + 2, y: b.y + b.height - border - 2 - ICON_SIZE }),
  bottomRight: (b, border) => ({
    x: b.x + b.width - border - 2 - ICON_SIZE,
    y: b.y + b.height - border - 2 - ICON_SIZE
  })
}

// ---- extent ---------------------------------------------------------------------------------

class Extent {
  minX = Infinity
  minY = Infinity
  maxX = -Infinity
  maxY = -Infinity

  add(x: number, y: number, pad = 0): void {
    this.minX = Math.min(this.minX, x - pad)
    this.minY = Math.min(this.minY, y - pad)
    this.maxX = Math.max(this.maxX, x + pad)
    this.maxY = Math.max(this.maxY, y + pad)
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.add(x, y)
    this.add(x + width, y + height)
  }

  get empty(): boolean {
    return this.minX === Infinity
  }

  toRect(): Rect {
    if (this.empty) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: this.minX,
      y: this.minY,
      width: this.maxX - this.minX,
      height: this.maxY - this.minY
    }
  }
}

// ---- the legend -----------------------------------------------------------------------------

const LEGEND_FONT: FontSpec = { size: 12, weight: 'normal' }
const LEGEND_PAD_X = 10
const LEGEND_PAD_Y = 8
const LEGEND_ROW_HEIGHT = 18
const LEGEND_ROW_GAP = 4
const LEGEND_SWATCH_WIDTH = 28
const LEGEND_SWATCH_GAP = 6
const LEGEND_MARGIN = 16

// A legend with a behaviour in it has a wider swatch column and taller rows for the behaviours, so
// their larger swatches fit as they do in the legend panel; one without keeps the plain sizes.
function legendMetrics(items: ExportLegendItem[]): {
  swatchWidth: number
  rowHeights: number[]
} {
  const stencils = items.some((item) => item.swatch.kind === 'stencil')
  return {
    swatchWidth: stencils
      ? Math.max(LEGEND_SWATCH_WIDTH, STENCIL_SWATCH_SIZE.width)
      : LEGEND_SWATCH_WIDTH,
    rowHeights: items.map((item) =>
      item.swatch.kind === 'stencil'
        ? Math.max(LEGEND_ROW_HEIGHT, Math.ceil(STENCIL_SWATCH_SIZE.height) + 2)
        : LEGEND_ROW_HEIGHT
    )
  }
}

function legendSize(items: ExportLegendItem[]): { width: number; height: number } {
  const textWidth = Math.max(0, ...items.map((item) => measureText(item.label, LEGEND_FONT)))
  const { swatchWidth, rowHeights } = legendMetrics(items)
  const rows = rowHeights.reduce((sum, h) => sum + h, 0)
  return {
    width: Math.ceil(LEGEND_PAD_X * 2 + swatchWidth + LEGEND_SWATCH_GAP + textWidth) + 2,
    height: LEGEND_PAD_Y * 2 + rows + (items.length - 1) * LEGEND_ROW_GAP + 2
  }
}

function drawLegend(
  items: ExportLegendItem[],
  at: Point,
  size: { width: number; height: number },
  options: SvgExportOptions
): string {
  const tokens = PAGE_TOKENS[options.theme]
  const parts: string[] = [
    `<rect x="${num(at.x + 0.5)}" y="${num(at.y + 0.5)}" width="${size.width - 1}" height="${size.height - 1}" rx="6" fill="${tokens.soft}" stroke="${tokens.border}"/>`
  ]
  const textLook: LabelLook = { font: LEGEND_FONT, fill: tokens.text, align: 'start' }
  const { swatchWidth, rowHeights } = legendMetrics(items)
  const columnX = at.x + 1 + LEGEND_PAD_X
  let nextRowTop = at.y + 1 + LEGEND_PAD_Y
  items.forEach((item, i) => {
    const rowTop = nextRowTop
    const rowHeight = rowHeights[i]
    nextRowTop += rowHeight + LEGEND_ROW_GAP
    // The plain swatches are 28 wide and sit in the middle of a wider column.
    const swatchX = columnX + (swatchWidth - LEGEND_SWATCH_WIDTH) / 2
    const cy = rowTop + rowHeight / 2
    const { swatch } = item
    if (swatch.kind === 'entity') {
      const paint = plainColor(swatch.color)
      parts.push(
        `<circle cx="${num(swatchX + 14)}" cy="${num(cy)}" r="7"${paintAttrs('fill', paint)}/>`
      )
    } else if (swatch.kind === 'stencil') {
      // The kind's shape and mark in a small box, with the colour it is drawn in on the diagram.
      const sk = stencilKind(swatch.stencilKind)
      const look = withStencilLightColors(
        resolveBoxLook('entity', stencilStyle(sk.id, undefined), options.theme, undefined),
        sk.id,
        undefined,
        options.theme
      )
      const zoom = STENCIL_SWATCH_ZOOM
      const width = (sk.shape === 'arrow' ? 22 : 14) * zoom
      const height = 14 * zoom
      const box = { x: columnX + (swatchWidth - width) / 2, y: cy - height / 2, width, height }
      parts.push(stencilShape(sk, box, look, 1.5 * zoom, tokens.text, true, swatch.state, zoom))
    } else if (swatch.kind === 'highlight') {
      const paint = plainColor(swatch.color)
      parts.push(
        `<rect x="${num(swatchX + 6)}" y="${num(cy - 6)}" width="16" height="12" rx="3"${paintAttrs('fill', paint)}/>`
      )
    } else if (swatch.kind === 'icon') {
      const asset = options.icons.get(iconKey(swatch.icon))
      if (asset) parts.push(iconElement(asset, swatchX + 4, cy - 10, 20, tokens.text))
    } else {
      const paint = plainColor(swatch.color)
      const dash = dasharrayOf(dashPattern(swatch))
      // At most 3 thick, as in the legend panel; the line stops short of a pointed head.
      const width = Math.min(3, Math.max(1, swatch.strokeWidth ?? 2))
      const x1 = swatchX + 2 + markerTrim(swatch.startMarker, width)
      const x2 = swatchX + 26 - markerTrim(swatch.endMarker, width)
      parts.push(
        `<line x1="${num(x1)}" y1="${num(cy)}" x2="${num(x2)}" y2="${num(cy)}"${paintAttrs('stroke', paint)} stroke-width="${num(width)}" stroke-linecap="round"` +
          (dash ? ` stroke-dasharray="${dash}"` : '') +
          '/>',
        arrowhead(swatch.startMarker ?? 'none', { x: swatchX + 2, y: cy }, 180, paint, width),
        arrowhead(swatch.endMarker ?? 'none', { x: swatchX + 26, y: cy }, 0, paint, width)
      )
    }
    parts.push(
      textLines(
        [item.label],
        textLook,
        columnX + swatchWidth + LEGEND_SWATCH_GAP,
        measureText(item.label, LEGEND_FONT),
        rowTop + (rowHeight - LEGEND_FONT.size * LINE_HEIGHT_EM) / 2
      )
    )
  })
  return `<g class="chd-legend">${parts.join('')}</g>`
}

// ---- the diagram ----------------------------------------------------------------------------

const CHIP_RADIUS = 4
const CHIP_GAP = 3

// The small coloured dots shown when two or more highlights match one element (ADR 0025), centred
// on `cx` with their vertical centre at `cy`.
function chips(colors: string[], cx: number, cy: number, ring: string): string {
  const width = colors.length * CHIP_RADIUS * 2 + (colors.length - 1) * CHIP_GAP
  return colors
    .map((color, i) => {
      const x = cx - width / 2 + CHIP_RADIUS + i * (CHIP_RADIUS * 2 + CHIP_GAP)
      return `<circle cx="${num(x)}" cy="${num(cy)}" r="${CHIP_RADIUS}"${paintAttrs('fill', plainColor(color))} stroke="${ring}" stroke-width="1"/>`
    })
    .join('')
}

function applyStroke(look: LineLook): string {
  return (
    `${paintAttrs('stroke', look.stroke)} stroke-width="${num(look.strokeWidth)}"` +
    (look.dasharray ? ` stroke-dasharray="${look.dasharray}"` : '')
  )
}

// A portal's two marks and numbers as shapes, as the canvas draws them: the oval at the exit goes
// under the edge, so the line comes out of it, and everything else over it.
function portalShapes(
  split: PortalSplit,
  kind: PortalMarkKind,
  number: number,
  theme: Theme,
  hole: string,
  family: string
): { under: string; over: string } {
  const color = PORTAL_COLOR[theme]
  const oval = (mark: PortalSplit['entry']): string =>
    `<ellipse rx="${PORTAL_OVAL.rx}" ry="${PORTAL_OVAL.ry}" transform="${markTransform(mark, 'oval')}" fill="${esc(hole)}" stroke="${color}" stroke-width="2"/>`
  const tilde = (mark: PortalSplit['entry']): string =>
    `<path d="${PORTAL_TILDE_PATH}" transform="${markTransform(mark, 'tilde')}" fill="none" stroke="${color}" stroke-width="${PORTAL_MARK_WIDTH}" stroke-linecap="round"/>`
  const label = (mark: PortalSplit['entry'], towardsGap: 1 | -1): string => {
    const at = numberPoint(mark, towardsGap)
    return `<text x="${num(at.x)}" y="${num(at.y)}" text-anchor="middle" font-family="${esc(family)}" font-size="12" font-weight="600" fill="${color}">${number}</text>`
  }
  return {
    under: kind === 'oval' ? oval(split.exit) : '',
    over:
      (kind === 'oval' ? oval(split.entry) : tilde(split.entry) + tilde(split.exit)) +
      label(split.entry, 1) +
      label(split.exit, -1)
  }
}

export function renderDiagramSvg(diagram: DiagramFile, options: SvgExportOptions): string {
  const theme = options.theme
  const tokens = PAGE_TOKENS[theme]
  const family = options.fontFamily ?? diagram.fontFamily ?? DEFAULT_FONT_FAMILY
  const enabled = new Set(options.enabledHighlightIds ?? [])
  const highlights = diagram.highlights ?? []
  const extent = new Extent()

  const nodes = layoutNodes(diagram)
  const edges = layoutEdges(orientEdges(diagram), nodes)

  interface Drawn {
    z: number
    layer: 0 | 1
    order: number
    svg: string
  }
  const drawn: Drawn[] = []
  const labels: string[] = []
  const obstacles: Rect[] = []

  // -- nodes
  for (const laid of nodes.values()) {
    const { node, kind, x, y, width, height } = laid
    const matches = matchingHighlights(node.metadata, highlights, enabled)
    const single = matches.length === 1 ? matches[0] : undefined
    const parts: string[] = []
    let box: Rect = { x, y, width, height }

    if (kind === 'line') {
      const look = resolveLineNodeLook(node.style, theme)
      const d = buildBendablePath(node.data.points ?? [])
      if (d) {
        parts.push(
          `<g transform="translate(${num(x)} ${num(y)})"><path d="${strokedPath(d, look)}" fill="none"${applyStroke(look)}/>${arrowheadsFor(d, look)}</g>`
        )
        const pad =
          look.strokeWidth / 2 +
          (look.startMarker !== 'none' || look.endMarker !== 'none' ? look.strokeWidth * 6 : 0) +
          1
        for (const p of flattenPath(d)) extent.add(x + p.x, y + p.y, pad)
      }
      box = { x, y, width, height }
      drawn.push({
        z: laid.z,
        layer: 1,
        order: laid.order,
        svg: `<g class="chd-line" data-id="${esc(node.id)}">${parts.join('')}</g>`
      })
      obstacles.push(box)
      continue
    }

    const type = styledNodeType(node.type)
    const style = kind === 'stencil' ? stencilStyle(node.data.kind, node.style) : node.style
    const boxLook = resolveBoxLook(type, style, theme, single)
    const look =
      kind === 'stencil'
        ? withStencilLightColors(boxLook, node.data.kind, node.style, theme, single !== undefined)
        : boxLook
    const labelLook = resolveLabelLook(type, style, theme, family)
    const sk = kind === 'stencil' ? stencilKind(node.data.kind) : undefined
    const sw = sk?.heavyBorder ? look.strokeWidth * HEAVY_BORDER_FACTOR : look.strokeWidth
    const text = node.data.label ?? ''

    if (sk && (look.fill || look.stroke)) {
      parts.push(stencilShape(sk, { x, y, width, height }, look, sw, tokens.text, false, node.data))
    } else if (look.fill || look.stroke) {
      const inset = look.stroke ? sw / 2 : 0
      const rx = Math.max(0, 6 - inset)
      parts.push(
        `<rect x="${num(x + inset)}" y="${num(y + inset)}" width="${num(width - inset * 2)}" height="${num(height - inset * 2)}" rx="${num(rx)}"${paintAttrs('fill', look.fill)}${paintAttrs('stroke', look.stroke)}` +
          (look.stroke ? ` stroke-width="${num(sw)}"` : '') +
          (look.stroke && look.dashed ? ` stroke-dasharray="${num(sw * 3)} ${num(sw * 2)}"` : '') +
          '/>'
      )
    }

    const lineHeight = labelLook.font.size * LINE_HEIGHT_EM
    if (kind === 'stencil' && stencilLabelOutside(node.data.kind)) {
      // The small shapes carry their label outside: where the node says, as
      // wide as it needs. A free label is tied to its shape by a dotted line.
      const position = labelPositionOf(node.data.labelPosition)
      const beside = position === 'left' || position === 'right'
      const available = beside ? 140 : Math.max(width, 120)
      const lines = wrapText(text, available, labelLook.font)
      const blockWidth = Math.min(available, blockWidthOf(lines, labelLook.font))
      const blockHeight = lines.length * lineHeight
      const box = labelBox(
        position,
        offsetOf(node.data.labelOffset),
        { x, y, width, height },
        { width: blockWidth, height: blockHeight },
        sw / 2 + LABEL_GAP
      )
      if (text) {
        if (position === 'free') {
          const leader = leaderLine(
            sk?.shape === 'circle' ? 'circle' : 'square',
            { x, y, width, height },
            box
          )
          if (leader)
            parts.push(
              `<line class="chd-label-leader" x1="${num(leader.x1)}" y1="${num(leader.y1)}" x2="${num(leader.x2)}" y2="${num(leader.y2)}"${paintAttrs('stroke', labelLook.fill)} stroke-width="1" stroke-dasharray="2 3"/>`
            )
        }
        const look = { ...labelLook, align: labelAlign(position) }
        parts.push(textLines(lines, look, box.x, blockWidth, box.y))
        extent.rect(box.x, box.y, blockWidth, blockHeight)
        obstacles.push({ x: box.x, y: box.y, width: blockWidth, height: blockHeight })
      }
    } else if (kind === 'container') {
      // The label sits on the side the container says, turned to face it: the top of the
      // text points at the side, except at the bottom, where it stays upright.
      const side = containerLabelSideOf(node.data.labelPosition)
      const shape = { x, y, width, height }
      const room = containerLabelRoom(side, shape, sw)
      const lines = wrapText(text, room, labelLook.font)
      const blockWidth = Math.min(room, blockWidthOf(lines, labelLook.font))
      const at = containerLabelPlace(
        side,
        shape,
        sw,
        { width: blockWidth, height: lines.length * lineHeight },
        labelLook.align
      )
      const drawn = textLines(lines, labelLook, at.left, blockWidth, at.top)
      const turn = containerLabelTurn(side)
      parts.push(
        turn && drawn
          ? `<g transform="rotate(${turn} ${num(at.cx)} ${num(at.cy)})">${drawn}</g>`
          : drawn
      )
    } else {
      const padding = 8
      // An arrow's band takes room on the left, so the label is centred in what is left.
      const insets = kind === 'stencil' ? stencilLabelInsets(node.data.kind) : { left: 0, right: 0 }
      const available = Math.max(0, width - sw * 2 - padding * 2 - insets.left - insets.right)
      const lines = wrapText(text, available, labelLook.font)
      const blockWidth = Math.min(available, blockWidthOf(lines, labelLook.font))
      const blockHeight = lines.length * lineHeight
      // A text node clips its label to its own box, and a label too tall for it starts at the top
      // and is cut off at the bottom; every other label is centred, overflowing equally both ways.
      const clipped = kind === 'text' && blockHeight > height - sw * 2 - padding * 2
      const top = clipped ? y + sw + padding : y + height / 2 - blockHeight / 2
      let content = textLines(
        lines,
        labelLook,
        x + insets.left + (width - insets.left - insets.right) / 2 - blockWidth / 2,
        blockWidth,
        top
      )
      if (clipped && content) {
        content = `<g clip-path="url(#chd-clip-${laid.order})">${content}</g>`
        parts.push(
          `<clipPath id="chd-clip-${laid.order}"><rect x="${num(x + sw)}" y="${num(y + sw)}" width="${num(width - sw * 2)}" height="${num(height - sw * 2)}"/></clipPath>`
        )
      }
      parts.push(content)
    }

    if (kind === 'entity') {
      for (const [slot, icon] of Object.entries(node.data.icons ?? {}) as [IconSlot, IconRef][]) {
        const asset = icon && options.icons.get(iconKey(icon))
        if (!asset) continue
        const at = SLOT_OFFSET[slot](laid, sw)
        parts.push(iconElement(asset, at.x, at.y, ICON_SIZE, tokens.text))
      }
    }

    if (matches.length >= 2) {
      parts.push(
        chips(
          matches.map((m) => m.color),
          x + width / 2,
          y - 3,
          tokens.background
        )
      )
      extent.add(x + width / 2, y - 7)
    }

    const rotation = kind === 'text' ? (node.rotation ?? 0) : 0
    const rotated = rotation % 360 !== 0
    const transform = rotated
      ? ` transform="rotate(${num(rotation)} ${num(x + width / 2)} ${num(y + height / 2)})"`
      : ''
    drawn.push({
      z: laid.z,
      layer: 1,
      order: laid.order,
      svg: `<g class="chd-${kind}" data-id="${esc(node.id)}"${transform}>${parts.join('')}</g>`
    })

    if (rotated) {
      const rad = (rotation * Math.PI) / 180
      const cx = x + width / 2
      const cy = y + height / 2
      for (const [dx, dy] of [
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [-width / 2, height / 2]
      ]) {
        extent.add(
          cx + dx * Math.cos(rad) - dy * Math.sin(rad),
          cy + dx * Math.sin(rad) + dy * Math.cos(rad)
        )
      }
      obstacles.push({
        x: cx - Math.max(width, height) / 2,
        y: cy - Math.max(width, height) / 2,
        width: Math.max(width, height),
        height: Math.max(width, height)
      })
    } else {
      extent.rect(x - sw / 2, y - sw / 2, width + sw, height + sw)
      obstacles.push(box)
    }
  }

  // -- edges
  // The gates where an edge goes through the border of a container, drawn on the edge.
  const gatesFor = (sourceId: string, targetId: string, path: Point[]): string => {
    const crossing = edgeCrossing(sourceId, targetId, (id) => nodes.get(id)?.node.parentId)
    if (!crossing) return ''
    const boundaries = [...crossing.leaving, ...crossing.entering].flatMap((id) => {
      const box = nodes.get(id)
      return box ? [{ id, rect: { x: box.x, y: box.y, width: box.width, height: box.height } }] : []
    })
    const half = GATE_HALF
    return gatesOnPath(path, boundaries)
      .map((g) => {
        const [x1, y1, x2, y2] =
          g.axis === 'horizontal'
            ? [g.x - half, g.y, g.x + half, g.y]
            : [g.x, g.y - half, g.x, g.y + half]
        return `<line class="chd-crossing-gate" x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${GATE_COLOR[theme]}" stroke-width="${GATE_WIDTH}" stroke-linecap="round"/>`
      })
      .join('')
  }
  const chipRing = tokens.background
  const portalNumberOf = portalNumbers(diagram.edges)
  for (const laid of edges) {
    const { edge, from, to } = laid
    const matches = matchingHighlights(edge.metadata, highlights, enabled)
    const single = matches.length === 1 ? matches[0] : undefined
    const look = resolveEdgeLook(edge.style, theme, single)
    const d = buildEdgePath(
      edge.style?.routingStyle,
      from,
      to,
      edge.points ?? [],
      options.edgeStraightSegmentLength
    )
    const flat = flattenPath(d)
    // A portal draws the edge broken, with a mark and a number at each end of the gap; it is only a
    // way of drawing (the canvas does the same from the same splitPath).
    const portal = readPortal(edge.style)
    const split = portal ? splitPath(d, portal) : undefined
    let line: string
    let marks = { under: '', over: '' }
    if (split) {
      const leadLook = { ...look, endMarker: 'none' as const }
      const tailLook = { ...look, startMarker: 'none' as const }
      line =
        `<path d="${strokedPath(split.lead, leadLook)}" fill="none"${applyStroke(look)}/>${arrowheadsFor(split.lead, leadLook)}` +
        `<path d="${strokedPath(split.tail, tailLook)}" fill="none"${applyStroke(look)}/>${arrowheadsFor(split.tail, tailLook)}`
      marks = portalShapes(
        split,
        options.portalMark ?? 'tilde',
        portalNumberOf.get(edge.id) ?? portal?.number ?? 1,
        theme,
        tokens.background,
        family
      )
      for (const mark of [split.entry, split.exit]) extent.add(mark.x, mark.y, 20)
    } else {
      line = `<path d="${strokedPath(d, look)}" fill="none"${applyStroke(look)}/>${arrowheadsFor(d, look)}`
    }
    drawn.push({
      z: laid.z,
      layer: 0,
      order: laid.order,
      svg: `<g class="chd-edge" data-id="${esc(edge.id)}">${marks.under}${line}${marks.over}${options.crossings ? gatesFor(edge.source, edge.target, flat) : ''}</g>`
    })
    const pad =
      look.strokeWidth / 2 +
      (look.startMarker !== 'none' || look.endMarker !== 'none' ? look.strokeWidth * 6 : 0) +
      1
    for (const p of flat) extent.add(p.x, p.y, pad)
    if (flat.length > 0) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of flat) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      obstacles.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
    }

    // Labels paint above everything, as in the canvas.
    const at = pointAtRatio(d, edge.style?.labelPosition ?? 0.5)
    const label = edge.label ?? ''
    if (label !== '') {
      const labelLook = resolveEdgeLabelLook(edge.style, theme, family)
      const lines = wrapText(label, 0, labelLook.font)
      const lineHeight = labelLook.font.size * LINE_HEIGHT_EM
      const textWidth = blockWidthOf(lines, labelLook.font)
      const chipWidth = Math.max(8, textWidth) + 12 + 2
      const chipHeight = Math.max(labelLook.font.size, lines.length * lineHeight) + 2 + 2
      const left = at.x - chipWidth / 2
      const top = at.y - chipHeight / 2
      labels.push(
        `<g class="chd-edge-label" data-id="${esc(edge.id)}"><rect x="${num(left + 0.5)}" y="${num(top + 0.5)}" width="${num(chipWidth - 1)}" height="${num(chipHeight - 1)}" rx="4" fill="${tokens.soft}" stroke="${tokens.border}"/>` +
          textLines(lines, labelLook, left + 7, textWidth, top + 2) +
          '</g>'
      )
      extent.rect(left, top, chipWidth, chipHeight)
    }
    if (matches.length >= 2) {
      labels.push(
        chips(
          matches.map((m) => m.color),
          at.x,
          at.y - 14,
          chipRing
        )
      )
      extent.add(at.x, at.y - 18)
    }
  }

  // -- stacking: ascending z, edges below nodes at an equal z (their layer comes first in the canvas)
  drawn.sort((a, b) => a.z - b.z || a.layer - b.layer || a.order - b.order)

  // -- legend
  let bounds = extent.toRect()
  let legendSvg = ''
  const legendItems = options.legend?.items ?? []
  if (options.legend && legendItems.length > 0) {
    const size = legendSize(legendItems)
    const placement = placeLegend(bounds, size, options.legend.corner, LEGEND_MARGIN, obstacles)
    bounds = placement.bounds
    legendSvg = drawLegend(legendItems, placement.position, size, options)
  }

  const padding = options.paddingPx
  const width = Math.max(1, Math.ceil(bounds.width + padding * 2))
  const height = Math.max(1, Math.ceil(bounds.height + padding * 2))
  const background =
    options.background === 'transparent'
      ? ''
      : `<rect width="100%" height="100%" fill="${esc(options.background === 'theme' ? tokens.background : options.background.color)}"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (options.title ? `<title>${esc(options.title)}</title>` : '') +
    background +
    `<g transform="translate(${num(padding - bounds.x)} ${num(padding - bounds.y)})">` +
    drawn.map((d) => d.svg).join('') +
    labels.join('') +
    legendSvg +
    '</g></svg>\n'
  )
}

export { highlightId }
