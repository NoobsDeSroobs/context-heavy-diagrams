import { Children, useRef, useState, type ReactNode } from 'react'
import { UTILITY_DOCK_WIDTH, clampDockWidth } from '@shared/preferences/panelWidth'

// Outer-level dock, sibling of the canvas view (ADR 0013). Holds content that is about the diagram
// but isn't editing it: `NotesPanel`/`RequiredTagsPanel`/`DiagnosticsPanel` today, and a slot for
// future non-editing features. Zero width when empty, and renders nothing (not even the wrapper
// div) so it never claims layout space.
//
// Canvas passes each panel as its own `{condition && <Panel/>}` sibling, so `children` is an array
// of (element | false) once there is more than one, and `!children` on a non-empty array is false
// even when every entry is `false`. Children.toArray strips the falsy entries first, so "nothing
// open" can be told from "one of several possibly open".
//
// Its left edge is a handle (ADR 0158): drag to resize, arrow keys for a step, double-click for the
// default. The width follows the pointer while dragging and is handed to `onWidthChange` once, on
// release, so the preference is written once per drag.
const KEY_STEP = 16

export default function UtilityDock({
  children,
  width,
  onWidthChange
}: {
  children: ReactNode
  width: number
  onWidthChange: (width: number) => void
}): React.JSX.Element | null {
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const content = Children.toArray(children)
  if (content.length === 0) return null
  const shown = dragWidth ?? width

  return (
    <div className="utility-dock" style={{ width: shown }}>
      <div
        className="utility-dock-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the side panel"
        aria-valuenow={shown}
        aria-valuemin={UTILITY_DOCK_WIDTH.min}
        aria-valuemax={UTILITY_DOCK_WIDTH.max}
        tabIndex={0}
        title="Drag to resize; double-click for the default width"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          drag.current = { startX: event.clientX, startWidth: shown }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          // The dock is on the right: moving the pointer left makes it wider.
          setDragWidth(
            clampDockWidth(drag.current.startWidth + drag.current.startX - event.clientX)
          )
        }}
        onPointerUp={(event) => {
          if (!drag.current) return
          const final = clampDockWidth(
            drag.current.startWidth + drag.current.startX - event.clientX
          )
          drag.current = null
          setDragWidth(null)
          if (final !== width) onWidthChange(final)
        }}
        onDoubleClick={() => onWidthChange(UTILITY_DOCK_WIDTH.default)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP
          onWidthChange(clampDockWidth(width + (event.key === 'ArrowLeft' ? step : -step)))
        }}
      />
      {content}
    </div>
  )
}
