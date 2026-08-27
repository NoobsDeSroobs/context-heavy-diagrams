import { useEffect, useRef, useState } from 'react'
import type { EdgeStyle } from '@shared/diagram'
import type { AppSettings } from '../settings'
import { FieldRow, NumberField, SelectField } from '../panels/fields'
import { useRafThrottledCallback } from '../hooks/useRafThrottledCallback'

// '' means the field is absent (bezier, today's only historical behavior)
// — see PropertyPanel.tsx's identical ROUTING_STYLE_OPTIONS/own comment on
// why this is a local copy rather than a shared one (react-refresh/only-
// export-components).
const ROUTING_STYLE_OPTIONS: {
  value: Exclude<EdgeStyle['routingStyle'], undefined> | ''
  label: string
}[] = [
  { value: '', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
  { value: 'catmullRom', label: 'Catmull-Rom (gravity)' }
]

interface SettingsPanelProps {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

// Local draft, resynced from `value` only while not focused — same
// technique as fields.tsx's own useDraft (not reused directly: it isn't
// exported, and mixing an exported hook into a component-only file would
// trip react-refresh/only-export-components). Generic
// (originally zoom-only) since ZoomLimitField and IsolateOpacityField
// below both need a fractional `step`, which NumberField's own draft
// doesn't expose.
function useNumberDraft(value: number): [string, (v: string) => void, () => void, () => void] {
  const [draft, setDraft] = useState(String(value))
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value))
  }, [value])
  return [
    draft,
    setDraft,
    () => {
      focusedRef.current = true
    },
    () => {
      focusedRef.current = false
      setDraft(String(value))
    }
  ]
}

// One compact row, not two full-width NumberField rows — the user's own
// spec: "Zoom limit: in [0.1] out[2.0]". min/max HTML attributes on each
// box keep the two ends from crossing each other in the UI, but don't
// stop a genuinely bad pair (min > max) from being saved — React Flow's
// own runtime behavior at that point is untested/unspecified, not
// something this field tries to prevent.
function ZoomLimitField({
  minZoom,
  maxZoom,
  onChange
}: {
  minZoom: number
  maxZoom: number
  onChange: (patch: { minZoom?: number; maxZoom?: number }) => void
}): React.JSX.Element {
  const [minDraft, setMinDraft, onMinFocus, onMinBlur] = useNumberDraft(minZoom)
  const [maxDraft, setMaxDraft, onMaxFocus, onMaxBlur] = useNumberDraft(maxZoom)
  return (
    <FieldRow label="Zoom limit">
      <div className="settings-zoom-limit">
        <span className="settings-zoom-limit-label">in</span>
        <input
          type="number"
          className="property-number-field settings-zoom-limit-input"
          step={0.05}
          min={0.01}
          max={1}
          value={minDraft}
          onFocus={onMinFocus}
          onChange={(e) => {
            setMinDraft(e.target.value)
            if (e.target.value !== '') onChange({ minZoom: Number(e.target.value) })
          }}
          onBlur={onMinBlur}
          title="Minimum zoom (most zoomed out)"
        />
        <span className="settings-zoom-limit-label">out</span>
        <input
          type="number"
          className="property-number-field settings-zoom-limit-input"
          step={0.5}
          min={1}
          value={maxDraft}
          onFocus={onMaxFocus}
          onChange={(e) => {
            setMaxDraft(e.target.value)
            if (e.target.value !== '') onChange({ maxZoom: Number(e.target.value) })
          }}
          onBlur={onMaxBlur}
          title="Maximum zoom (most zoomed in)"
        />
      </div>
    </FieldRow>
  )
}

// Fractional 0-1 opacity (see ADR 0063) — NumberField's own draft
// has no `step`, same reason ZoomLimitField above doesn't use it either.
// Same two-class combo ZoomLimitField's own inputs use: .property-number-
// field for the actual theme-aware background/border/color (its own
// width: 100% is what this field doesn't want), .settings-zoom-limit-
// input layered after it to override just the width down to a small
// fixed box and hide the native spinner. Dropping the first class
// entirely (an earlier version of this fix did) leaves the input with no
// background/border rule at all — browser default white, which is
// exactly wrong in dark theme.
function IsolateOpacityField({
  value,
  onChange
}: {
  value: number
  onChange: (patch: { isolateOpacity: number }) => void
}): React.JSX.Element {
  const [draft, setDraft, onFocus, onBlur] = useNumberDraft(value)
  return (
    <FieldRow label="Isolate opacity">
      <input
        type="number"
        className="property-number-field settings-zoom-limit-input"
        step={0.05}
        min={0}
        max={1}
        value={draft}
        onFocus={onFocus}
        onChange={(e) => {
          setDraft(e.target.value)
          if (e.target.value !== '') onChange({ isolateOpacity: Number(e.target.value) })
        }}
        onBlur={onBlur}
        title="How dim non-matching elements go while Isolate is active (0 = invisible, 1 = no dimming)"
      />
    </FieldRow>
  )
}

