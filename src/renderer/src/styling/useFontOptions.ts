import { useMemo } from 'react'
import { fontStackFor, primaryFamily } from '@shared/styling/fontStack'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { FONT_FAMILY_OPTIONS } from '../properties/fontFamilyOptions'
import { GROUP_INSTALLED, GROUP_PALETTE, withStoredFonts, type FontOption } from './fontOptions'
import { useInstalledFontFamilies } from './installedFonts'

// What "no override" is labelled in an element's font dropdown: the font it then inherits.
export function defaultFontLabel(diagramFont: string | undefined): string {
  return diagramFont ? `Default (${primaryFamily(diagramFont)})` : 'Default'
}

// Everything a font dropdown offers: the "no override" entry, the generic families, the active
// palette's fonts, the fonts installed on this computer, then any stored font that is none of those
// (ADR 0130). A font picked by name from the installed list is stored as a stack with a fallback.
// `defaultLabel` names what "no override" means where the dropdown is.
export function useFontOptions(
  storedFonts: readonly (string | undefined)[],
  defaultLabel = 'Default'
): FontOption[] {
  const { paletteFonts } = useDiagramContext()
  const installed = useInstalledFontFamilies()
  // storedFonts is a fresh array every render; its content is what matters.
  const storedKey = storedFonts.join('\n')
  return useMemo(() => {
    const base: FontOption[] = [
      { ...FONT_FAMILY_OPTIONS[0], label: defaultLabel },
      ...FONT_FAMILY_OPTIONS.slice(1),
      ...paletteFonts.map((f) => ({ value: f, label: f, group: GROUP_PALETTE }))
    ]
    const known = new Set(base.map((o) => o.value))
    for (const family of installed) {
      const value = fontStackFor(family)
      if (known.has(value)) continue
      known.add(value)
      base.push({ value, label: family, group: GROUP_INSTALLED })
    }
    return withStoredFonts(base, storedKey === '' ? [] : storedKey.split('\n'))
  }, [paletteFonts, installed, storedKey, defaultLabel])
}
