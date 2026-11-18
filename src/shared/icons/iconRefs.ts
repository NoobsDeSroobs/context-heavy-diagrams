import type { IconRef } from './schema.ts'

// The Tabler pack (ADR 0188): the built-in icons are its `Outline` subset, installed like any other
// pack. A `builtin` reference means one of its icons, so older diagrams and the command line keep
// working.
export const TABLER_PACK = 'Tabler'
export const TABLER_SUBSET = 'Outline'

// The pack and the path inside it that a reference means; none for a file beside the diagram.
export function installedIconOf(icon: IconRef): { pack: string; path: string } | undefined {
  if (icon.source === 'installed') return { pack: icon.pack, path: icon.path }
  if (icon.source === 'builtin') {
    return { pack: TABLER_PACK, path: `${TABLER_SUBSET}/${icon.id}.svg` }
  }
  return undefined
}

// The reference to store for an icon picked from a pack. A Tabler outline icon is written as
// `builtin`, as it always was: an older app and the command line draw it, which they could not for
// an `installed` reference.
export function refForInstalledIcon(pack: string, path: string): IconRef {
  const prefix = `${TABLER_SUBSET}/`
  if (pack === TABLER_PACK && path.startsWith(prefix) && path.endsWith('.svg')) {
    const id = path.slice(prefix.length, -'.svg'.length)
    if (/^[a-z0-9-]+$/.test(id)) return { source: 'builtin', id }
  }
  return { source: 'installed', pack, path }
}
