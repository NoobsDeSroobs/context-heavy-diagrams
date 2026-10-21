import type { Theme } from '../styling/theme.ts'

// Colour handling without a browser: the SVG export runs in plain Node (ADR 0124), where there is
// no CSS engine to resolve a colour string or to blend an opacity into it. The canvas still lets
// the browser parse colours (renderer/styles/themeAdaptiveColor.ts) and shares only the lightness
// flip below, so the maths behind the theme flip (ADR 0034) exists once.

export interface Rgba {
  r: number
  g: number
  b: number
  // 0-1
  a: number
}

const NAMED: Record<string, string> = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32'
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, n))
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = (((h % 360) + 360) % 360) / 360
  const sat = Math.max(0, Math.min(1, s))
  const light = Math.max(0, Math.min(1, l))
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const channel = (t: number): number => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return {
    r: channel(hue + 1 / 3) * 255,
    g: channel(hue) * 255,
    b: channel(hue - 1 / 3) * 255
  }
}

// One component of an rgb()/hsl() function: a number, or a percentage of `scale`.
function component(token: string, scale: number): number {
  return token.endsWith('%') ? (parseFloat(token) / 100) * scale : parseFloat(token)
}

// hex (3, 4, 6, 8 digits), rgb()/rgba(), hsl()/hsla() in the comma and the space syntax, the named
// colours and `transparent`. Anything else (oklch(), color-mix(), a typo) is null, and callers pass
// such a value through untouched, which is what the canvas does when its own parser rejects one.
export function parseCssColor(input: string): Rgba | null {
  const text = input.trim().toLowerCase()
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (text in NAMED) return parseCssColor('#' + NAMED[text])

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)
  if (hex) {
    let digits = hex[1]
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('')
    const byte = (i: number): number => parseInt(digits.slice(i, i + 2), 16)
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1 }
  }

  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(text)
  if (!fn) return null
  const parts = fn[2]
    .replace('/', ' ')
    .split(/[\s,]+/)
    .filter((p) => p !== '')
  if (parts.length < 3 || parts.length > 4) return null
  const alpha = parts[3] === undefined ? 1 : component(parts[3], 1)
  if (parts.slice(0, 3).some((p) => Number.isNaN(parseFloat(p))) || Number.isNaN(alpha)) return null
  if (fn[1].startsWith('rgb')) {
    return {
      r: clampByte(component(parts[0], 255)),
      g: clampByte(component(parts[1], 255)),
      b: clampByte(component(parts[2], 255)),
      a: Math.max(0, Math.min(1, alpha))
    }
  }
  const rgb = hslToRgb(parseFloat(parts[0]), component(parts[1], 1), component(parts[2], 1))
  return { ...rgb, a: Math.max(0, Math.min(1, alpha)) }
}

function toHexChannel(n: number): string {
  return clampByte(Math.round(n)).toString(16).padStart(2, '0')
}

export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`
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

// Oklab's L is normalized 0 (black) to 1 (white) — the flip is self-inverse
// (mirrored around 0.5), same reasoning as the original HSV version: it's
// what makes themeAdaptiveColor safe to use unmodified for both
// directions, stored-to-displayed at render time and picked-to-stored at
// edit time. `a`/`b` (Oklab's two chroma/hue axes) are held fixed — the
// direct equivalent of "hold Hue/Saturation fixed" in HSV terms.
function flipLightness(L: number, theme: Theme): number {
  return theme === 'dark' ? L : 1 - L
}

// The theme-adaptive lightness flip (ADR 0034) of one already-parsed colour, as #rrggbb.
export function flipRgbLightness(rgb: { r: number; g: number; b: number }, theme: Theme): string {
  const { L, a, b } = rgbToOklab(rgb.r, rgb.g, rgb.b)
  return rgbToHex(oklabToRgb(flipLightness(L, theme), a, b))
}

// A stored colour as it is painted for `theme`, split into an opaque #rrggbb and its opacity (0-1)
// so an SVG can carry the opacity in fill-opacity/stroke-opacity, which every SVG consumer
// understands, rather than in a colour function some do not. `opacityPercent` is the schema's 0-100
// per-channel opacity (fillOpacity, strokeOpacity, fontOpacity). Like the canvas's flip, the flip
// drops any alpha the stored colour itself carries. A colour this module cannot parse is returned
// as written.
export function paintColor(
  stored: string,
  theme: Theme,
  opacityPercent?: number
): { color: string; opacity: number } {
  const rgb = parseCssColor(stored)
  const own = opacityPercent == null ? 1 : Math.max(0, Math.min(100, opacityPercent)) / 100
  if (!rgb) return { color: stored, opacity: own }
  return { color: flipRgbLightness(rgb, theme), opacity: own }
}

// A colour that is already the painted one (a default for this theme, a highlight colour) — only
// split into #rrggbb and opacity.
export function plainColor(
  color: string,
  opacityPercent?: number
): { color: string; opacity: number } {
  const rgb = parseCssColor(color)
  const own = opacityPercent == null ? 1 : Math.max(0, Math.min(100, opacityPercent)) / 100
  if (!rgb) return { color, opacity: own }
  return { color: rgbToHex(rgb), opacity: rgb.a * own }
}
