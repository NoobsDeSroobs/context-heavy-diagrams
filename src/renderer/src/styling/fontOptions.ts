// The Family dropdown lists the generic families plus the fonts of the active
// style palette. A font an element already uses may be in neither (it came from
// another palette, another machine, or a hand-edited file), and a <select> with no
// option for its value cannot show it: the field fell back to "Default" while the
// element was drawn in that font. So every stored font is offered too, labelled so
// it is clear why it is there. The field then always shows what is stored.

export interface FontOption {
  value: string
  label: string
  // Heading the option is listed under in the dropdown; none means ungrouped.
  group?: string
}

export const GROUP_SYSTEM = 'System defaults'
export const GROUP_PALETTE = 'Palette fonts'
export const GROUP_IN_USE = 'In use, not in your palette'

export function withStoredFonts(
  options: FontOption[],
  storedFonts: readonly (string | undefined)[]
): FontOption[] {
  const known = new Set(options.map((o) => o.value))
  const extra: FontOption[] = []
  for (const font of storedFonts) {
    if (!font || known.has(font)) continue
    known.add(font)
    extra.push({ value: font, label: font, group: GROUP_IN_USE })
  }
  return [...options, ...extra]
}
