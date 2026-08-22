// Default content of the diagram dock when nothing is selected — click to
// add a shape/container/text at the viewport center. See
// docs/planning/epics/0003-styling-panel.md: click-to-add only for this
// epic, drag-to-add is epic 0029. These replace the toolbar's old
// Add-shape/Add-container/Add-text buttons rather than duplicating them.
export default function ItemPalette({
  onAddShape,
  onAddText,
  onAddContainer,
  onAddLine
}: {
  onAddShape: () => void
  onAddText: () => void
  onAddContainer: () => void
  onAddLine: () => void
}): React.JSX.Element {
  return (
    <div className="item-palette">
      <div className="item-palette-hint">Add to diagram</div>
      <button type="button" className="item-palette-button" onClick={onAddShape}>
        <span className="item-palette-icon item-palette-icon-shape" />
        Shape
      </button>
      <button type="button" className="item-palette-button" onClick={onAddContainer}>
        <span className="item-palette-icon item-palette-icon-container" />
        Container
      </button>
      <button type="button" className="item-palette-button" onClick={onAddText}>
        <span className="item-palette-icon item-palette-icon-text" />
        Text
      </button>
      <button type="button" className="item-palette-button" onClick={onAddLine}>
        <span className="item-palette-icon item-palette-icon-line" />
        Line
      </button>
    </div>
  )
}
