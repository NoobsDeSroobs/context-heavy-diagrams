import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { iconPlace } from '@shared/icons/pack'
import { cleanIcon, isolateIcon } from './cleanIcon'

// Installed icons (ADR 0188) as the canvas, the legend and the picker draw them: read from the pack
// through the main process, cleaned once, and given the ids of one drawing each time they are
// drawn. A read is kept for the session, so the same icon on fifty elements is read and cleaned
// once; the packs changing (an install or a removal) drops them all and every drawing asks again.

export type LoadedIcon =
  { ok: true; cleaned: string } | { ok: false; reason: 'no-pack' | 'no-icon' | 'unusable' }

const loads = new Map<string, Promise<LoadedIcon>>()
const listeners = new Set<() => void>()
let version = 0
let watching = false

function watchPacks(): void {
  if (watching) return
  watching = true
  window.api.onIconPacksChanged(() => {
    loads.clear()
    version += 1
    listeners.forEach((listener) => listener())
  })
}

function subscribe(listener: () => void): () => void {
  watchPacks()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const currentVersion = (): number => version

export function loadInstalledIcon(pack: string, path: string): Promise<LoadedIcon> {
  const key = iconPlace(pack, path)
  let load = loads.get(key)
  if (!load) {
    load = window.api
      .readInstalledIcon(pack, path)
      .then((result): LoadedIcon => {
        if (!result.ok) {
          return { ok: false, reason: result.reason === 'no-pack' ? 'no-pack' : 'no-icon' }
        }
        const cleaned = cleanIcon(result.svg)
        return cleaned === null ? { ok: false, reason: 'unusable' } : { ok: true, cleaned }
      })
      .catch((): LoadedIcon => ({ ok: false, reason: 'no-icon' }))
    loads.set(key, load)
  }
  return load
}

// Each drawing of an icon has a number of its own, so two drawings of one icon never share an id.
let nextDrawing = 0

export type InstalledIcon =
  | { state: 'loading' }
  | { state: 'ready'; markup: string }
  | { state: 'missing'; reason: 'no-pack' | 'no-icon' | 'unusable' }

// The markup to draw an installed icon with, once it has been read.
export function useInstalledIcon(pack: string, path: string): InstalledIcon {
  const changed = useSyncExternalStore(subscribe, currentVersion)
  const [drawing] = useState(() => nextDrawing++)
  const key = `${changed}:${iconPlace(pack, path)}`
  const [loaded, setLoaded] = useState<{ key: string; icon: LoadedIcon } | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadInstalledIcon(pack, path).then((icon) => {
      if (!cancelled) setLoaded({ key, icon })
    })
    return () => {
      cancelled = true
    }
  }, [key, pack, path])

  const icon = loaded?.key === key ? loaded.icon : null
  const markup = useMemo(
    () => (icon?.ok ? isolateIcon(icon.cleaned, iconPlace(pack, path), drawing) : null),
    [icon, pack, path, drawing]
  )
  if (!icon) return { state: 'loading' }
  return icon.ok && markup !== null
    ? { state: 'ready', markup }
    : { state: 'missing', reason: icon.ok ? 'unusable' : icon.reason }
}
