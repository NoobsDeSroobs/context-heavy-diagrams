import { useCallback, useEffect, useState } from 'react'
import type { MetamodelListing } from '@shared/conformance/metamodelsFolder'
import type { Metamodel } from '@shared/conformance/metamodel'
import { validateMetamodel } from '@shared/conformance/validate'

// Which diagram metamodel the Diagnostics panel checks the open diagram against (ADR 0131).
// Session-only and per window: nothing about it is saved, in the diagram or in Preferences. The
// metamodel is read again whenever the list is refreshed, so editing the file and pressing Refresh is
// the whole loop.
export interface ConformanceState {
  listing: MetamodelListing[]
  selectedId: string
  select: (id: string) => void
  // The chosen metamodel once it validates; otherwise why not.
  metamodel: Metamodel | null
  problems: string[]
  refresh: () => void
}

export function useConformance(active: boolean): ConformanceState {
  const [listing, setListing] = useState<MetamodelListing[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loaded, setLoaded] = useState<{
    id: string
    metamodel: Metamodel | null
    problems: string[]
  } | null>(null)
  const [tick, setTick] = useState(0)

  // The list is only needed while the panel is open, and again after a Refresh.
  useEffect(() => {
    if (!active) return
    let live = true
    void window.api.listMetamodels().then((next) => {
      if (live) setListing(next)
    })
    return () => {
      live = false
    }
  }, [active, tick])

  useEffect(() => {
    if (!active || selectedId === '') return
    let live = true
    void window.api.loadMetamodel(selectedId).then((text) => {
      if (!live) return
      if (text === null) {
        setLoaded({
          id: selectedId,
          metamodel: null,
          problems: ['The metamodel file cannot be read.']
        })
        return
      }
      try {
        const { metamodel, errors } = validateMetamodel(JSON.parse(text))
        setLoaded({ id: selectedId, metamodel, problems: errors })
      } catch (error) {
        setLoaded({
          id: selectedId,
          metamodel: null,
          problems: [
            `The metamodel is not valid JSON: ${error instanceof Error ? error.message : error}`
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
    metamodel: current?.metamodel ?? null,
    problems: current?.problems ?? [],
    refresh
  }
}
