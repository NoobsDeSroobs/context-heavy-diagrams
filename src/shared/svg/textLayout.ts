// Text measuring and wrapping without a browser. An SVG <text> does not wrap, and the export runs in
// plain Node (ADR 0124), so there is no layout engine to ask how wide a label is. The widths below
// are an estimate, not a measurement: per-character advance widths for a typical sans-serif (Arial
// and Segoe UI proportions) in thousandths of an em. It is deterministic (the same file always
// wraps the same way, so a regenerated image only changes when the diagram does) and it errs a
// little wide, so a label wraps early rather than overflowing its box.

export interface FontSpec {
  size: number
  weight: 'normal' | 'bold'
  // The CSS font-family stack, if the element sets one; only used to tell monospace and serif apart.
  family?: string
}

// The canvas inherits `line-height: 1.6` from the page (base.css), so a label's lines are 1.6 em apart.
export const LINE_HEIGHT_EM = 1.6

// Estimated safety factor applied to every width (see above).
const WIDTH_SAFETY = 1.03

const NARROW = new Set("iIjl.,:;!|'`")
const NARROW_ISH = new Set('ftr()[]{}-/\\"*')
const WIDE_LOWER = new Set('mw')
const WIDE_UPPER = new Set('MW')

function advanceEm(char: string): number {
  if (char === ' ') return 0.278
  if (NARROW.has(char)) return 0.27
  if (NARROW_ISH.has(char)) return 0.36
  if (WIDE_LOWER.has(char)) return 0.8
  if (WIDE_UPPER.has(char)) return 0.92
  if (char === '@' || char === '%' || char === '&') return 0.9
  if (char >= '0' && char <= '9') return 0.56
  if (char >= 'A' && char <= 'Z') return 0.68
  if (char >= 'a' && char <= 'z') return 0.53
  const code = char.codePointAt(0) ?? 0
  // CJK, Hangul, fullwidth forms and emoji take about a full em.
  if (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xff00 && code <= 0xffef) ||
    code >= 0x1f000
  ) {
    return 1
  }
  return 0.6
}

function familyFactor(family: string | undefined): number | 'mono' {
  const f = (family ?? '').toLowerCase()
  if (f.includes('mono') || f.includes('courier') || f.includes('consolas')) return 'mono'
  if (f.includes('serif') && !f.includes('sans')) return 0.95
  if (f.includes('cursive')) return 0.95
  return 1
}

export function measureText(text: string, font: FontSpec): number {
  const factor = familyFactor(font.family)
  const bold = font.weight === 'bold' ? 1.07 : 1
  let em = 0
  for (const char of text) em += factor === 'mono' ? 0.6 : advanceEm(char) * factor
  return em * font.size * bold * WIDTH_SAFETY
}

// Greedy word wrap into lines no wider than `maxWidth`: explicit newlines are kept, words are never
// split unless one alone is wider than the line (the canvas uses overflow-wrap: anywhere, which
// breaks such a word at the last character that fits). A non-positive `maxWidth` disables wrapping
// but still honours explicit newlines.
export function wrapText(text: string, maxWidth: number, font: FontSpec): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (maxWidth <= 0 || measureText(paragraph, font) <= maxWidth) {
      lines.push(paragraph)
      continue
    }
    let current = ''
    for (const word of paragraph.split(' ')) {
      const candidate = current === '' ? word : `${current} ${word}`
      if (measureText(candidate, font) <= maxWidth) {
        current = candidate
        continue
      }
      if (current !== '') lines.push(current)
      current = word
      // A single word wider than the line breaks across lines at the last character that fits.
      while (measureText(current, font) > maxWidth && [...current].length > 1) {
        const chars = [...current]
        let fit = 1
        while (
          fit < chars.length &&
          measureText(chars.slice(0, fit + 1).join(''), font) <= maxWidth
        ) {
          fit += 1
        }
        lines.push(chars.slice(0, fit).join(''))
        current = chars.slice(fit).join('')
      }
    }
    lines.push(current)
  }
  return lines
}
