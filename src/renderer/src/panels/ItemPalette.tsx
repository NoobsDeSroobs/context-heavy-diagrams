// Default content of the diagram dock when nothing is selected — click to
// add a shape/container/text at the viewport center, or drag one onto the
// canvas to place it exactly where dropped (drag-to-add, see ADR 0064;
// click-to-add came first). These replace the
// toolbar's old Add-shape/Add-container/Add-text buttons rather than
// duplicating them.
//
// Right-click on Shape/Container opens the bulk-create dialog instead —
// see ADR 0089. onClick keeps its existing single-add meaning.

export type PaletteItemType = 'shape' | 'container' | 'text' | 'line'

// dataTransfer's MIME-style key — namespaced so a drop handler can tell
// "this came from our own item palette" apart from a stray drag from
// somewhere else in the OS (a file, browser text selection, etc.) landing
// on the canvas by accident.
export const PALETTE_ITEM_DRAG_TYPE = 'application/x-chd-item-type'

function onItemDragStart(event: React.DragEvent<HTMLButtonElement>, type: PaletteItemType): void {
  event.dataTransfer.setData(PALETTE_ITEM_DRAG_TYPE, type)
  event.dataTransfer.effectAllowed = 'copy'
}

export default function ItemPalette({
  onAddShape,
  onAddText,
  onAddContainer,
  onAddLine,
  onCreateMultipleShapes,
  onCreateMultipleContainers
}: {
  onAddShape: () => void
  onAddText: () => void
  onAddContainer: () => void
  onAddLine: () => void
  onCreateMultipleShapes: () => void
  onCreateMultipleContainers: () => void
}): React.JSX.Element {
  return (
    <div className="item-palette">
      <div className="item-palette-hint">Add to diagram</div>
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'shape')}
        onClick={onAddShape}
        onContextMenu={(e) => {
          e.preventDefault()
          onCreateMultipleShapes()
        }}
        title="Right-click to create multiple from a list"
      >
        <span className="item-palette-icon item-palette-icon-shape" />
        Shape
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
      <button
        type="button"
        className="item-palette-button"
        draggable
        onDragStart={(e) => onItemDragStart(e, 'text')}
        onClick={onAddText}
      >
        <span className="item-palette-icon item-palette-icon-text" />
        Text
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
