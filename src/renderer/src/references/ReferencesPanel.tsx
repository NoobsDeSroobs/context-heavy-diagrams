import ReferenceImage from './ReferenceImage'

export interface ReferenceRow {
  nodeId: string
  nodeLabel: string
  path: string
}

interface ReferencesPanelProps {
  diagramPath: string | null
  rows: ReferenceRow[]
  // Select + focus the owning entity on canvas.
  onReveal: (nodeId: string) => void
  // Open the floating viewer window for this reference.
  onOpen: (nodeId: string, path: string) => void
  onClose: () => void
}

// Diagram-wide inventory of every reference image (see ADR 0069),
// same UtilityDock shell and "live projection of nodes, owns nothing" spirit
// as LayerPanel. Read-only: adding/removing happens in the property panel or
// a viewer window, not here.
export default function ReferencesPanel({
  diagramPath,
  rows,
  onReveal,
  onOpen,
  onClose
}: ReferencesPanelProps): React.JSX.Element {
  return (
    <div className="layer-panel">
      <div className="layer-panel-toolbar">
        <span className="layer-panel-title">References</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="layer-panel-body">
        <p className="layer-panel-hint">
          Every reference image in the diagram. Click a row to open its window; click the label to
          find its entity on the canvas.
        </p>
        {rows.length === 0 && (
          <p className="layer-panel-hint">
            No reference images yet. Select an entity and add some from its property panel.
          </p>
        )}
        {rows.map((row) => (
          <div key={`${row.nodeId}::${row.path}`} className="reference-inventory-row">
            <button
              type="button"
              className="reference-inventory-thumb"
              title="Open reference window"
              onClick={() => onOpen(row.nodeId, row.path)}
            >
              <ReferenceImage diagramPath={diagramPath} path={row.path} />
            </button>
            <button
              type="button"
              className="reference-inventory-label"
              title={`Find "${row.nodeLabel || '(unlabeled)'}" on the canvas`}
              onClick={() => onReveal(row.nodeId)}
            >
              <span className="reference-inventory-owner">{row.nodeLabel || '(unlabeled)'}</span>
              <span className="reference-inventory-file">{row.path.split('/').pop()}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
