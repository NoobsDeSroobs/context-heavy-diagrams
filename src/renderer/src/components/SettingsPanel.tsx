import type { AppSettings } from '../settings'
import { NumberField } from '../panels/fields'

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
      </div>
    </div>
  )
}
