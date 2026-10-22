import { useCallback, useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { AggregateMethod, CombineMethod, DiagramSecurity, RiskCell } from '@shared/diagram'
import type { SecurityCrawlResult } from '@shared/threat-matrix/threatMatrixMath'
import type { CanvasApi } from '../canvas/canvasApi'
import type { useHistory } from '../canvas/useHistory'
import { useEventCallback } from '../canvas/useEventCallback'

export interface ThreatMatrixState {
  security: DiagramSecurity
  setSecurity: React.Dispatch<React.SetStateAction<DiagramSecurity>>
  securityCombineMethod: CombineMethod
  setSecurityCombineMethod: React.Dispatch<React.SetStateAction<CombineMethod>>
  securityAggregateMethod: AggregateMethod
  setSecurityAggregateMethod: React.Dispatch<React.SetStateAction<AggregateMethod>>
  securityCrawl: SecurityCrawlResult | null
  updateSecurity: (next: DiagramSecurity) => void
  refreshSecurityCrawl: () => void
  updateNodeSecurityCell: (nodeId: string, threatId: string, cell: RiskCell | null) => void
  removeSecurityThreat: (threatId: string) => void
  removeSecurityEntity: (nodeId: string) => void
}

type History = ReturnType<typeof useHistory>

// The Security Matrix persona's data (ADR 0082). Which persona is showing stays with the canvas;
// the crawl below refreshes when it becomes the matrix.
export function useThreatMatrix(
  { graphRef, setNodes, pushSnapshot, markDirty, currentPath }: CanvasApi,
  persona: 'diagram' | 'matrix',
  { setPast, setFuture }: Pick<History, 'setPast' | 'setFuture'>
): ThreatMatrixState {
  // Threat/risk model (ADR 0082) — same file-scoped / reset-on-load
  // treatment as the catalogs above. Kept as a non-null object with empty
  // arrays when the Security Matrix has never been used; serialization
  // drops it when empty. Per-element assessment cells live on
  // node.data.security, not here.
  const [security, setSecurity] = useState<DiagramSecurity>({ threats: [], matrixEntityIds: [] })
  // Matrix calculation modes are session-only, not persisted (ADR 0088) —
  // deliberately NOT reset on file open, so they behave as a property of
  // the active matrix view and flow uniformly down a linked-diagram tree.
  const [securityCombineMethod, setSecurityCombineMethod] = useState<CombineMethod>('multiply')
  const [securityAggregateMethod, setSecurityAggregateMethod] = useState<AggregateMethod>('average')

  // Diagram-level config: threat catalog, matrix membership, hide lists,
  // scales, methods. Not part of undo history (like the other catalogs).
  const updateSecurity = useCallback(
    (next: DiagramSecurity) => {
      setSecurity(next)
      markDirty()
    },
    [markDirty]
  )

  // Recursive rollup (ADR 0088). The crawl walks each linked matrix entity's
  // subtree in the main process; the result is cached here for the session
  // and only re-fetched on entering the matrix persona or an explicit
  // Refresh — never persisted, so a derived value can't go stale.
  const [securityCrawl, setSecurityCrawl] = useState<SecurityCrawlResult | null>(null)
  const refreshSecurityCrawl = useEventCallback(() => {
    if (!currentPath) {
      setSecurityCrawl(null)
      return
    }
    const nodeById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
    const links = security.matrixEntityIds.flatMap((entityId) => {
      const link = nodeById.get(entityId)?.data?.linkedDiagram
      return typeof link === 'string' && link.trim() !== ''
        ? [{ entityId, relativePath: link }]
        : []
    })
    if (links.length === 0) {
      setSecurityCrawl({ columns: {}, warnings: [] })
      return
    }
    void window.api.crawlLinkedSecurity(currentPath, links).then(setSecurityCrawl)
  })

  // Crawl on entering the matrix persona (ADR 0088). No cooldown throttle
  // yet — that's a follow-up; today it's this + the explicit Refresh button.
  useEffect(() => {
    if (persona === 'matrix') refreshSecurityCrawl()
  }, [persona, refreshSecurityCrawl])

  // One assessment cell on an entity (`null` clears it). Routed through the
  // node history — a cell edit is undoable.
  const updateNodeSecurityCell = useCallback(
    (nodeId: string, threatId: string, cell: RiskCell | null) => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = (n.data?.security as Record<string, RiskCell> | undefined) ?? {}
          const nextSec = { ...existing }
          if (cell === null) delete nextSec[threatId]
          else nextSec[threatId] = cell
          const data = { ...n.data }
          if (Object.keys(nextSec).length > 0) data.security = nextSec
          else delete data.security
          return { ...n, data }
        })
      )
      markDirty()
    },
    [setNodes, pushSnapshot, markDirty]
  )

  // Removing a threat / an entity from the matrix is destructive and deliberately NOT an undo step;
  // it also
  // strips the affected cells from every history snapshot so an unrelated
  // undo can't resurrect orphan `data.security` entries.
  const removeSecurityThreat = useCallback(
    (threatId: string) => {
      const strip = (nds: Node[]): Node[] =>
        nds.map((n) => {
          const cells = n.data?.security as Record<string, RiskCell> | undefined
          if (!cells || !(threatId in cells)) return n
          const nextSec = { ...cells }
          delete nextSec[threatId]
          const data = { ...n.data }
          if (Object.keys(nextSec).length > 0) data.security = nextSec
          else delete data.security
          return { ...n, data }
        })
      setNodes(strip)
      setPast((p) => p.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setFuture((f) => f.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setSecurity((cur) => ({
        ...cur,
        threats: cur.threats.filter((t) => t.id !== threatId),
        hiddenThreatIds: cur.hiddenThreatIds?.filter((id) => id !== threatId)
      }))
      markDirty()
    },
    [setNodes, markDirty, setPast, setFuture]
  )

  const removeSecurityEntity = useCallback(
    (nodeId: string) => {
      const strip = (nds: Node[]): Node[] =>
        nds.map((n) => {
          if (n.id !== nodeId || !n.data?.security) return n
          const data = { ...n.data }
          delete data.security
          return { ...n, data }
        })
      setNodes(strip)
      setPast((p) => p.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setFuture((f) => f.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setSecurity((cur) => ({
        ...cur,
        matrixEntityIds: cur.matrixEntityIds.filter((id) => id !== nodeId),
        hiddenEntityIds: cur.hiddenEntityIds?.filter((id) => id !== nodeId)
      }))
      markDirty()
    },
    [setNodes, markDirty, setPast, setFuture]
  )

  return {
    security,
    setSecurity,
    securityCombineMethod,
    setSecurityCombineMethod,
    securityAggregateMethod,
    setSecurityAggregateMethod,
    securityCrawl,
    updateSecurity,
    refreshSecurityCrawl,
    updateNodeSecurityCell,
    removeSecurityThreat,
    removeSecurityEntity
  }
}
