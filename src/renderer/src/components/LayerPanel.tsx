import { Fragment, useRef, useState, type DragEvent } from 'react'

export interface LayerRow {
  id: string
  type: string
  label: string
  zIndex: number
}

interface LayerPanelProps {
  rows: LayerRow[]
  entityHighlightNodeId: string | null
  onPointAt: (nodeId: string | null) => void
  onReorder: (movedId: string, newIndex: number) => void
  onClose: () => void
}

// 'shape' | 'container' | 'text' | 'line' | 'anchor' (never listed here, no
// label) — anything unrecognized falls back to its first letter
// uppercased, same lenient spirit as docs/file-format.md's own node `type`
// handling.
const TYPE_BADGE: Record<string, string> = { shape: 'S', container: 'C', text: 'T', line: 'L' }

// Same UtilityDock shell as Highlights/Required tags/Diagnostics/Settings —
// see ADR 0035, unlike epic 0037's legend panel this one is explicitly a
// big scrollable list, exactly what that dock already does well. No
// catalog of its own: `rows` is a live projection of `nodes`' own zIndex,
// nothing here is separately persisted.
export default function LayerPanel({
  rows,
  entityHighlightNodeId,
  onPointAt,
  onReorder,
  onClose
}: LayerPanelProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  // Where the dragged row would land, expressed as a slot *between* rows
  // (0 = above the first row, rows.length = below the last) — a visible
  // insertion line, not "drop onto row X," which left which side it'd
  // land on as a hidden implementation detail. See epic 0043's follow-up
  // feedback after the first version shipped.
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // Drag-over/drop listen on the whole list, not per row — a per-row
  // handler leaves gaps (the insertion line itself, padding, the hint
  // text) with no element accepting the drop, which is exactly what
  // produced the "not allowed" cursor and a failed drop the user hit.
  // Geometric lookup instead: which row's vertical midpoint the pointer
  // is above decides the slot, computed fresh on every dragover so there's
  // no dead zone anywhere in the panel body to fall through.
  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (draggedId == null || !listRef.current) return
    const rowEls = listRef.current.querySelectorAll<HTMLElement>('.layer-row')
    let index = rowEls.length
    for (let i = 0; i < rowEls.length; i += 1) {
      const rect = rowEls[i].getBoundingClientRect()
      if (event.clientY < rect.top + rect.height / 2) {
        index = i
        break
      }
    }
    setDropIndex(index)
  }

  const endDrag = (): void => {
    setDraggedId(null)
    setDropIndex(null)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (draggedId == null || dropIndex == null) {
      endDrag()
      return
    }
    const draggedIndex = rows.findIndex((r) => r.id === draggedId)
    if (draggedIndex === -1) {
      endDrag()
      return
    }
    // dropIndex is a slot in the *current* rows array (dragged row still in
    // it); reorderZIndex expects an index into that array *without* the
    // dragged row, so a slot at or after the dragged row's own position
    // shifts down by one once it's removed.
    const newIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex
    onReorder(draggedId, newIndex)
    endDrag()
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel-toolbar">
        <span className="layer-panel-title">Layers</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        className="layer-panel-body"
        ref={listRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <p className="layer-panel-hint">
          Front to back, top to bottom. Drag a row to restack it. Click a row to point at it on
          canvas.
        </p>
        {rows.length === 0 && <p className="layer-panel-hint">Nothing on the canvas yet.</p>}
        {rows.map((row, index) => (
          <Fragment key={row.id}>
            {draggedId != null && dropIndex === index && <div className="layer-drop-indicator" />}
            <div
              draggable
              className={entityHighlightNodeId === row.id ? 'layer-row pointed' : 'layer-row'}
              onDragStart={() => setDraggedId(row.id)}
              onDragEnd={endDrag}
              onClick={() => onPointAt(entityHighlightNodeId === row.id ? null : row.id)}
            >
              <span className="layer-row-badge" title={row.type}>
                {TYPE_BADGE[row.type] ?? row.type.charAt(0).toUpperCase()}
              </span>
              <span className="layer-row-label">{row.label || '(unlabeled)'}</span>
              <span className="layer-row-zindex">{row.zIndex}</span>
            </div>
          </Fragment>
        ))}
        {draggedId != null && dropIndex === rows.length && <div className="layer-drop-indicator" />}
      </div>
    </div>
  )
}
