// Tabler Icons (MIT) as raw SVG, loaded lazily by name via Vite's glob
// import so we don't bundle all ~5,130 icons upfront. See
// docs/decisions/0006-icon-storage-model.md and docs/licensing.md — this
// is deliberately a generic set, not vendor-specific (AWS/Azure/etc.).
// Relative to this file, not a leading-slash "from project root" pattern —
// electron-vite's renderer root is src/renderer, so a leading slash resolved
// there instead of the true project root, matching nothing at all.
const svgLoaders = import.meta.glob('../../../../node_modules/@tabler/icons/icons/outline/*.svg', {
  query: '?raw',
  import: 'default'
}) as Record<string, () => Promise<string>>

const iconsByName = new Map<string, () => Promise<string>>()
for (const [path, loader] of Object.entries(svgLoaders)) {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '')
  iconsByName.set(name, loader)
}

const allIconIds = Array.from(iconsByName.keys()).sort()

export function listBuiltinIconIds(): string[] {
  return allIconIds
}

export function searchBuiltinIconIds(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return allIconIds
  return allIconIds.filter((id) => id.includes(q))
}

export function loadBuiltinIconSvg(id: string): Promise<string> | undefined {
  return iconsByName.get(id)?.()
}
