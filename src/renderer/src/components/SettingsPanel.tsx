import type { AppSettings } from '../settings'
import { FieldRow, NumberField } from '../panels/fields'
import { useRafThrottledCallback } from '../hooks/useRafThrottledCallback'

interface SettingsPanelProps {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
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
export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps): React.JSX.Element {
  // Same rAF-coalescing as ColorField (panels/fields.tsx) — epic 0067. This
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
        <FieldRow label="Scan for unsaved diagrams on startup">
          <input
            type="checkbox"
            checked={settings.scanForUnsavedRecoveryOnStartup}
            onChange={(e) => onChange({ scanForUnsavedRecoveryOnStartup: e.target.checked })}
            title="Look for crash-recovery snapshots from diagrams that were never saved, every time the app starts"
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
