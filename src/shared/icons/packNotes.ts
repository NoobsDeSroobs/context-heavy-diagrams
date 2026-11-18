import type { PackSummary } from './installedPacks.ts'
import type { IconPackNote, IconRef } from './schema.ts'

// The packs a set of icon references names, each once, in name order (so the saved list does not
// move around in git).
// A built-in icon is the Tabler pack, but it is not noted: Tabler is the default pack, the app knows
// what to do when it is missing, and a note would change every older diagram on its next save.
export function usedPackNames(icons: readonly (IconRef | undefined)[]): string[] {
  const names = new Set<string>()
  for (const icon of icons) if (icon?.source === 'installed') names.add(icon.pack)
  return [...names].sort((a, b) => a.localeCompare(b))
}

// The `iconPacks` list a save writes (ADR 0188): one note per pack the diagram's icons name. A pack
// installed here gives its own current version and "if missing" text; one that is not keeps the
// note the file already had, so a machine without the pack does not erase what the file knows about
// it. A pack the diagram no longer uses is dropped.
export function buildPackNotes(
  used: readonly string[],
  installed: readonly PackSummary[],
  previous: readonly IconPackNote[] = []
): IconPackNote[] {
  const here = new Map(
    installed.filter((pack) => pack.duplicateOf === null).map((pack) => [pack.meta.name, pack])
  )
  return used.map((name) => {
    const pack = here.get(name)
    if (!pack) return previous.find((note) => note.name === name) ?? { name }
    return {
      name,
      ...(pack.meta.version ? { version: pack.meta.version } : {}),
      ...(pack.meta.ifMissing ? { ifMissing: pack.meta.ifMissing } : {})
    }
  })
}
