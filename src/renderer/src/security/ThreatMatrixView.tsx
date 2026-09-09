import { useState, useMemo, type MouseEvent } from 'react'
import type { Node } from '@xyflow/react'
import type {
  AggregateMethod,
  CombineMethod,
  DiagramSecurity,
  RiskCell,
  SecurityThreat
} from '@shared/diagram'
import {
  cellScore,
  aggregateScores,
  totalSecurityScore,
  threatScoreFor,
  threatNamesInSubtree,
  normalizeThreatName,
  COMBINE_METHOD_LABELS,
  AGGREGATE_METHOD_LABELS,
  BLANK_RISK_CELL,
  type CrawledMatrix,
  type SecurityCrawlResult
} from '@shared/threatMatrixMath'
import { effectiveScales } from './threatMatrixScale'
import ThreatMatrixCellEditor from './ThreatMatrixCellEditor'
import ThreatMatrixScaleReference from './ThreatMatrixScaleReference'
import ThreatMatrixManagePanel from './ThreatMatrixManagePanel'

export interface ThreatMatrixViewProps {
  // React Flow nodes — the matrix's columns are a subset of the 'shape'
  // nodes, and each cell's data lives on `node.data.security`.
  nodes: Node[]
  // Always provided (Canvas keeps `{ threats: [], matrixShapeIds: [] }`
  // when the feature is unused), so the view never deals with null.
  security: DiagramSecurity
  // Calculation modes — session state owned by Canvas, NOT persisted
  // (ADR 0088). Changing them recomputes the view; no file write.
  combineMethod: CombineMethod
  aggregateMethod: AggregateMethod
  onCombineMethodChange: (next: CombineMethod) => void
  onAggregateMethodChange: (next: AggregateMethod) => void
  // Recursive rollup (ADR 0088) — `null` until the first crawl resolves.
  // Keyed by root matrix shape id; only shapes with a `linkedDiagram` appear.
  crawl: SecurityCrawlResult | null
  onRefreshCrawl: () => void
  onOpenLinkedDiagram: (relativePath: string) => void
  // Config changes: hide toggles, add threat/shape, rename.
  onChange: (next: DiagramSecurity) => void
  // Destructive — Canvas also clears the affected `data.security` cells.
  onRemoveThreat: (threatId: string) => void
  onRemoveShape: (nodeId: string) => void
  // One cell; `null` clears it.
  onCellChange: (nodeId: string, threatId: string, cell: RiskCell | null) => void
}

interface EditingCell {
  threatId: string
  nodeId: string
  anchorRect: DOMRect
}

interface Breakdown {
  threatName: string
  shapeLabel: string
  relativePath: string
  value: number | null
  contributions: number
  anchorRect: DOMRect
}

// A column is one of three kinds: a normal editable leaf, a derived column
// rolled up from a linked diagram, or a broken one whose link didn't resolve.
type ColumnInfo =
  | { kind: 'normal' }
  | { kind: 'derived'; relativePath: string; matrix: CrawledMatrix }
  | { kind: 'broken'; relativePath: string }

// Per-cell resolution: the number to show (or null), plus how it got there.
interface CellInfo {
  value: number | null
  kind: 'assessed' | 'unassessed' | 'derived' | 'derived-empty' | 'broken'
}

function nodeSecurity(node: Node | undefined): Record<string, RiskCell> {
  const s = node?.data?.security
  return s && typeof s === 'object' ? (s as Record<string, RiskCell>) : {}
}

function newThreatId(): string {
  return `threat-${crypto.randomUUID()}`
}

const BREAKDOWN_WIDTH = 260

