import { useCallback, useEffect, useState } from 'react'
import type { ProfileListing } from '@shared/conformance/profilesFolder'
import type { Profile } from '@shared/conformance/profile'
import { validateProfile } from '@shared/conformance/validate'

// Which conformance profile the Diagnostics panel checks the open diagram against (ADR 0131).
// Session-only and per window: nothing about it is saved, in the diagram or in Preferences. The
// profile is read again whenever the list is refreshed, so editing the file and pressing Refresh is
// the whole loop.
export interface ConformanceState {
  listing: ProfileListing[]
  selectedId: string
  select: (id: string) => void
  // The chosen profile once it validates; otherwise why not.
  profile: Profile | null
  problems: string[]
  refresh: () => void
}

export function useConformance(active: boolean): ConformanceState {
  const [listing, setListing] = useState<ProfileListing[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loaded, setLoaded] = useState<{
    id: string
    profile: Profile | null
    problems: string[]
  } | null>(null)
  const [tick, setTick] = useState(0)

  // The list is only needed while the panel is open, and again after a Refresh.
  useEffect(() => {
    if (!active) return
    let live = true
    void window.api.listProfiles().then((next) => {
      if (live) setListing(next)
    })
    return () => {
      live = false
    }
  }, [active, tick])

  useEffect(() => {
    if (!active || selectedId === '') return
    let live = true
    void window.api.loadProfile(selectedId).then((text) => {
      if (!live) return
      if (text === null) {
        setLoaded({ id: selectedId, profile: null, problems: ['The profile file cannot be read.'] })
        return
      }
      try {
        const { profile, errors } = validateProfile(JSON.parse(text))
        setLoaded({ id: selectedId, profile, problems: errors })
      } catch (error) {
        setLoaded({
          id: selectedId,
          profile: null,
          problems: [
            `The profile is not valid JSON: ${error instanceof Error ? error.message : error}`
          ]
        })
      }
    })
    return () => {
      live = false
    }
  }, [active, selectedId, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])
  const current = selectedId !== '' && loaded?.id === selectedId ? loaded : null
  return {
    listing,
    selectedId,
    select: setSelectedId,
    profile: current?.profile ?? null,
    problems: current?.problems ?? [],
    refresh
  }
}
