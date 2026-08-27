import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import ReferenceImage from './ReferenceImage'

interface ReferenceWindowProps {
  diagramPath: string | null
  nodeId: string
  path: string
  // Owning shape's label, for the header.
  ownerLabel: string
  // Cascade offset so several opened at once don't stack exactly.
  index: number
  onClose: () => void
  onRemove: () => void
}

const HEADER_PX = 26
const MIN_W = 220
const MIN_H = 120
const MIN_SCALE = 0.2
const MAX_SCALE = 12
const ZOOM_STEP = 1.2

interface Natural {
  w: number
  h: number
}

// A single reference image (epic 0090/ADR 0069) as a free-floating,
// draggable, resizable, closable window over the canvas — the PureRef /
// design-software model. The body is a fixed viewport with NO scrollbars:
// zoom with the wheel or the +/− buttons, pan by dragging, double-click to
// reset. Pure session state — position, size, zoom and pan vanish when the
// window unmounts. `.nodrag .nopan .nowheel` stop React Flow reacting to
// pointer/wheel events over the window.
export default function ReferenceWindow({
  diagramPath,
  nodeId,
  path,
  ownerLabel,
  index,
  onClose,
  onRemove
}: ReferenceWindowProps): React.JSX.Element {
  const [pos, setPos] = useState(() => ({ x: 96 + index * 28, y: 96 + index * 28 }))
  const [size, setSize] = useState({ width: 300, height: 220 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [natural, setNatural] = useState<Natural | null>(null)

  const bodyRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const resizeRef = useRef<{ px: number; py: number; w: number; h: number } | null>(null)
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const isButton = (target: EventTarget): boolean =>
    target instanceof HTMLElement && target.closest('button') !== null

  const handleNaturalSize = (w: number, h: number): void => {
    if (w <= 0 || h <= 0) return
    setNatural({ w, h })
    if (!seededRef.current) {
      seededRef.current = true
      const width = Math.min(w, 380)
      setSize({ width, height: Math.min(Math.round((width * h) / w), 420) })
    }
  }

  // --- geometry: contain-fit the image in the body, then apply zoom ---
  const bodyW = size.width
  const bodyH = size.height
  const aspect = natural ? natural.h / natural.w : bodyH / bodyW
  const fitByWidth = bodyH / bodyW >= aspect
  const baseW = fitByWidth ? bodyW : bodyH / aspect
  const baseH = fitByWidth ? bodyW * aspect : bodyH
  const imgW = baseW * scale
  const imgH = baseH * scale

  // Clamp the pan so the image can't be dragged off into nothing: centred
  // when it's smaller than the viewport on an axis, otherwise edge-locked.
  const clampPan = (v: number, extent: number, view: number): number => {
    if (extent <= view) return (view - extent) / 2
    return Math.min(0, Math.max(view - extent, v))
  }
  const panX = clampPan(pan.x, imgW, bodyW)
  const panY = clampPan(pan.y, imgH, bodyH)

  const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  // Zoom about a focal point (fx, fy) in body coordinates, keeping the
  // image pixel under it fixed — so wheel-zoom tracks the cursor and the
  // +/− buttons zoom about the window centre, instead of everything
  // ballooning out from the top-left corner.
  const zoomAbout = (factor: number, fx: number, fy: number): void => {
    const next = clampScale(scale * factor)
    const real = next / scale
    setPan({ x: fx - (fx - panX) * real, y: fy - (fy - panY) * real })
    setScale(next)
  }

  const zoomBy = (factor: number): void => zoomAbout(factor, bodyW / 2, bodyH / 2)

  const onWheel = (event: ReactWheelEvent): void => {
    // The app root is overflow:hidden and the window carries `.nowheel`,
    // so nothing scrolls or pans the canvas — just stop the bubble and
    // zoom about the cursor.
    event.stopPropagation()
    const rect = bodyRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAbout(
      event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
      event.clientX - rect.left,
      event.clientY - rect.top
    )
  }

  const reset = (): void => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  // --- window drag (header) ---
  const onHeaderPointerDown = (event: ReactPointerEvent): void => {
    if (event.button !== 0 || isButton(event.target)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { px: event.clientX, py: event.clientY, ox: pos.x, oy: pos.y }
  }
  const onHeaderPointerMove = (event: ReactPointerEvent): void => {
    const d = dragRef.current
    if (!d) return
    setPos({ x: d.ox + (event.clientX - d.px), y: d.oy + (event.clientY - d.py) })
  }
  const endHeaderDrag = (event: ReactPointerEvent): void => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // --- window resize (corner handle) ---
  const onResizePointerDown = (event: ReactPointerEvent): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { px: event.clientX, py: event.clientY, w: size.width, h: size.height }
  }
  const onResizePointerMove = (event: ReactPointerEvent): void => {
    const r = resizeRef.current
    if (!r) return
    setSize({
      width: Math.max(MIN_W, r.w + (event.clientX - r.px)),
      height: Math.max(MIN_H, r.h + (event.clientY - r.py))
    })
  }
  const endResize = (event: ReactPointerEvent): void => {
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // --- pan the image inside the body ---
  const onBodyPointerDown = (event: ReactPointerEvent): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { px: event.clientX, py: event.clientY, ox: panX, oy: panY }
  }
  const onBodyPointerMove = (event: ReactPointerEvent): void => {
    const p = panRef.current
    if (!p) return
    setPan({ x: p.ox + (event.clientX - p.px), y: p.oy + (event.clientY - p.py) })
  }
  const endPan = (event: ReactPointerEvent): void => {
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      className="reference-window nodrag nopan nowheel"
      data-node-id={nodeId}
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height + HEADER_PX }}
    >
      <div
        className="reference-window-header"
        style={{ height: HEADER_PX }}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <span className="reference-window-title" title={`${ownerLabel || '(unlabeled)'} — ${path}`}>
          {ownerLabel || '(unlabeled)'}
        </span>
        <button
          type="button"
          className="reference-window-btn"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          &minus;
        </button>
        <button
          type="button"
          className="reference-window-btn reference-window-zoom"
          title="Reset zoom (or double-click the image)"
          aria-label="Reset view"
          onClick={reset}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          className="reference-window-btn"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          className="reference-window-btn"
          title="Remove this reference from the shape"
          aria-label="Remove reference"
          onClick={onRemove}
        >
          🗑
        </button>
        <button
          type="button"
          className="reference-window-btn"
          title="Close (keeps the reference on the shape)"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div
        ref={bodyRef}
        className="reference-window-body"
        style={{ height: size.height }}
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
        onDoubleClick={reset}
      >
        <ReferenceImage
          key={path}
          diagramPath={diagramPath}
          path={path}
          className="reference-window-img"
          style={{
            width: imgW,
            height: imgH,
            transform: `translate(${panX}px, ${panY}px)`
          }}
          onNaturalSize={handleNaturalSize}
        />
      </div>
      <div
        className="reference-window-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        title="Resize"
      />
    </div>
  )
}