// The Security Matrix — a read-time view over every member shape's own
// `data.security`, the diagram-level `security` config (ADR 0082), and the
// recursive rollup of every linked matrix shape's subtree (ADR 0088). It
// owns no persisted state: edits go back through the callbacks; the crawl
// result is a session cache passed in from Canvas.
export default function ThreatMatrixView({
  nodes,
  security,
  combineMethod,
  aggregateMethod,
  onCombineMethodChange,
  onAggregateMethodChange,
  crawl,
  onRefreshCrawl,
  onOpenLinkedDiagram,
  onChange,
  onRemoveThreat,
  onRemoveShape,
  onCellChange
}: ThreatMatrixViewProps): React.JSX.Element {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [managePanelAnchor, setManagePanelAnchor] = useState<DOMRect | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)

  const { probabilityScale, consequenceScale } = effectiveScales(security)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const hiddenThreatIds = new Set(security.hiddenThreatIds ?? [])
  const hiddenShapeIds = new Set(security.hiddenShapeIds ?? [])

  const visibleThreats = security.threats.filter((t) => !hiddenThreatIds.has(t.id))
  const visibleShapeIds = security.matrixShapeIds.filter(
    (id) => !hiddenShapeIds.has(id) && nodeById.get(id)?.type === 'shape'
  )

  const shapeLabel = (id: string): string =>
    String(nodeById.get(id)?.data?.label ?? '(missing shape)')

  const columnInfo = (shapeId: string): ColumnInfo => {
    const c = crawl?.columns[shapeId]
    if (!c) return { kind: 'normal' }
    return c.kind === 'resolved'
      ? { kind: 'derived', relativePath: c.relativePath, matrix: c.matrix }
      : { kind: 'broken', relativePath: c.relativePath }
  }

  // One cell's number + provenance. Derived cells recompute live from the
  // crawl using the active modes (ADR 0088) — no recrawl on a mode change.
  const cellInfo = (threat: SecurityThreat, shapeId: string): CellInfo => {
    const col = columnInfo(shapeId)
    if (col.kind === 'broken') return { value: null, kind: 'broken' }
    if (col.kind === 'derived') {
      const s = threatScoreFor(
        col.matrix,
        normalizeThreatName(threat.name),
        combineMethod,
        aggregateMethod
      )
      return s === null ? { value: null, kind: 'derived-empty' } : { value: s, kind: 'derived' }
    }
    const cell = nodeSecurity(nodeById.get(shapeId))[threat.id]
    return cell
      ? { value: cellScore(cell, combineMethod), kind: 'assessed' }
      : { value: null, kind: 'unassessed' }
  }

  const nonNull = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x !== null)

  const rowScores = visibleThreats.map((t) => {
    const vals = nonNull(visibleShapeIds.map((id) => cellInfo(t, id).value))
    return vals.length > 0 ? aggregateScores(vals, aggregateMethod) : null
  })
  const columnScores = visibleShapeIds.map((id) => {
    const vals = nonNull(visibleThreats.map((t) => cellInfo(t, id).value))
    return vals.length > 0 ? aggregateScores(vals, aggregateMethod) : null
  })
  const grandTotal = totalSecurityScore(
    nonNull(rowScores),
    nonNull(columnScores),
    combineMethod,
    aggregateMethod
  )

  // Completeness (ADR 0082/0088) — over EVERY matrixShape x EVERY threat,
  // hidden included. A leaf gap is a missing hand assessment; a derived gap
  // is a hole downstream (nothing assessed there, or a broken link).
  let missingLeaf = 0
  let missingDownstream = 0
  for (const shapeId of security.matrixShapeIds) {
    for (const threat of security.threats) {
      const kind = cellInfo(threat, shapeId).kind
      if (kind === 'unassessed') missingLeaf += 1
      else if (kind === 'derived-empty' || kind === 'broken') missingDownstream += 1
    }
  }
  const totalCells = security.matrixShapeIds.length * security.threats.length
  const missingCells = missingLeaf + missingDownstream

  // Threat names assessed only in linked subtrees, not in this matrix's own
  // catalog — surfaced, not silently dropped (ADR 0088).
  const downstreamOnlyThreats = useMemo(() => {
    if (!crawl) return [] as string[]
    const catalog = new Set(security.threats.map((t) => normalizeThreatName(t.name)))
    const seen = new Set<string>()
    for (const col of Object.values(crawl.columns)) {
      if (col.kind !== 'resolved') continue
      for (const name of threatNamesInSubtree(col.matrix)) if (!catalog.has(name)) seen.add(name)
    }
    return [...seen].sort()
  }, [crawl, security.threats])

  const crawlNotes: string[] = [
    ...(crawl?.warnings ?? []),
    ...(downstreamOnlyThreats.length > 0
      ? [
          `Linked diagrams also assess: ${downstreamOnlyThreats.join(', ')} — add these as threats to roll them up.`
        ]
      : [])
  ]

  const openEditor = (
    threatId: string,
    nodeId: string,
    event: MouseEvent<HTMLTableCellElement>
  ): void => {
    setEditingCell({ threatId, nodeId, anchorRect: event.currentTarget.getBoundingClientRect() })
  }

  const openBreakdown = (
    threat: SecurityThreat,
    shapeId: string,
    info: CellInfo,
    event: MouseEvent<HTMLTableCellElement>
  ): void => {
    const col = columnInfo(shapeId)
    if (col.kind !== 'derived') return
    const norm = normalizeThreatName(threat.name)
    const contributions = countContributions(col.matrix, norm)
    setBreakdown({
      threatName: threat.name,
      shapeLabel: shapeLabel(shapeId),
      relativePath: col.relativePath,
      value: info.value,
      contributions,
      anchorRect: event.currentTarget.getBoundingClientRect()
    })
  }

  // --- config-model edits ---
  const patch = (next: Partial<DiagramSecurity>): void => onChange({ ...security, ...next })

  const addThreat = (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed || security.threats.some((t) => t.name === trimmed)) return
    patch({ threats: [...security.threats, { id: newThreatId(), name: trimmed }] })
  }
  const renameThreat = (id: string, name: string): void =>
    patch({ threats: security.threats.map((t) => (t.id === id ? { ...t, name } : t)) })
  const toggleThreatHidden = (id: string): void =>
    patch({
      hiddenThreatIds: hiddenThreatIds.has(id)
        ? (security.hiddenThreatIds ?? []).filter((x) => x !== id)
        : [...(security.hiddenThreatIds ?? []), id]
    })

  const addShape = (nodeId: string): void => {
    if (security.matrixShapeIds.includes(nodeId)) return
    patch({ matrixShapeIds: [...security.matrixShapeIds, nodeId] })
  }
  const toggleShapeHidden = (nodeId: string): void =>
    patch({
      hiddenShapeIds: hiddenShapeIds.has(nodeId)
        ? (security.hiddenShapeIds ?? []).filter((x) => x !== nodeId)
        : [...(security.hiddenShapeIds ?? []), nodeId]
    })

  const assessableShapes = nodes
    .filter((n) => n.type === 'shape' && !security.matrixShapeIds.includes(n.id))
    .map((n) => ({ id: n.id, label: String(n.data?.label ?? n.id) }))

  // Bulk-add every shape not already in the matrix (ADR 0088, item 1) —
  // one action instead of picking them one at a time. Scope filtering
  // (in/out-of-scope tag, per-shape opt-out) comes with the tag-mapping work.
  const addAllShapes = (): void => {
    const toAdd = assessableShapes.map((s) => s.id)
    if (toAdd.length > 0) patch({ matrixShapeIds: [...security.matrixShapeIds, ...toAdd] })
  }

  const nothingToShow = visibleThreats.length === 0 || visibleShapeIds.length === 0

  const cellDisplay = (info: CellInfo): string => {
    if (info.kind === 'broken') return ''
    if (info.value === null) return '—'
    return info.kind === 'assessed' ? String(info.value) : info.value.toFixed(1)
  }

  const cellClass = (info: CellInfo): string => {
    switch (info.kind) {
      case 'assessed':
        return 'threat-matrix-cell'
      case 'unassessed':
        return 'threat-matrix-cell threat-matrix-cell-unassessed'
      case 'derived':
        return 'threat-matrix-cell threat-matrix-cell-derived'
      case 'derived-empty':
        return 'threat-matrix-cell threat-matrix-cell-derived threat-matrix-cell-unassessed'
      case 'broken':
        return 'threat-matrix-cell threat-matrix-cell-broken'
    }
  }

  const cellTitle = (info: CellInfo): string => {
    switch (info.kind) {
      case 'assessed':
        return 'Click to edit'
      case 'unassessed':
        return 'Not assessed — click to assess'
      case 'derived':
        return 'Rolled up from a linked diagram — click for details'
      case 'derived-empty':
        return 'Not assessed anywhere in the linked diagram'
      case 'broken':
        return 'Linked diagram not found — fix the link on the shape'
    }
  }

  return (
    <div className="threat-matrix-view">
      <div className="threat-matrix-main">
        <div className="threat-matrix-settings">
          <label className="threat-matrix-settings-field">
            Cell score
            <select
              value={combineMethod}
              onChange={(event) => onCombineMethodChange(event.target.value as CombineMethod)}
            >
              {Object.entries(COMBINE_METHOD_LABELS).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="threat-matrix-settings-field">
            Threat/vulnerability score
            <select
              value={aggregateMethod}
              onChange={(event) => onAggregateMethodChange(event.target.value as AggregateMethod)}
            >
              {Object.entries(AGGREGATE_METHOD_LABELS).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="threat-matrix-refresh-button"
            onClick={onRefreshCrawl}
            title="Re-read the linked diagrams and recompute derived columns"
          >
            ↻ Refresh links
          </button>
          <button
            type="button"
            className="threat-matrix-manage-button"
            onClick={(event) => setManagePanelAnchor(event.currentTarget.getBoundingClientRect())}
          >
            Manage matrix…
          </button>
        </div>

        {totalCells > 0 && (
          <p
            className={
              missingCells > 0
                ? 'threat-matrix-completeness threat-matrix-completeness-warn'
                : 'threat-matrix-completeness'
            }
          >
            {missingCells > 0
              ? `⚠ ${missingCells} of ${totalCells} assessments not entered` +
                (missingDownstream > 0 ? ` (${missingDownstream} in linked diagrams)` : '') +
                (security.hiddenThreatIds?.length || security.hiddenShapeIds?.length
                  ? ' — hidden rows/columns included'
                  : '')
              : `✓ All ${totalCells} assessments entered`}
          </p>
        )}

        {crawlNotes.map((note, i) => (
          <p key={i} className="threat-matrix-note">
            {note}
          </p>
        ))}

        {nothingToShow ? (
          <p className="threat-matrix-empty">
            {security.threats.length === 0 &&
              'Add a threat, then add the shapes to assess against it — '}
            {security.threats.length > 0 &&
              security.matrixShapeIds.length === 0 &&
              'Add the shapes to assess — '}
            {security.threats.length > 0 &&
              security.matrixShapeIds.length > 0 &&
              'Everything is hidden — '}
            use <strong>Manage matrix…</strong> above.
          </p>
        ) : (
          <table className="threat-matrix-table">
            <thead>
              <tr>
                <th className="threat-matrix-corner" />
                {visibleShapeIds.map((id) => {
                  const col = columnInfo(id)
                  return (
                    <th
                      key={id}
                      className={
                        col.kind === 'derived'
                          ? 'threat-matrix-col-derived'
                          : col.kind === 'broken'
                            ? 'threat-matrix-col-broken'
                            : undefined
                      }
                      title={
                        col.kind === 'derived'
                          ? `Rolled up from ${col.relativePath}`
                          : col.kind === 'broken'
                            ? `Linked diagram not found: ${col.relativePath}`
                            : undefined
                      }
                    >
                      {shapeLabel(id)}
                      {col.kind === 'derived' && ' 🔗'}
                      {col.kind === 'broken' && ' ⚠'}
                    </th>
                  )
                })}
                <th className="threat-matrix-aggregate-header">Threat score</th>
              </tr>
            </thead>
            <tbody>
              {visibleThreats.map((threat, rowIndex) => (
                <tr key={threat.id}>
                  <th scope="row">{threat.name}</th>
                  {visibleShapeIds.map((shapeId) => {
                    const info = cellInfo(threat, shapeId)
                    return (
                      <td
                        key={shapeId}
                        className={cellClass(info)}
                        title={cellTitle(info)}
                        onClick={(event) => {
                          if (info.kind === 'assessed' || info.kind === 'unassessed') {
                            openEditor(threat.id, shapeId, event)
                          } else if (info.kind === 'derived' || info.kind === 'derived-empty') {
                            openBreakdown(threat, shapeId, info, event)
                          }
                        }}
                      >
                        {cellDisplay(info)}
                      </td>
                    )
                  })}
                  <td className="threat-matrix-aggregate">
                    {rowScores[rowIndex] === null ? '—' : rowScores[rowIndex]!.toFixed(1)}
                  </td>
                </tr>
              ))}
              <tr className="threat-matrix-aggregate-row">
                <th scope="row">Vulnerability score</th>
                {columnScores.map((score, columnIndex) => (
                  <td key={visibleShapeIds[columnIndex]} className="threat-matrix-aggregate">
                    {score === null ? '—' : score.toFixed(1)}
                  </td>
                ))}
                <td className="threat-matrix-grand-total">{grandTotal.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <ThreatMatrixScaleReference
        probabilityScale={probabilityScale}
        consequenceScale={consequenceScale}
      />

      {editingCell &&
        (() => {
          const existing = nodeSecurity(nodeById.get(editingCell.nodeId))[editingCell.threatId]
          const threatName =
            security.threats.find((t) => t.id === editingCell.threatId)?.name ?? '(threat)'
          return (
            <ThreatMatrixCellEditor
              threat={threatName}
              service={shapeLabel(editingCell.nodeId)}
              anchorRect={editingCell.anchorRect}
              cell={existing ?? BLANK_RISK_CELL}
              assessed={existing !== undefined}
              probabilityScale={probabilityScale}
              consequenceScale={consequenceScale}
              onChange={(cell) => onCellChange(editingCell.nodeId, editingCell.threatId, cell)}
              onClear={() => {
                onCellChange(editingCell.nodeId, editingCell.threatId, null)
                setEditingCell(null)
              }}
              onClose={() => setEditingCell(null)}
            />
          )
        })()}

      {breakdown && (
        <div
          className="legend-panel nodrag nopan threat-matrix-breakdown"
          style={{
            left: Math.min(breakdown.anchorRect.left, window.innerWidth - BREAKDOWN_WIDTH - 8),
            top: breakdown.anchorRect.bottom + 6,
            width: BREAKDOWN_WIDTH
          }}
        >
          <div className="legend-panel-toolbar">
            <span className="legend-panel-title">Derived score</span>
            <div className="details-panel-spacer" />
            <button type="button" title="Close" aria-label="Close" onClick={() => setBreakdown(null)}>
              ✕
            </button>
          </div>
          <div className="legend-panel-body">
            <p>
              <strong>{breakdown.threatName}</strong> × <strong>{breakdown.shapeLabel}</strong>
            </p>
            <p>
              {breakdown.value === null
                ? 'Not assessed anywhere in the linked diagram.'
                : `${breakdown.value.toFixed(2)} — rolled up from ${breakdown.contributions} downstream assessment${breakdown.contributions === 1 ? '' : 's'} using the current Cell score / Threat score modes.`}
            </p>
            <p className="legend-panel-hint">Read-only: edit the assessments in the linked diagram.</p>
            <button
              type="button"
              className="threat-matrix-manage-button"
              onClick={() => {
                onOpenLinkedDiagram(breakdown.relativePath)
                setBreakdown(null)
              }}
            >
              Open {breakdown.relativePath}
            </button>
          </div>
        </div>
      )}

      {managePanelAnchor && (
        <ThreatMatrixManagePanel
          anchorRect={managePanelAnchor}
          threats={security.threats}
          hiddenThreatIds={hiddenThreatIds}
          shapes={security.matrixShapeIds.map((id) => ({ id, label: shapeLabel(id) }))}
          hiddenShapeIds={hiddenShapeIds}
          assessableShapes={assessableShapes}
          onAddAllShapes={addAllShapes}
          onAddThreat={addThreat}
          onRenameThreat={renameThreat}
          onToggleThreatHidden={toggleThreatHidden}
          onRemoveThreat={onRemoveThreat}
          onAddShape={addShape}
          onToggleShapeHidden={toggleShapeHidden}
          onRemoveShape={onRemoveShape}
          onClose={() => setManagePanelAnchor(null)}
        />
      )}
    </div>
  )
}

// How many leaf assessments in a subtree feed one threat's rollup — shown
// in the derived-cell breakdown popup.
function countContributions(matrix: CrawledMatrix, normalizedThreatName: string): number {
  let n = 0
  for (const shape of matrix.shapes) {
    if (shape.linkBroken) continue
    if (shape.child) n += countContributions(shape.child, normalizedThreatName)
    else if (shape.cells[normalizedThreatName]) n += 1
  }
  return n
}
