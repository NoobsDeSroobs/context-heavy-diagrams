import { useState, type MouseEvent } from 'react'
import {
  cellScore,
  threatScore,
  vulnerabilityScore,
  totalSecurityScore,
  COMBINE_METHOD_LABELS,
  AGGREGATE_METHOD_LABELS,
  type RiskCell,
  type CombineMethod,
  type AggregateMethod
} from './threatMatrixMath'
import { TEST_THREATS, TEST_SERVICES, TEST_CELLS } from './threatMatrixTestData'
import { PROBABILITY_SCALE, CONSEQUENCE_SCALE } from './threatMatrixScale'
import ThreatMatrixCellEditor from './ThreatMatrixCellEditor'
import ThreatMatrixScaleReference from './ThreatMatrixScaleReference'
import ThreatMatrixManagePanel from './ThreatMatrixManagePanel'

type CellsByThreatAndService = Record<string, Record<string, RiskCell>>

interface EditingCell {
  threat: string
  service: string
  anchorRect: DOMRect
}

// A freshly added threat/service has no assessment yet — starting both
// dimensions at the scale's own lowest value reads as "not yet reviewed,"
// rather than implying an average/moderate risk before anyone's looked.
const DEFAULT_NEW_CELL: RiskCell = { probability: 1, consequence: 1 }

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const rest = { ...record }
  delete rest[key]
  return rest
}

// Threats/services can now be removed as well as
// added — managed from ThreatMatrixManagePanel rather than inline table
// controls (moved there entirely; see that file's own comment). Both
// calculation "settings" (threatMatrixMath.ts) and the add/remove
// machinery are still purely in-memory component state — nothing here
// persists, no .chd/file-format involvement, and it isn't yet decided
// whether any of this would eventually be per-installation Settings or
// per-matrix Configuration in this app's own terms
// (docs/architecture/glossary.md).
export default function ThreatMatrixView(): React.JSX.Element {
  const [threats, setThreats] = useState<string[]>(TEST_THREATS)
  const [services, setServices] = useState<string[]>(TEST_SERVICES)
  const [cells, setCells] = useState<CellsByThreatAndService>(TEST_CELLS)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [combineMethod, setCombineMethod] = useState<CombineMethod>('multiply')
  const [aggregateMethod, setAggregateMethod] = useState<AggregateMethod>('average')
  const [managePanelAnchor, setManagePanelAnchor] = useState<DOMRect | null>(null)

  const rowScores = threats.map((threat) =>
    threatScore(
      services.map((s) => cells[threat][s]),
      combineMethod,
      aggregateMethod
    )
  )
  const columnScores = services.map((service) =>
    vulnerabilityScore(
      threats.map((t) => cells[t][service]),
      combineMethod,
      aggregateMethod
    )
  )
  const grandTotal = totalSecurityScore(rowScores, columnScores, combineMethod, aggregateMethod)

  const openEditor = (
    threat: string,
    service: string,
    event: MouseEvent<HTMLTableCellElement>
  ): void => {
    setEditingCell({ threat, service, anchorRect: event.currentTarget.getBoundingClientRect() })
  }

  const updateCell = (threat: string, service: string, cell: RiskCell): void => {
    setCells((current) => ({
      ...current,
      [threat]: { ...current[threat], [service]: cell }
    }))
  }

  const addThreat = (name: string): void => {
    if (threats.includes(name)) return
    setThreats((current) => [...current, name])
    setCells((current) => ({
      ...current,
      [name]: Object.fromEntries(services.map((service) => [service, DEFAULT_NEW_CELL]))
    }))
  }

  const addService = (name: string): void => {
    if (services.includes(name)) return
    setServices((current) => [...current, name])
    setCells((current) => {
      const next = { ...current }
      for (const threat of threats) next[threat] = { ...next[threat], [name]: DEFAULT_NEW_CELL }
      return next
    })
  }

  const removeThreat = (threat: string): void => {
    setThreats((current) => current.filter((t) => t !== threat))
    setCells((current) => omitKey(current, threat))
    setEditingCell((current) => (current?.threat === threat ? null : current))
  }

  const removeService = (service: string): void => {
    setServices((current) => current.filter((s) => s !== service))
    setCells((current) =>
      Object.fromEntries(
        Object.entries(current).map(([threat, byService]) => [threat, omitKey(byService, service)])
      )
    )
    setEditingCell((current) => (current?.service === service ? null : current))
  }

  return (
    <div className="threat-matrix-view">
      <div className="threat-matrix-main">
        <div className="threat-matrix-settings">
          <label className="threat-matrix-settings-field">
            Cell score
            <select
              value={combineMethod}
              onChange={(event) => setCombineMethod(event.target.value as CombineMethod)}
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
              onChange={(event) => setAggregateMethod(event.target.value as AggregateMethod)}
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
        <table className="threat-matrix-table">
          <thead>
            <tr>
              <th className="threat-matrix-corner" />
              {services.map((service) => (
                <th key={service}>{service}</th>
              ))}
              <th className="threat-matrix-aggregate-header">Threat score</th>
            </tr>
          </thead>
          <tbody>
            {threats.map((threat, rowIndex) => (
              <tr key={threat}>
                <th scope="row">{threat}</th>
                {services.map((service) => (
                  <td
                    key={service}
                    className="threat-matrix-cell"
                    onClick={(event) => openEditor(threat, service, event)}
                    title="Click to set probability/consequence"
                  >
                    {cellScore(cells[threat][service], combineMethod)}
                  </td>
                ))}
                <td className="threat-matrix-aggregate">{rowScores[rowIndex].toFixed(1)}</td>
              </tr>
            ))}
            <tr className="threat-matrix-aggregate-row">
              <th scope="row">Vulnerability score</th>
              {columnScores.map((score, columnIndex) => (
                <td key={services[columnIndex]} className="threat-matrix-aggregate">
                  {score.toFixed(1)}
                </td>
              ))}
              <td className="threat-matrix-grand-total">{grandTotal.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ThreatMatrixScaleReference
        probabilityScale={PROBABILITY_SCALE}
        consequenceScale={CONSEQUENCE_SCALE}
      />
      {editingCell && (
        <ThreatMatrixCellEditor
          threat={editingCell.threat}
          service={editingCell.service}
          anchorRect={editingCell.anchorRect}
          cell={cells[editingCell.threat][editingCell.service]}
          probabilityScale={PROBABILITY_SCALE}
          consequenceScale={CONSEQUENCE_SCALE}
          onChange={(cell) => updateCell(editingCell.threat, editingCell.service, cell)}
          onClose={() => setEditingCell(null)}
        />
      )}
      {managePanelAnchor && (
        <ThreatMatrixManagePanel
          anchorRect={managePanelAnchor}
          threats={threats}
          services={services}
          onAddThreat={addThreat}
          onRemoveThreat={removeThreat}
          onAddService={addService}
          onRemoveService={removeService}
          onClose={() => setManagePanelAnchor(null)}
        />
      )}
    </div>
  )
}
