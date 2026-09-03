import { useMemo, useState, type MouseEvent } from 'react'
import type { Node } from '@xyflow/react'
import type { AggregateMethod, CombineMethod, DiagramSecurity, RiskCell } from '@shared/diagram'
import {
  cellScore,
  threatScore,
  vulnerabilityScore,
  totalSecurityScore,
  COMBINE_METHOD_LABELS,
  AGGREGATE_METHOD_LABELS,
  BLANK_RISK_CELL
} from './threatMatrixMath'
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
  // Config-only changes: methods, hide toggles, add threat/shape, rename.
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

function nodeSecurity(node: Node | undefined): Record<string, RiskCell> {
  const s = node?.data?.security
  return s && typeof s === 'object' ? (s as Record<string, RiskCell>) : {}
}

function newThreatId(): string {
  return `threat-${crypto.randomUUID()}`
}

// The Security Matrix — a read-time view over every member shape's own
// `data.security` plus the diagram-level `security` config (ADR 0082).
// It owns no persisted state of its own: every edit goes straight back
// through the callbacks to the nodes / the diagram config.
export default function ThreatMatrixView({
  nodes,
  security,
  onChange,
  onRemoveThreat,
  onRemoveShape,
  onCellChange
}: ThreatMatrixViewProps): React.JSX.Element {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [managePanelAnchor, setManagePanelAnchor] = useState<DOMRect | null>(null)

  const combineMethod: CombineMethod = security.combineMethod ?? 'multiply'
  const aggregateMethod: AggregateMethod = security.aggregateMethod ?? 'average'
  const { probabilityScale, consequenceScale } = effectiveScales(security)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const hiddenThreatIds = new Set(security.hiddenThreatIds ?? [])
  const hiddenShapeIds = new Set(security.hiddenShapeIds ?? [])

  // Rows = catalog threats not hidden. Columns = matrix shapes not hidden,
  // that still resolve to a real Shape node.
  const visibleThreats = security.threats.filter((t) => !hiddenThreatIds.has(t.id))
  const visibleShapeIds = security.matrixShapeIds.filter(
    (id) => !hiddenShapeIds.has(id) && nodeById.get(id)?.type === 'shape'
  )

  const shapeLabel = (id: string): string =>
    String(nodeById.get(id)?.data?.label ?? '(missing shape)')

  // Completeness (ADR 0082) — over EVERY matrixShape x EVERY threat,
  // hidden included; a missing cell is an un-entered assessment.
  const totalCells = security.matrixShapeIds.length * security.threats.length
  const enteredCells = security.matrixShapeIds.reduce((count, shapeId) => {
    const cells = nodeSecurity(nodeById.get(shapeId))
    return count + security.threats.filter((t) => cells[t.id] !== undefined).length
  }, 0)
  const missingCells = totalCells - enteredCells

  // Cell scores over the visible grid; absent cells are simply excluded
  // from the aggregates (a half-assessed row still scores on what's there).
  const assessedCellsForThreat = (threatId: string): RiskCell[] =>
    visibleShapeIds
      .map((id) => nodeSecurity(nodeById.get(id))[threatId])
      .filter((c): c is RiskCell => c !== undefined)
  const assessedCellsForShape = (shapeId: string): RiskCell[] => {
    const cells = nodeSecurity(nodeById.get(shapeId))
    return visibleThreats.map((t) => cells[t.id]).filter((c): c is RiskCell => c !== undefined)
  }

  const rowScores = visibleThreats.map((t) =>
    threatScore(assessedCellsForThreat(t.id), combineMethod, aggregateMethod)
  )
  const columnScores = visibleShapeIds.map((id) =>
    vulnerabilityScore(assessedCellsForShape(id), combineMethod, aggregateMethod)
  )
  const grandTotal = totalSecurityScore(rowScores, columnScores, combineMethod, aggregateMethod)

  const openEditor = (
    threatId: string,
    nodeId: string,
    event: MouseEvent<HTMLTableCellElement>
  ): void => {
    setEditingCell({ threatId, nodeId, anchorRect: event.currentTarget.getBoundingClientRect() })
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

  const nothingToShow = visibleThreats.length === 0 || visibleShapeIds.length === 0

  return (
    <div className="threat-matrix-view">
      <div className="threat-matrix-main">
        <div className="threat-matrix-settings">
          <label className="threat-matrix-settings-field">
            Cell score
            <select
              value={combineMethod}
              onChange={(event) => patch({ combineMethod: event.target.value as CombineMethod })}
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
              onChange={(event) =>
                patch({ aggregateMethod: event.target.value as AggregateMethod })
              }
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
              ? `⚠ ${missingCells} of ${totalCells} assessments not entered${
                  security.hiddenThreatIds?.length || security.hiddenShapeIds?.length
                    ? ' (hidden rows/columns included)'
                    : ''
                }`
              : `✓ All ${totalCells} assessments entered`}
          </p>
        )}

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
                {visibleShapeIds.map((id) => (
                  <th key={id}>{shapeLabel(id)}</th>
                ))}
                <th className="threat-matrix-aggregate-header">Threat score</th>
              </tr>
            </thead>
            <tbody>
              {visibleThreats.map((threat, rowIndex) => (
                <tr key={threat.id}>
                  <th scope="row">{threat.name}</th>
                  {visibleShapeIds.map((shapeId) => {
                    const cell = nodeSecurity(nodeById.get(shapeId))[threat.id]
                    return (
                      <td
                        key={shapeId}
                        className={
                          cell
                            ? 'threat-matrix-cell'
                            : 'threat-matrix-cell threat-matrix-cell-unassessed'
                        }
                        onClick={(event) => openEditor(threat.id, shapeId, event)}
                        title={cell ? 'Click to edit' : 'Not assessed — click to assess'}
                      >
                        {cell ? cellScore(cell, combineMethod) : '—'}
                      </td>
                    )
                  })}
                  <td className="threat-matrix-aggregate">
                    {assessedCellsForThreat(threat.id).length > 0
                      ? rowScores[rowIndex].toFixed(1)
                      : '—'}
                  </td>
                </tr>
              ))}
              <tr className="threat-matrix-aggregate-row">
                <th scope="row">Vulnerability score</th>
                {columnScores.map((score, columnIndex) => (
                  <td key={visibleShapeIds[columnIndex]} className="threat-matrix-aggregate">
                    {assessedCellsForShape(visibleShapeIds[columnIndex]).length > 0
                      ? score.toFixed(1)
                      : '—'}
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

      {managePanelAnchor && (
        <ThreatMatrixManagePanel
          anchorRect={managePanelAnchor}
          threats={security.threats}
          hiddenThreatIds={hiddenThreatIds}
          shapes={security.matrixShapeIds.map((id) => ({ id, label: shapeLabel(id) }))}
          hiddenShapeIds={hiddenShapeIds}
          assessableShapes={assessableShapes}
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
