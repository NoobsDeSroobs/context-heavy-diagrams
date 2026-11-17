// Default content of the diagram dock when nothing is selected — click to
// add an entity/container/text at the viewport center, or drag one onto the
// canvas to place it exactly where dropped (drag-to-add, see ADR 0064;
// click-to-add came first). These replace the
// toolbar's old Add-entity/Add-container/Add-text buttons rather than
// duplicating them.
//
// Right-click on Entity/Container opens the bulk-create dialog instead —
// see ADR 0089. onClick keeps its existing single-add meaning.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listPlace, type ListPlace } from './listPlace'
import { STENCIL_KINDS, stencilKind, stencilSearchText } from '@shared/stencils/kinds'

export type PaletteItemType = 'entity' | 'container' | 'text' | 'line' | 'stencil'

// dataTransfer's MIME-style key — namespaced so a drop handler can tell
// "this came from our own item palette" apart from a stray drag from
// somewhere else in the OS (a file, browser text selection, etc.) landing
// on the canvas by accident.
export const PALETTE_ITEM_DRAG_TYPE = 'application/x-chd-item-type'
// The kind of a stencil being dragged (ADR 0180), beside PALETTE_ITEM_DRAG_TYPE's 'stencil'.
export const PALETTE_STENCIL_KIND_DRAG_TYPE = 'application/x-chd-stencil-kind'

function onItemDragStart(event: React.DragEvent<HTMLButtonElement>, type: PaletteItemType): void {
  event.dataTransfer.setData(PALETTE_ITEM_DRAG_TYPE, type)
  event.dataTransfer.effectAllowed = 'copy'
}

// The palette's entry for stencils (ADR 0180): click adds the kind last used (a step to begin
// with), drag places it, and right-click or the arrow opens a short list with a filter, whose search
// also matches the BPMN terms of each kind.
function StencilPaletteButton({
  onAddStencil
}: {
  onAddStencil: (kindId: string) => void
}): React.JSX.Element {
  const [kindId, setKindId] = useState('step')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<ListPlace | null>(null)
  const kind = stencilKind(kindId)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // The list pops out to the side of the palette, over the canvas, wider than the palette is.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const update = (): void => {
      if (rootRef.current) setPlace(listPlace(rootRef.current.getBoundingClientRect()))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = STENCIL_KINDS.filter((k) => {
    const text = stencilSearchText(k.id).toLowerCase()
    return words.every((w) => text.includes(w))
  })
  const groups = [...new Set(shown.map((k) => k.group))]

  return (
    <div className="item-palette-stencil" ref={rootRef}>
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => {
          onItemDragStart(e, 'stencil')
          e.dataTransfer.setData(PALETTE_STENCIL_KIND_DRAG_TYPE, kind.id)
        }}
        onClick={() => onAddStencil(kind.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
        title={`Add ${kind.name}. Right-click to choose another kind of behaviour.`}
      >
        <span
          className={`item-palette-icon item-palette-icon-stencil item-palette-icon-${kind.shape}`}
        />
        Behaviour
      </button>
      <button
        type="button"
        className="item-palette-stencil-more"
        aria-label="Choose a kind of behaviour"
        title="Choose a kind of behaviour"
        onClick={() => setOpen((v) => !v)}
      >
        ▾
      </button>
      {open && place
        ? createPortal(
            <div
              ref={listRef}
              className="item-palette-stencil-list"
              role="listbox"
              aria-label="Kinds of behaviour"
              style={{
                left: place.left,
                top: place.top,
                width: place.width,
                maxHeight: place.maxHeight
              }}
            >
              <input
                autoFocus
                className="item-palette-stencil-filter"
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {groups.map((group) => (
                <div key={group}>
                  <div className="item-palette-stencil-group">{group}</div>
                  {shown
                    .filter((k) => k.group === group)
                    .map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        role="option"
                        aria-selected={k.id === kind.id}
                        className="item-palette-stencil-option"
                        onClick={() => {
                          setKindId(k.id)
                          setOpen(false)
                          setFilter('')
                          onAddStencil(k.id)
                        }}
                      >
                        {k.name}
                      </button>
                    ))}
                </div>
              ))}
              {shown.length === 0 && (
                <div className="item-palette-stencil-none">Nothing matches</div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

export default function ItemPalette({
  onAddEntity,
  onAddText,
  onAddContainer,
  onAddLine,
  onAddStencil,
  onCreateMultipleEntities,
  onCreateMultipleContainers
}: {
  onAddEntity: () => void
  onAddText: () => void
  onAddContainer: () => void
  onAddLine: () => void
  onAddStencil: (kindId: string) => void
  onCreateMultipleEntities: () => void
  onCreateMultipleContainers: () => void
}): React.JSX.Element {
  return (
    <div className="item-palette">
      <div className="item-palette-hint">Add to diagram</div>
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'entity')}
        onClick={onAddEntity}
        onContextMenu={(e) => {
          e.preventDefault()
          onCreateMultipleEntities()
        }}
        title="Right-click to create multiple from a list"
      >
        <span className="item-palette-icon item-palette-icon-entity" />
        Entity
      </button>
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'container')}
        onClick={onAddContainer}
        onContextMenu={(e) => {
          e.preventDefault()
          onCreateMultipleContainers()
        }}
        title="Right-click to create multiple from a list"
      >
        <span className="item-palette-icon item-palette-icon-container" />
        Container
      </button>
      <StencilPaletteButton onAddStencil={onAddStencil} />
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'text')}
        onClick={onAddText}
      >
        <span className="item-palette-icon item-palette-icon-text" />
        Textbox
      </button>
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'line')}
        onClick={onAddLine}
      >
        <span className="item-palette-icon item-palette-icon-line" />
        Line
      </button>
    </div>
  )
}
