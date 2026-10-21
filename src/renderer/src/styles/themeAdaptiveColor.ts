import type { Theme } from '../theme'
import { flipRgbLightness } from '@shared/svg/color'

// Normalizes an arbitrary CSS color string (hex, rgb()/rgba(), hsl()/hsla(),
// named colors like "red" — ColorField's free-text input accepts any of
// these, not just the swatch's hex) into concrete RGB channels, by letting
// the browser's own CSS engine resolve it rather than hand-writing a parser
// for every valid CSS color syntax — see ADR 0034. A single hidden, reused
// element, appended once so getComputedStyle resolves reliably rather than
// depending on detached-element behavior.
let probeEl: HTMLDivElement | null = null

function getProbeEl(): HTMLDivElement {
  if (probeEl) return probeEl
  probeEl = document.createElement('div')
  probeEl.style.display = 'none'
  document.body.appendChild(probeEl)
  return probeEl
}

function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const probe = getProbeEl()
  probe.style.color = ''
  probe.style.color = color
  if (!probe.style.color) return null
  const computed = getComputedStyle(probe).color
  const match = computed.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  if (!match) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

// Applies the theme-adaptive lightness flip to an explicit fill/stroke/
// fontColor — see ADR 0034. `undefined` or a color this app's own
// CSS engine can't resolve passes through unchanged (nothing to flip).
// Overloaded so a definitely-a-string input (the common case, already
// guarded by callers) doesn't force `| undefined` handling at every call
// site — only a genuinely-optional input propagates that.
export function themeAdaptiveColor(color: string, theme: Theme): string
export function themeAdaptiveColor(color: string | undefined, theme: Theme): string | undefined
export function themeAdaptiveColor(color: string | undefined, theme: Theme): string | undefined {
  if (!color) return color
  const rgb = parseCssColor(color)
  if (!rgb) return color
  return flipRgbLightness(rgb, theme)
}
