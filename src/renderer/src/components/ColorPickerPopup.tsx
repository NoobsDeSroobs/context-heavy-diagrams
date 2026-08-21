import { ColorField, NumberField, SliderField } from '../panels/fields'

interface ColorPickerPopupProps {
  title: string
  anchorRect: DOMRect
  color: string | undefined
  opacity: number | undefined
  width?: number
  onChangeColor: (value: string | undefined) => void
  onChangeOpacity: (value: number | undefined) => void
  onChangeWidth?: (value: number | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
  onClose: () => void
}

const PICKER_WIDTH = 200

// Quick-access "Fill…"/"Border…" popup from a shape/container's right-click
// menu — see ADR 0010. Reuses IconPicker's fixed-positioned popup shell and
// the property panel's own ColorField/NumberField, so this and the panel
// always look and behave identically; it edits the exact same style
// fields for the single right-clicked node, not a separate concept.
export default function ColorPickerPopup({
  title,
  anchorRect,
  color,
  opacity,
  width,
  onChangeColor,
  onChangeOpacity,
  onChangeWidth,
  onSessionStart,
  onSessionEnd,
  onClose
}: ColorPickerPopupProps): React.JSX.Element {
  const left = Math.min(anchorRect.right + 8, window.innerWidth - PICKER_WIDTH - 8)
  const top = Math.min(anchorRect.top, window.innerHeight - 200)

  return (
    <div className="icon-picker nodrag nopan" style={{ left, top, width: PICKER_WIDTH }}>
      <div className="icon-picker-label">{title}</div>
      <ColorField
        label="Color"
        value={color}
        mixed={false}
        onChange={onChangeColor}
        onSessionStart={onSessionStart}
        onSessionEnd={onSessionEnd}
      />
      <SliderField
        label="Opacity"
        value={opacity}
        mixed={false}
        onChange={onChangeOpacity}
        onSessionStart={onSessionStart}
        onSessionEnd={onSessionEnd}
      />
      {onChangeWidth && (
        <NumberField
          label="Width"
          value={width}
          mixed={false}
          min={0}
          onChange={onChangeWidth}
          onSessionStart={onSessionStart}
          onSessionEnd={onSessionEnd}
        />
      )}
      <div className="icon-picker-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