// Same fixed right-side dock shell as DetailsPanel/RequiredTagsPanel/
// DiagnosticsPanel/HighlightsPanel — see ADR 0013. Global, app-wide
// preferences (settings.ts), not diagram content: nothing here goes
// through pushSnapshot/undo, and it isn't reset when a different diagram
// loads. See ADR 0032 for why this panel exists as its own thing.
//
// Reuses NumberField from the property panel's field primitives even
// though nothing here is a style field on a selection — it's the same
// "draft until blur" number input either way. `mixed`/session callbacks
// are property-panel concepts (multi-selection, undo grouping) that don't
// apply to a single global value, so they're passed as always-false/no-op.
export default function SettingsPanel({
  settings,
  onChange,
  onClose
}: SettingsPanelProps): React.JSX.Element {
  // Same rAF-coalescing as ColorField (panels/fields.tsx) — see ADR 0056. This
  // input doesn't go through that shared component (see the comment below),
  // so it needs its own throttle rather than inheriting one.
  const throttledOnChange = useRafThrottledCallback(onChange)
  return (
    <div className="settings-panel">
      <div className="settings-panel-toolbar">
        <span className="settings-panel-title">Settings</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="settings-panel-body">
        <p className="settings-panel-hint">
          Applies to every edge in every diagram — not a per-edge or per-diagram override.
        </p>
        <NumberField
          label="Edge straight lead-in (px)"
          value={settings.edgeStraightSegmentLength}
          mixed={false}
          min={0}
          onChange={(v) => onChange({ edgeStraightSegmentLength: v ?? 0 })}
          onSessionStart={() => {}}
          onSessionEnd={() => {}}
        />
        <NumberField
          label="Max connection points per side"
          value={settings.maxConnectionPointsPerSide}
          mixed={false}
          min={1}
          onChange={(v) => onChange({ maxConnectionPointsPerSide: v ?? 1 })}
          onSessionStart={() => {}}
          onSessionEnd={() => {}}
        />
        <SelectField
          label="Default edge routing"
          value={settings.defaultEdgeStyle.routingStyle ?? ''}
          mixed={false}
          options={ROUTING_STYLE_OPTIONS}
          onChange={(v) =>
            onChange({
              defaultEdgeStyle: {
                ...settings.defaultEdgeStyle,
                routingStyle: v === '' ? undefined : v
              }
            })
          }
          pushSnapshot={() => {}}
        />
        <FieldRow label="Scan for unsaved diagrams on startup">
          <input
            type="checkbox"
            checked={settings.scanForUnsavedRecoveryOnStartup}
            onChange={(e) => onChange({ scanForUnsavedRecoveryOnStartup: e.target.checked })}
            title="Look for crash-recovery snapshots from diagrams that were never saved, every time the app starts"
          />
        </FieldRow>
        <ZoomLimitField minZoom={settings.minZoom} maxZoom={settings.maxZoom} onChange={onChange} />
        <IsolateOpacityField value={settings.isolateOpacity} onChange={onChange} />
        <FieldRow label="Drag-select requires full enclosure">
          <input
            type="checkbox"
            checked={settings.dragSelectRequiresFullEnclosure}
            onChange={(e) => onChange({ dragSelectRequiresFullEnclosure: e.target.checked })}
            title="On: an element must be entirely inside the drag box to be selected. Off: touching the box is enough."
          />
        </FieldRow>
        <FieldRow label="Selected edge color">
          {/* Plain swatch, not the property panel's ColorField — that one
              supports an "unset" state (its × clear button) which doesn't
              apply here; this setting always has a concrete color, same
              always-required-value treatment as HighlightsPanel's own
              row swatches. */}
          <input
            type="color"
            className="property-color-swatch"
            value={settings.selectedEdgeHighlightColor}
            onChange={(e) => throttledOnChange({ selectedEdgeHighlightColor: e.target.value })}
            title="Color a selected edge's line swaps to, so it stays easy to track in a busy diagram"
          />
        </FieldRow>
      </div>
    </div>
  )
}
