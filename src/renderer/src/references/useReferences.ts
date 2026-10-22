import { useCallback, useState } from 'react'
import { showAlert } from '../ui/alerts'
import type { CanvasApi } from '../canvas/canvasApi'

export interface ReferenceWindowEntry {
  nodeId: string
  path: string
}

export interface ReferencesState {
  referenceWindows: ReferenceWindowEntry[]
  setReferenceWindows: React.Dispatch<React.SetStateAction<ReferenceWindowEntry[]>>
  openReferenceWindow: (nodeId: string, path: string) => void
  closeReferenceWindow: (nodeId: string, path: string) => void
  addReferencesToNode: (nodeId: string) => Promise<void>
  removeReferenceFromNode: (nodeId: string, path: string) => void
  openReferencesFor: (nodeId: string) => void
}

// Reference images (ADR 0069). The floating viewer windows are pure session state, one entry per
// (entity, image path), gone on reload; the paths on node.data.references are the only persisted
// part. The diagram-wide inventory panel's open flag lives with the other panels.
export function useReferences({
  rfInstance,
  setNodes,
  pushSnapshot,
  currentPath
}: CanvasApi): ReferencesState {
  const [referenceWindows, setReferenceWindows] = useState<ReferenceWindowEntry[]>([])

  const openReferenceWindow = useCallback((nodeId: string, path: string) => {
    setReferenceWindows((prev) =>
      prev.some((w) => w.nodeId === nodeId && w.path === path) ? prev : [...prev, { nodeId, path }]
    )
  }, [])

  const closeReferenceWindow = useCallback((nodeId: string, path: string) => {
    setReferenceWindows((prev) => prev.filter((w) => !(w.nodeId === nodeId && w.path === path)))
  }, [])

  const addReferencesToNode = useCallback(
    async (nodeId: string) => {
      if (!currentPath) {
        showAlert('Save the diagram before adding reference images.')
        return
      }
      let added: string[] | null
      try {
        added = await window.api.pickAndCopyReferences(currentPath)
      } catch (err) {
        // Surface it rather than failing silently — most often a stale
        // preload bundle after adding this API (needs a full app restart),
        // occasionally a real copy/permissions error.
        showAlert(
          `Could not add reference images: ${err instanceof Error ? err.message : String(err)}`
        )
        return
      }
      if (!added || added.length === 0) return
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = Array.isArray(n.data?.references) ? (n.data.references as string[]) : []
          return { ...n, data: { ...n.data, references: [...existing, ...added] } }
        })
      )
      setReferenceWindows((prev) => [
        ...prev,
        ...added
          .filter((path) => !prev.some((w) => w.nodeId === nodeId && w.path === path))
          .map((path) => ({ nodeId, path }))
      ])
    },
    [currentPath, pushSnapshot, setNodes]
  )

  const removeReferenceFromNode = useCallback(
    (nodeId: string, path: string) => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = Array.isArray(n.data?.references) ? (n.data.references as string[]) : []
          const next = existing.filter((p) => p !== path)
          return { ...n, data: { ...n.data, references: next.length > 0 ? next : undefined } }
        })
      )
      setReferenceWindows((prev) => prev.filter((w) => !(w.nodeId === nodeId && w.path === path)))
    },
    [pushSnapshot, setNodes]
  )

  // DiagramContext entry point — entity/container right-click "Reference
  // images…": open a window for each of the node's references, or jump
  // straight to the file picker when it has none yet.
  const openReferencesFor = useCallback(
    (nodeId: string) => {
      // Read live node data off the React Flow instance rather than closing
      // over `nodes` — keeps this callback stable so it doesn't bust the
      // memoized DiagramContext value on every node change (ADR 0056).
      const node = rfInstance.getNode(nodeId)
      const refs = Array.isArray(node?.data?.references) ? (node.data.references as string[]) : []
      if (refs.length === 0) {
        void addReferencesToNode(nodeId)
        return
      }
      setReferenceWindows((prev) => [
        ...prev,
        ...refs
          .filter((path) => !prev.some((w) => w.nodeId === nodeId && w.path === path))
          .map((path) => ({ nodeId, path }))
      ])
    },
    [rfInstance, addReferencesToNode]
  )

  return {
    referenceWindows,
    setReferenceWindows,
    openReferenceWindow,
    closeReferenceWindow,
    addReferencesToNode,
    removeReferenceFromNode,
    openReferencesFor
  }
}
