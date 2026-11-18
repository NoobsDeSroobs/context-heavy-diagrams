import { TABLER_PACK, TABLER_SUBSET } from '@shared/icons/iconRefs'
import { loadInstalledIconMarkup } from './installedIcons'

// A `builtin` icon is an icon of the installed Tabler pack (ADR 0188): the exports read it from the
// pack like any installed icon, cleaned and with ids of its own. Undefined where the pack, or the
// icon, is not installed, and the icon is then left out of the export.
export function loadBuiltinIconSvg(id: string): Promise<string | undefined> {
  return loadInstalledIconMarkup(TABLER_PACK, `${TABLER_SUBSET}/${id}.svg`)
}
