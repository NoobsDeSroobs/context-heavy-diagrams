import { useEffect, useState } from 'react'
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type AppPreferences
} from '@shared/preferences/preferences'

// The app's preferences for a window that only draws, such as the compare window: read once and
// kept in step with the other windows, never written. Unlike usePreferences it neither saves a
// change nor migrates the pre-file localStorage values (that write belongs to an editor window), so
// the window's bridge does not need a way to write preferences at all.
export function useReadOnlyPreferences(): { preferences: AppPreferences } {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    let cancelled = false
    window.api.readPreferences().then((file) => {
      if (!cancelled && file) setPreferences(normalizePreferences(file))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      window.api.onPreferencesChanged((incoming) => setPreferences(normalizePreferences(incoming))),
    []
  )

  return { preferences }
}
