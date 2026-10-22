// Font choices stored as a CSS font-family value (ADR 0130).

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'])
const MONOSPACE = /mono|code|courier|consolas|menlo|console|typewriter/i
const SERIF =
  /\bserif\b|times|georgia|garamond|palatino|cambria|bookman|baskerville|caslon|didot|minion|century|constantia/i

// What a font picked by name from a list is stored as: the name, quoted, then a generic family
// guessed from the name, so a computer without the font still draws something close. A value that
// is already a stack, or a generic family, is stored as it is.
export function fontStackFor(family: string): string {
  const name = family.trim()
  if (name.includes(',') || GENERIC_FAMILIES.has(name.toLowerCase())) return name
  const generic = MONOSPACE.test(name)
    ? 'monospace'
    : SERIF.test(name) && !/\bsans\b/i.test(name)
      ? 'serif'
      : 'sans-serif'
  return `'${name.replace(/'/g, "\\'")}', ${generic}`
}

// The first family of a stack as the author would name it, for display: the quotes and the
// fallbacks are noise next to the name itself.
export function primaryFamily(stack: string): string {
  const first = stack.split(',')[0].trim()
  return first.replace(/^(['"])(.*)\1$/, '$2').replace(/\\'/g, "'")
}

// The font a diagram is drawn in: its own, else the personal default (ADR 0052's tiers), else
// undefined, which means the built-in font. Empty strings count as unset.
export function effectiveDiagramFont(
  diagramFont: string | undefined,
  preferenceFont: string | undefined
): string | undefined {
  return diagramFont || preferenceFont || undefined
}
