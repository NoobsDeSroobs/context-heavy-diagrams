import type { Theme } from '../theme'

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

// sRGB (0-255) <-> Oklab, a perceptually uniform colour space (Björn Ottosson, 2020; the conversion
// the CSS oklab()/oklch() spec uses). It replaced a first version that mirrored HSV's Value (ADR
// 0034's revision note). HSV's V (max channel / 255) is hue-blind: pure yellow and pure blue both
// read 100% although yellow looks nearly white and blue quite dark, and red looks darker than its V
// suggests, which broke the naive mirror for the motivating case (readable white-on-red flipping to
// unreadable black-on-red instead of the equally readable inverse). Oklab's L tracks perceived
// brightness across every hue, so mirroring that behaves the way a human expects.
function srgbChannelToLinear(c: number): number {
  const cn = c / 255
  return cn <= 0.04045 ? cn / 12.92 : ((cn + 0.055) / 1.055) ** 2.4
}

function linearChannelToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c))
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return srgb * 255
}

function rgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const lr = srgbChannelToLinear(r)
  const lg = srgbChannelToLinear(g)
  const lb = srgbChannelToLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  }
}

function oklabToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return { r: linearChannelToSrgb(lr), g: linearChannelToSrgb(lg), b: linearChannelToSrgb(lb) }
}

function toHexChannel(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0')
}

// Oklab's L is normalized 0 (black) to 1 (white) — the flip is self-inverse
// (mirrored around 0.5), same reasoning as the original HSV version: it's
// what makes themeAdaptiveColor below safe to use unmodified for both
// directions, stored-to-displayed at render time and picked-to-stored at
// edit time. `a`/`b` (Oklab's two chroma/hue axes) are held fixed — the
// direct equivalent of "hold Hue/Saturation fixed" in HSV terms.
function flipLightness(L: number, theme: Theme): number {
  return theme === 'dark' ? L : 1 - L
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
  const { L, a, b } = rgbToOklab(rgb.r, rgb.g, rgb.b)
  const flipped = oklabToRgb(flipLightness(L, theme), a, b)
  return `#${toHexChannel(flipped.r)}${toHexChannel(flipped.g)}${toHexChannel(flipped.b)}`
}
