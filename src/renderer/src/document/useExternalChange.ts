import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stamp } from '@shared/document/documentSave'

export interface ExternalChangeState {
  hubBaselineRef: React.MutableRefObject<{ path: string | null; stamp: Stamp }>
  externalChangeStamp: string | null
  setExternalChangeStamp: React.Dispatch<React.SetStateAction<string | null>>
  dismissedStampRef: React.MutableRefObject<string | null>
  dismissExternalChange: () => void
}

// Noticing that the diagram file changed outside the app (ADR 0091).
export function useExternalChange(currentPath: string | null): ExternalChangeState {
  // What we last read/wrote of the diagram file — the baseline the window-focus
  // check and the save-time conflict check compare against.
  const hubBaselineRef = useRef<{ path: string | null; stamp: Stamp }>({
    path: null,
    stamp: null
  })
  // Outside-the-app change notice for the diagram file: externalChangeStamp is
  // non-null while the "changed on disk" banner shows; dismissedStampRef
  // remembers which specific change the user ignored so a later focus doesn't
  // re-show it (the save-time check still fires — dismissing never touches the
  // baseline).
  const [externalChangeStamp, setExternalChangeStamp] = useState<string | null>(null)
  const dismissedStampRef = useRef<string | null>(null)

  // Window focus is when an outside edit (another editor, git, Claude) is
  // most likely to have just happened — a cheap stat, no watcher/polling
  // (ADR 0091). Shows the toolbar banner; dismissing remembers this specific
  // change but the save-time guard still fires.
  useEffect(() => {
    if (!currentPath) return undefined
    let cancelled = false
    const check = async (): Promise<void> => {
      const baseline = hubBaselineRef.current
      if (baseline.path !== currentPath) return
      const [result] = await window.api.checkFiles(currentPath, [
        { relPath: null, stamp: baseline.stamp }
      ])
      if (cancelled) return
      setExternalChangeStamp(
        result.changed && result.stamp !== dismissedStampRef.current ? result.stamp : null
      )
    }
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [currentPath])

  const dismissExternalChange = useCallback(() => {
    dismissedStampRef.current = externalChangeStamp
    setExternalChangeStamp(null)
  }, [externalChangeStamp])

  return {
    hubBaselineRef,
    externalChangeStamp,
    setExternalChangeStamp,
    dismissedStampRef,
    dismissExternalChange
  }
}
