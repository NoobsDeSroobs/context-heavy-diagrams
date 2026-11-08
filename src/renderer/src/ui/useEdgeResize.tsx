import { useRef, useState } from 'react'
import './pane-resize.css'

export interface WidthRange {
  default: number
  min: number
  max: number
}

const KEY_STEP = 16

// The drag handle on the inner edge of a pane that is docked to the right (ADR 0158): drag to
// resize, arrow keys for a step (Shift for a larger one), double-click for the default. The pane
// follows the pointer while dragging; `onCommit` is called once, on release (or per key press), so
// a width that is kept somewhere is written once per drag. Used by the side dock and by the review
// window's list.
export function useEdgeResize(
  width: number,
  range: WidthRange,
  onCommit: (width: number) => void,
  label: string
): { shownWidth: number; handle: React.JSX.Element } {
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const shownWidth = dragWidth ?? width
  const clamp = (value: number): number =>
    Math.min(range.max, Math.max(range.min, Math.round(value)))
  // The pane is on the right: moving the pointer left makes it wider.
  const widthAt = (clientX: number): number =>
    clamp(drag.current!.startWidth + drag.current!.startX - clientX)

  const handle = (
    <div
      className="pane-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={shownWidth}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      tabIndex={0}
      title="Drag to resize; double-click for the default width"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { startX: event.clientX, startWidth: shownWidth }
      }}
      onPointerMove={(event) => {
        if (drag.current) setDragWidth(widthAt(event.clientX))
      }}
      onPointerUp={(event) => {
        if (!drag.current) return
        const final = widthAt(event.clientX)
        drag.current = null
        setDragWidth(null)
        if (final !== width) onCommit(final)
      }}
      onDoubleClick={() => onCommit(range.default)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP
        onCommit(clamp(width + (event.key === 'ArrowLeft' ? step : -step)))
      }}
    />
  )
  return { shownWidth, handle }
}
