import { showAlert } from '../alerts'
import { useState } from 'react'
import type { IconRef, IconSlot } from '@shared/diagram'
import IconBrowser from './IconBrowser'

interface IconPickerProps {
  diagramPath: string | null
  icons: Partial<Record<IconSlot, IconRef>>
  initialSlot: IconSlot
  anchorRect: DOMRect
  onPick: (slot: IconSlot, icon: IconRef) => void
  onRemove: (slot: IconSlot) => void
  onClose: () => void
}

const SLOTS: { slot: IconSlot; label: string }[] = [
  { slot: 'topLeft', label: 'Top left' },
  { slot: 'topRight', label: 'Top right' },
  { slot: 'bottomLeft', label: 'Bottom left' },
  { slot: 'bottomRight', label: 'Bottom right' }
]

const PICKER_WIDTH = 220

// Deliberately minimal: pick an icon, pick a corner, done. No opacity/other
// style params — those belong to the properties panel, same reasoning as
// why text alignment was deferred there. The icon search box + grids are
// the shared IconBrowser (see ADR 0072); this component adds only the
// corner selector and the assign/remove semantics around it.
//
// Fixed-positioned from the triggering node's on-screen rect (see
// DiagramContext) — this must NOT be a descendant of the node itself, or it
// inherits React Flow's zoom/pan transform and scales like a shape on the
// canvas instead of staying a normal, fixed-size UI popup.
export default function IconPicker({
  diagramPath,
  icons,
  initialSlot,
  anchorRect,
  onPick,
  onRemove,
  onClose
}: IconPickerProps): React.JSX.Element {
  const [slot, setSlot] = useState<IconSlot>(initialSlot)

  const handleUpload = async (): Promise<void> => {
    if (!diagramPath) {
      showAlert('Save the diagram before adding a custom icon.')
      return
    }
    const path = await window.api.pickAndCopyCustomIcon(diagramPath)
    if (path) onPick(slot, { source: 'custom', path })
  }

  // To the right of the shape by default, clamped so it doesn't run off the
  // right edge of the screen.
  const left = Math.min(anchorRect.right + 8, window.innerWidth - PICKER_WIDTH - 8)
  const top = Math.min(anchorRect.top, window.innerHeight - 320)

  return (
    <div className="icon-picker nodrag nopan" style={{ left, top, width: PICKER_WIDTH }}>
      <div className="corner-picker">
        <div className="corner-picker-box" />
        {SLOTS.map(({ slot: s, label }) => (
          <button
            key={s}
            type="button"
            title={label}
            aria-label={label}
            className={`corner-picker-dot corner-picker-dot-${s}${s === slot ? ' active' : ''}${icons[s] ? ' occupied' : ''}`}
            onClick={() => setSlot(s)}
          />
        ))}
      </div>
      <IconBrowser diagramPath={diagramPath} onPick={(icon) => onPick(slot, icon)} />
      <div className="icon-picker-actions">
        <button type="button" onClick={handleUpload}>
          Upload custom icon…
        </button>
        {icons[slot] && (
          <button type="button" onClick={() => onRemove(slot)}>
            Remove icon
          </button>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
