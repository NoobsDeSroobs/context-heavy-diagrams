import { useEffect } from 'react'
import type { EdgeDirectionSet, EdgeDirectionSetStyle } from '@shared/diagram'
import { useDiagramContext } from '../useDiagramContext'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import {
  CollapsibleSection,
  ColorField,
  NumberField,
  SelectField,
  SliderField
} from '../panels/fields'
import { LINE_STYLE_OPTIONS, MARKER_OPTIONS } from './edgeStyleOptions'

interface EdgeDirectionSetStyleEditorProps {
  set: EdgeDirectionSet
  anchorRect: DOMRect
  onUpdateStyle: (patch: Partial<EdgeDirectionSetStyle>) => void
  onClose: () => void
}

const EDITOR_WIDTH = 260

// no-op session/snapshot hooks — a direction set's default style is not an
// undo step (ADR 0081 / ADR 0083); onUpdateStyle already marks the document
// dirty.
const noop = (): void => {}

// Floating editor for one edge direction set's default edge style (ADR
// 0083). Opened from the ✎ button in EdgeDirectionSetsSection; reuses the
// Property panel's own field primitives so it looks and behaves like
// editing a real edge — minus the things a per-reading default has no use
// for (routing/geometry, label font, metadata).
export default function EdgeDirectionSetStyleEditor({
  set,
  anchorRect,
  onUpdateStyle,
  onClose
}: EdgeDirectionSetStyleEditorProps): React.JSX.Element {
  const { theme, paletteColors } = useDiagramContext()
  const style = set.style ?? {}

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const left = Math.min(anchorRect.right + 8, window.innerWidth - EDITOR_WIDTH - 8)
  const top = Math.min(anchorRect.top, window.innerHeight - 380)

  return (
    <div
      className="edge-direction-set-style-editor nodrag nopan"
      style={{ left, top, width: EDITOR_WIDTH }}
    >
      <div className="edge-direction-set-style-editor-head">
        <span className="edge-direction-set-style-editor-title">
          Default edge style — {set.name}
        </span>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="required-tags-panel-hint">
        Seeds every edge drawn while this reading is active, and how its legend row is drawn.
        Existing edges are not restyled.
      </p>

      <CollapsibleSection title="Start">
        <SelectField
          label="Marker"
          value={style.startMarker}
          mixed={false}
          options={MARKER_OPTIONS}
          onChange={(v) => onUpdateStyle({ startMarker: v })}
          pushSnapshot={noop}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Line">
        <ColorField
          label="Color"
          value={themeAdaptiveColor(style.stroke, theme)}
          mixed={false}
          onChange={(v) =>
            onUpdateStyle({ stroke: v === undefined ? undefined : themeAdaptiveColor(v, theme) })
          }
          onSessionStart={noop}
          onSessionEnd={noop}
          paletteColors={paletteColors}
        />
        <SliderField
          label="Opacity"
          value={style.strokeOpacity}
          mixed={false}
          onChange={(v) => onUpdateStyle({ strokeOpacity: v })}
          onSessionStart={noop}
          onSessionEnd={noop}
        />
        <NumberField
          label="Width"
          value={style.strokeWidth}
          mixed={false}
          min={0}
          onChange={(v) => onUpdateStyle({ strokeWidth: v })}
          onSessionStart={noop}
          onSessionEnd={noop}
        />
        <SelectField
          label="Style"
          value={style.lineStyle}
          mixed={false}
          options={LINE_STYLE_OPTIONS}
          onChange={(v) => onUpdateStyle({ lineStyle: v })}
          pushSnapshot={noop}
        />
      </CollapsibleSection>

      <CollapsibleSection title="End">
        <SelectField
          label="Marker"
          value={style.endMarker}
          mixed={false}
          options={MARKER_OPTIONS}
          onChange={(v) => onUpdateStyle({ endMarker: v })}
          pushSnapshot={noop}
        />
      </CollapsibleSection>
    </div>
  )
}
