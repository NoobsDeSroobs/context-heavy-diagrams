import { useCallback, useEffect, useRef, useState } from 'react'
import { anyNoteDirty, type NoteShadow } from '@shared/document/documentSave'

// Unsaved-changes tracking (ADR 0040): markDirty is called at every site that mutates something
// toDiagramFile() serializes, not derived from the undo stack, which covers only nodes/edges and
// not requiredTags/highlights/legend/noteShadows. Session-only state (enabledHighlightIds,
// panel-open flags, ...) never touches it.
// Dirty state is per file (ADR 0092): the diagram, the "hub", has its own flag and each detail
// note has one inside its shadow. `isDirty` (close prompt, autosave, reload confirms) is "any of
// them".
export function useDirtyState(): {
  hubDirty: boolean
  setHubDirty: React.Dispatch<React.SetStateAction<boolean>>
  noteShadows: Record<string, NoteShadow>
  setNoteShadows: React.Dispatch<React.SetStateAction<Record<string, NoteShadow>>>
  noteShadowsRef: React.MutableRefObject<Record<string, NoteShadow>>
  isDirty: boolean
  markDirty: () => void
} {
  const [hubDirty, setHubDirty] = useState(false)
  // In-memory copies ("shadows") of the detail notes that are open or have
  // unsaved edits — content, baseline and dirty flag per note (documentSave.ts).
  // A note nobody has touched has no entry: it is just a file on disk.
  const [noteShadows, setNoteShadows] = useState<Record<string, NoteShadow>>({})
  const isDirty = hubDirty || anyNoteDirty(noteShadows)
  // The latest shadows, readable from callbacks that must not depend on them
  // (a diagram reload needs to know which notes have unsaved edits).
  const noteShadowsRef = useRef(noteShadows)
  useEffect(() => {
    noteShadowsRef.current = noteShadows
  })
  const markDirty = useCallback(() => setHubDirty(true), [])
  return { hubDirty, setHubDirty, noteShadows, setNoteShadows, noteShadowsRef, isDirty, markDirty }
}
