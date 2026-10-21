import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type AppPreferences
} from '@shared/preferences/preferences'

// A rapid-fire source (a native color-input drag firing many onChange
// events per second — see ADR 0056) shouldn't mean that many IPC round-
// trips and disk writes; only the in-memory value needs to keep pace with
// every tick. This is purely about *persistence* timing, not visual
// responsiveness — updatePreferences below still calls setPreferences on
// every call, so the live UI (and anything reading it, e.g. a CSS var)
// updates immediately regardless of this delay.
const WRITE_DEBOUNCE_MS = 300

export type {
  AppPreferences,
  PaletteColor,
  LegendCorner,
  NamedStylePalette
} from '@shared/preferences/preferences'
export { DEFAULT_PREFERENCES, effectiveStylePalette } from '@shared/preferences/preferences'

// The pre-ADR-0053 localStorage key. Unchanged despite the "Settings" ->
// "Preferences" rename — it's what old data was written under,
// and this only ever reads it once for migration.
const LEGACY_STORAGE_KEY = 'settings'

// The old localStorage-only store (ADR 0032, before ADR 0053's move to a
// real per-OS file) — read once, only for migration. Returns null when
// there's genuinely nothing saved (a fresh install), as distinct from
// "saved, and happens to equal defaults" — the caller needs that
// distinction to know whether writing the migrated value back is worth
// doing at all.
function readLegacyLocalStoragePreferences(): AppPreferences | null {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return null
  try {
    return normalizePreferences(JSON.parse(raw) as Partial<AppPreferences>)
  } catch {
    return null
  }
}

// One per Electron window, live-synced across all of them via main's
// preferences:changed broadcast — ADR 0053 moved this from localStorage
// (synced for free via the `storage` event) to a real per-OS file under
// app.getPath('userData'), which only main can reach.
export function usePreferences(): {
  preferences: AppPreferences
  updatePreferences: (patch: Partial<AppPreferences>) => void
} {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingWriteRef = useRef<AppPreferences | null>(null)

  // Flush a still-pending debounced write on unmount (e.g. window close)
  // rather than silently dropping the last few ticks of an in-progress
  // drag — preferences are low-stakes (unlike diagram content) but there's
  // no reason to lose them for free.
  useEffect(
    () => () => {
      if (writeTimeoutRef.current && pendingWriteRef.current) {
        clearTimeout(writeTimeoutRef.current)
        window.api.writePreferences(pendingWriteRef.current)
      }
    },
    []
  )

  useEffect(() => {
    window.api.readPreferences().then((filePreferences) => {
      if (filePreferences) {
        // Standing rule: every field in AppPreferences must always resolve
        // to a real value, never undefined — main's own readPreferences()
        // already merges over DEFAULT_PREFERENCES (appPreferences.ts), but
        // that's a single point of trust; re-merging here too means a field
        // added to AppPreferences always shows its default immediately,
        // with no dependency on main having been restarted/rebuilt first
        // (bit us once already: isolateOpacity rendered as an empty input
        // under this exact gap).
        setPreferences(normalizePreferences(filePreferences))
        return
      }
      // The preferences file doesn't exist yet — either a fresh install, or
      // an upgrade from a build predating ADR 0053 whose preferences only
      // ever lived in this window's own localStorage (the one place main
      // can't reach). One-time migration: adopt it here and persist it to
      // the real file, so it isn't silently lost on upgrade.
      const legacy = readLegacyLocalStoragePreferences()
      if (legacy) {
        setPreferences(legacy)
        window.api.writePreferences(legacy)
      }
    })
  }, [])

  // Same re-merge as above, for the cross-window broadcast path — a sibling
  // window relays whatever it last had in its own React state (main's
  // preferences:write handler just forwards it verbatim), so this is the
  // one place that guarantees a field this window doesn't know about yet
  // still never becomes undefined here either.
  useEffect(
    () =>
      window.api.onPreferencesChanged((incoming) => setPreferences(normalizePreferences(incoming))),
    []
  )

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch }
      pendingWriteRef.current = next
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current)
      writeTimeoutRef.current = setTimeout(() => {
        writeTimeoutRef.current = null
        pendingWriteRef.current = null
        window.api.writePreferences(next)
      }, WRITE_DEBOUNCE_MS)
      return next
    })
  }, [])

  return { preferences, updatePreferences }
}
