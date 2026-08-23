import type { IconRef } from '@shared/diagram'
import { loadBuiltinIconSvg } from '../icons/builtinIcons'
import { markerUrl } from '../edges/markerIds'
import type { ExportLegendItem } from './exportLegendItems'

// Same three dash patterns as LabeledEdge.tsx/LegendPanel.tsx's own
// DASH_ARRAY — small independent copy, matching this codebase's existing
// precedent for this exact one-liner.
const DASH_ARRAY: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

type ResolvedIcon = { type: 'svg'; markup: string } | { type: 'img'; dataUrl: string }

function iconKey(icon: IconRef): string {
  return icon.source === 'builtin' ? `b:${icon.id}` : `c:${icon.path}`
}

// Resolves every icon-kind legend entry up front — builtin icons load as
// trusted, bundled SVG markup (inlined directly, same as IconSlotView);
// custom icons load as a data URL (an <img>, never inlined — an arbitrary
// user-supplied SVG could embed a script, same reasoning as IconSlotView).
// Needed because building the actual legend DOM (buildLegendElement,
// below) is synchronous — this resolves everything it might need before
// that, once, rather than each row loading independently.
export async function resolveLegendIconMarkup(
  items: ExportLegendItem[],
  diagramPath: string | null
): Promise<Map<string, ResolvedIcon>> {
  const result = new Map<string, ResolvedIcon>()
  await Promise.all(
    items.map(async (item) => {
      if (item.swatch.kind !== 'icon') return
      const icon = item.swatch.icon
      const key = iconKey(icon)
      if (result.has(key)) return
      if (icon.source === 'builtin') {
        const markup = await loadBuiltinIconSvg(icon.id)
        if (markup) result.set(key, { type: 'svg', markup })
      } else if (diagramPath) {
        const dataUrl = await window.api.readIconAsDataUrl(diagramPath, icon.path)
        result.set(key, { type: 'img', dataUrl })
      }
    })
  )
  return result
}

// Resolves this app's own theme tokens (panel background/border/text —
// same ones AboutDialog/SettingsPanel use) to concrete computed colors, so
// the legend element built below can be fully self-styled with literal
// values rather than custom-property references. Needed because the
// element gets measured/rendered in more than one DOM location during
// export (see exportPng.ts) — baking in resolved colors up front means it
// looks identical everywhere it's temporarily mounted, rather than
// depending on which ancestor's CSS custom properties happen to be in
// scope at each location.
export function resolveLegendColors(probeParent: HTMLElement): {
  text: string
  background: string
  border: string
} {
  const probe = document.createElement('div')
  probe.style.cssText =
    'color: var(--color-text); background: var(--color-background-soft); border: 1px solid var(--ev-c-gray-2); position: fixed; visibility: hidden;'
  probeParent.appendChild(probe)
  const computed = getComputedStyle(probe)
  const resolved = {
    text: computed.color,
    background: computed.backgroundColor,
    border: computed.borderColor
  }
  probeParent.removeChild(probe)
  return resolved
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function buildSwatch(item: ExportLegendItem, iconMarkup: Map<string, ResolvedIcon>): HTMLElement {
  const wrapper = document.createElement('span')
  wrapper.style.cssText =
    'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 18px; flex: none;'

  const { swatch } = item
  if (swatch.kind === 'shape') {
    const dot = document.createElement('span')
    dot.style.cssText = `display: block; width: 14px; height: 14px; border-radius: 50%; background: ${swatch.color};`
    wrapper.appendChild(dot)
    return wrapper
  }
  if (swatch.kind === 'highlight') {
    const chip = document.createElement('span')
    chip.style.cssText = `display: block; width: 16px; height: 12px; border-radius: 3px; background: ${swatch.color};`
    wrapper.appendChild(chip)
    return wrapper
  }
  if (swatch.kind === 'icon') {
    const resolved = iconMarkup.get(iconKey(swatch.icon))
    if (resolved?.type === 'svg') {
      const span = document.createElement('span')
      span.style.cssText = 'display: block; width: 20px; height: 20px;'
      span.innerHTML = resolved.markup
      wrapper.appendChild(span)
    } else if (resolved?.type === 'img') {
      const img = document.createElement('img')
      img.src = resolved.dataUrl
      img.style.cssText = 'display: block; width: 20px; height: 20px; object-fit: contain;'
      wrapper.appendChild(img)
    }
    return wrapper
  }
  // 'line'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 28 16')
  svg.setAttribute('width', '28')
  svg.setAttribute('height', '16')
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', '2')
  line.setAttribute('y1', '8')
  line.setAttribute('x2', '26')
  line.setAttribute('y2', '8')
  line.setAttribute('stroke', swatch.color)
  line.setAttribute('stroke-width', '2')
  line.setAttribute('stroke-linecap', 'round')
  const dash = swatch.lineStyle ? DASH_ARRAY[swatch.lineStyle] : undefined
  if (dash) line.setAttribute('stroke-dasharray', dash)
  const startMarker = markerUrl(swatch.startMarker)
  const endMarker = markerUrl(swatch.endMarker)
  if (startMarker) line.setAttribute('marker-start', startMarker)
  if (endMarker) line.setAttribute('marker-end', endMarker)
  svg.appendChild(line)
  wrapper.appendChild(svg)
  return wrapper
}

// Builds a fully self-styled (no inherited/custom-property CSS — see
// resolveLegendColors above) legend box: one row per item, a swatch
// matching how that item's kind already renders elsewhere in this app
// (LegendSwatch for 'line'/'icon'/'shape', HighlightsPanel's swatch for
// 'highlight') plus its label. Detached — the caller positions/inserts it
// (exportPng.ts).
export function buildLegendElement(
  items: ExportLegendItem[],
  iconMarkup: Map<string, ResolvedIcon>,
  colors: { text: string; background: string; border: string }
): HTMLDivElement {
  const container = document.createElement('div')
  container.style.cssText = `display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 6px; background: ${colors.background}; border: 1px solid ${colors.border}; color: ${colors.text}; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; width: max-content;`

  for (const item of items) {
    const row = document.createElement('div')
    row.style.cssText = 'display: flex; align-items: center; gap: 6px;'
    row.appendChild(buildSwatch(item, iconMarkup))
    const label = document.createElement('span')
    label.textContent = item.label
    row.appendChild(label)
    container.appendChild(row)
  }

  return container
}
