import { useEffect, useRef } from 'react'
import type { RiskCell } from './threatMatrixMath'
import type { ScaleLevel } from './threatMatrixScale'

interface ThreatMatrixCellEditorProps {
  threat: string
  service: string
  anchorRect: DOMRect
  cell: RiskCell
  probabilityScale: ScaleLevel[]
  consequenceScale: ScaleLevel[]
  onChange: (cell: RiskCell) => void
  onClose: () => void
}

// Click-outside/Escape-to-close mirrors this app's other anchored popups
// (ColorPickerPopup, StylePicker, ContextMenu) — same idiom, not a shared
// component, since each of those is already its own small self-contained
// thing in this codebase.
export default function ThreatMatrixCellEditor({
  threat,
  service,
  anchorRect,
  cell,
  probabilityScale,
  consequenceScale,
  onChange,
  onClose
}: ThreatMatrixCellEditorProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="threat-matrix-cell-editor"
      style={{ position: 'fixed', top: anchorRect.bottom + 6, left: anchorRect.left }}
    >
      <div className="threat-matrix-cell-editor-title">
        {threat} × {service}
      </div>
      <label className="threat-matrix-cell-editor-field">
        Probability
        <select
          value={cell.probability}
          onChange={(event) => onChange({ ...cell, probability: Number(event.target.value) })}
          autoFocus
        >
          {probabilityScale.map((level) => (
            <option key={level.value} value={level.value}>
              {level.value} — {level.label}
            </option>
          ))}
        </select>
      </label>
      <label className="threat-matrix-cell-editor-field">
        Why? (optional)
        <textarea
          className="threat-matrix-cell-editor-note"
          rows={2}
          value={cell.probabilityNote ?? ''}
          onChange={(event) =>
            onChange({ ...cell, probabilityNote: event.target.value || undefined })
          }
          placeholder="Reasoning behind this probability"
        />
      </label>
      <label className="threat-matrix-cell-editor-field">
        Consequence
        <select
          value={cell.consequence}
          onChange={(event) => onChange({ ...cell, consequence: Number(event.target.value) })}
        >
          {consequenceScale.map((level) => (
            <option key={level.value} value={level.value}>
              {level.value} — {level.label}
            </option>
          ))}
        </select>
      </label>
      <label className="threat-matrix-cell-editor-field">
        Why? (optional)
        <textarea
          className="threat-matrix-cell-editor-note"
          rows={2}
          value={cell.consequenceNote ?? ''}
          onChange={(event) =>
            onChange({ ...cell, consequenceNote: event.target.value || undefined })
          }
          placeholder="Reasoning behind this consequence"
        />
      </label>
    </div>
  )
}
