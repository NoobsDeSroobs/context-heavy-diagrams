import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

// Generic, reusable — this is the first epic that needs a context menu at
// all (right-click "Add icon"); epics 0008 ("See details") and 0013 (add
// connection point) extend the same menu rather than building their own.
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
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
    <div ref={ref} className="context-menu nodrag nopan" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button
          key={item.label}
          className="context-menu-item"
          onClick={() => {
            // Close first, then run the action — not the other way round.
            // An item whose onSelect() itself opens a *new* context menu
            // (e.g. ShapeNode/TextNode's "Link to diagram…", which opens a
            // create-new/link-existing chooser) sets the same contextMenu
            // state this menu is rendered from; calling onClose() after
            // onSelect() would immediately null that new menu back out in
            // the same synchronous batch, since both go through the same
            // setState call. Closing first means onSelect()'s own state
            // update is always the one that wins.
            onClose()
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
