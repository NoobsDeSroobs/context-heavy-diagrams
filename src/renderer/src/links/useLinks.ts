import { useCallback } from 'react'
import type { Node } from '@xyflow/react'
import { isSaveAborted } from '../document/saveAborted'
import { showAlert } from '../ui/alerts'
import type { ContextMenuItem } from '../ui/ContextMenu'
import { useEventCallback } from '../canvas/useEventCallback'

export interface LinksState {
  handleLinkClick: (nodeId: string, clientX: number, clientY: number) => void
}

// Navigating from an element to the diagram it links to, and creating or choosing that link
// (ADR 0005, ADR 0023).
export function useLinks({
  nodes,
  currentPath,
  persistDiagram,
  openContextMenu
}: {
  nodes: Node[]
  currentPath: string | null
  persistDiagram: (
    path: string,
    nodesToSave: Node[],
    opts?: { forceHub?: boolean }
  ) => Promise<Node[]>
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
}): LinksState {
  // Opens (or focuses, if already open elsewhere) a linked diagram in its
  // own window — used by both link-navigation flows below. Never mutates
  // current state on failure — a missing or unreadable link must leave the
  // diagram containing it fully intact (ADR 0005). Does NOT save anything
  // itself — callers persist first if the parent needs it.
  const openLinkedWindow = useCallback(async (parentPath: string, relativePath: string) => {
    try {
      const result = await window.api.openLinkedInNewWindow(parentPath, relativePath)
      if (!result.found) {
        showAlert(`Linked diagram not found at ${result.resolvedPath}`)
      }
    } catch (error) {
      showAlert(
        `Linked diagram at ${relativePath} couldn't be read: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, [])

  // Ctrl/Cmd+click on an already-linked node: persist the parent first —
  // forward link navigation is a natural save point, and skipping this was
  // exactly the bug where a just-created link never survived navigating
  // away from the diagram that holds it (nothing else was ever going to
  // write it to disk once in-memory state gets replaced by the target).
  // Opens the child in a new window rather than replacing this one — see
  // ADR 0023.
  const navigateExistingLink = useCallback(
    async (parentPath: string, relativePath: string) => {
      try {
        await persistDiagram(parentPath, nodes)
      } catch (error) {
        if (isSaveAborted(error)) return
        throw error
      }
      await openLinkedWindow(parentPath, relativePath)
    },
    [nodes, persistDiagram, openLinkedWindow]
  )

  // Creating a new linked diagram: link the node (computed directly, not via
  // updateNodeData + re-reading state later — that update wouldn't have been
  // visible to a synchronous save call in the same tick), persist, then
  // open it in a new window — this window stays exactly as it was (ADR 0023).
  const createAndLink = useCallback(
    async (nodeId: string, parentPath: string, label: string) => {
      try {
        const relativePath = await window.api.createLinkedDiagram(parentPath, label)
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedDiagram: relativePath } } : n
        )
        await persistDiagram(parentPath, updatedNodes, { forceHub: true })
        await openLinkedWindow(parentPath, relativePath)
      } catch (error) {
        if (isSaveAborted(error)) return
        showAlert(
          `Couldn't create linked diagram: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, persistDiagram, openLinkedWindow]
  )

  // Linking to an existing diagram: link and persist, but deliberately stay
  // put — unlike "create new," pointing at something that already exists
  // doesn't imply wanting to jump into it right now.
  const pickAndLink = useCallback(
    async (nodeId: string, parentPath: string) => {
      const relativePath = await window.api.pickExistingLinkedDiagram(parentPath)
      if (!relativePath) return
      try {
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedDiagram: relativePath } } : n
        )
        await persistDiagram(parentPath, updatedNodes, { forceHub: true })
      } catch (error) {
        if (isSaveAborted(error)) return
        showAlert(
          `Couldn't save the link: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, persistDiagram]
  )

  // Ctrl/Cmd+click entry point for linked-diagram navigation, exposed via DiagramContext. A node
  // without a link gets a chooser (create new / link existing) at the click point through the
  // generic ContextMenu; a linked node opens straight into a new window (ADR 0023).
  // useEventCallback, not useCallback: the body closes over nodes, currentPath and link
  // sub-handlers that depend on the whole diagram state, so a useCallback would change identity on
  // every edit and, through the memoized DiagramContext value, re-render every node and edge (ADR
  // 0073). It is only called from a Ctrl/Cmd+click, so always-latest-closure semantics are safe.
  const handleLinkClick = useEventCallback((nodeId: string, clientX: number, clientY: number) => {
    if (!currentPath) {
      showAlert('Save the diagram before linking to another diagram.')
      return
    }
    const node = nodes.find((n) => n.id === nodeId)
    const linkedPath =
      typeof node?.data?.linkedDiagram === 'string'
        ? (node.data.linkedDiagram as string)
        : undefined
    if (linkedPath) {
      navigateExistingLink(currentPath, linkedPath)
      return
    }
    const label = String(node?.data?.label ?? 'diagram')
    openContextMenu(clientX, clientY, [
      {
        label: 'Create new linked diagram…',
        onSelect: () => createAndLink(nodeId, currentPath, label)
      },
      { label: 'Link to existing diagram…', onSelect: () => pickAndLink(nodeId, currentPath) }
    ])
  })

  return { handleLinkClick }
}
