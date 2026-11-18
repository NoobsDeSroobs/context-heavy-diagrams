import type { IconRef } from '@shared/diagram'
import type { IconAsset } from '@shared/export/renderDiagram'
import { installedIconOf } from '@shared/icons/iconRefs'
import { loadInstalledIconMarkup } from '../icons/installedIcons'

// The drawing of one icon for an export: a pack's icon (the built-in Tabler ones included) as its
// cleaned markup, a custom icon as a data URL for an <image> (never inlined, since a user-supplied
// SVG may contain script). Undefined when the pack or the file is not there: the icon is left out,
// and the diagnostics say why (ADR 0188).
export async function loadIconAsset(
  icon: IconRef,
  diagramPath: string | null
): Promise<IconAsset | undefined> {
  try {
    const place = installedIconOf(icon)
    if (place) {
      const markup = await loadInstalledIconMarkup(place.pack, place.path)
      return markup ? { kind: 'svg', markup } : undefined
    }
    if (icon.source === 'custom' && diagramPath) {
      return { kind: 'image', dataUrl: await window.api.readIconAsDataUrl(diagramPath, icon.path) }
    }
  } catch {
    // Missing or unreadable: the icon is simply not drawn.
  }
  return undefined
}
