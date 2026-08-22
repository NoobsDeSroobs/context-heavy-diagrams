import type { GravityPreset } from '@shared/diagram'
import { DEFAULT_GRAVITY_PRESETS, effectiveGravityPresets } from '../lineGravityPresets'

interface GravityPresetsPanelProps {
  // Raw, possibly-empty diagram value — NOT the resolved list DiagramContext
  // exposes to LineNode. This panel needs to tell "inheriting the built-ins"
  // apart from "explicitly customized," which the resolved list alone can't.
  presets: GravityPreset[]
  onChange: (presets: GravityPreset[]) => void
  onClose: () => void
}

// A line point's right-click menu offers whichever of these the current
// diagram defines — see GravityPreset's own comment in shared/diagram.ts
// for why this is diagram-level, not a hardcoded app setting: a diagram's
// own layout may call for its own bend values, and reproducing it reliably
// (for any reader, not just this app) means those named values need to be
// in the file, not implied by whatever version of this app authored it.
export default function GravityPresetsPanel({
  presets,
  onChange,
  onClose
}: GravityPresetsPanelProps): React.JSX.Element {
  const isCustomized = presets.length > 0
  const rows = effectiveGravityPresets(presets)

  const updateRow = (index: number, patch: Partial<GravityPreset>): void => {
    onChange(rows.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const removeRow = (index: number): void => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const moveRow = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const addRow = (): void => {
    let label = 'Custom'
    let n = 2
    while (rows.some((p) => p.label === label)) label = `Custom ${n++}`
    onChange([...rows, { id: `preset-${crypto.randomUUID()}`, label, value: 0.5 }])
  }

  return (
    <div className="required-tags-panel gravity-presets-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Line bend presets</span>
        <div className="details-panel-spacer" />
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={!isCustomized}
          title="Revert to this app's own built-in presets"
        >
          Reset to defaults
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="required-tags-panel-body">
        <p className="required-tags-panel-hint">
          Offered on a line point&rsquo;s right-click menu, controlling how sharply the curve bends there. Saved with
          this diagram — {isCustomized ? 'currently customized' : "not customized yet, showing this app's built-in defaults"}
          . Editing any value below saves this diagram&rsquo;s own copy of the whole list.
        </p>
        <div className="required-tag-values-list">
          {rows.map((preset, index) => (
            <div key={preset.id} className="required-tag-value-row">
              <input
                className="required-tag-value-input"
                type="text"
                value={preset.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
              />
              <input
                className="required-tag-value-input gravity-preset-value-input"
                type="number"
                step={0.05}
                value={preset.value}
                onChange={(e) => updateRow(index, { value: Number(e.target.value) })}
              />
              <button
                type="button"
                className="required-tag-value-move"
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="required-tag-value-move"
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, 1)}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="required-tag-value-remove"
                onClick={() => removeRow(index)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="required-tag-add" onClick={addRow}>
          Add preset
        </button>
        {!isCustomized && (
          <p className="required-tags-panel-hint">{DEFAULT_GRAVITY_PRESETS.length} built-in presets shown above.</p>
        )}
      </div>
    </div>
  )
}
