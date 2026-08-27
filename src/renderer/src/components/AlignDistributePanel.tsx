import { useState } from 'react'
import { NumberField } from '../panels/fields'

interface AlignDistributePanelProps {
  disabled: boolean
  onAlign: (axis: 'vertical' | 'horizontal', gapPx: number) => void
  onClose: () => void
}

const DEFAULT_GAP_PX = 20

// Same fixed right-side dock shell as PreferencesPanel/DiagnosticsPanel/etc —
// see main.css's shared .align-distribute-panel* rules. Session-only gap
// value (not a Setting/Configuration in this app's own tiering, ADR 0052)
// — resets to the default each time the panel reopens, deliberately not
// persisted anywhere.
export default function AlignDistributePanel({
  disabled,
  onAlign,
  onClose
}: AlignDistributePanelProps): React.JSX.Element {
  const [gap, setGap] = useState(DEFAULT_GAP_PX)
  return (
    <div className="align-distribute-panel">
      <div className="align-distribute-panel-toolbar">
        <span className="align-distribute-panel-title">Align / Distribute</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="align-distribute-panel-body">
        <p className="align-distribute-panel-hint">
          Arranges the selected elements into a column or row, spaced edge-to-edge by the gap
          below — the leftmost/topmost element among them stays put, the rest line up after it.
        </p>
        <NumberField
          label="Gap (px)"
          value={gap}
          mixed={false}
          min={0}
          onChange={(v) => setGap(v ?? 0)}
          onSessionStart={() => {}}
          onSessionEnd={() => {}}
        />
        <div className="align-distribute-panel-actions">
          <button type="button" disabled={disabled} onClick={() => onAlign('vertical', gap)}>
            Align Vertically
          </button>
          <button type="button" disabled={disabled} onClick={() => onAlign('horizontal', gap)}>
            Align Horizontally
          </button>
        </div>
        {disabled && (
          <p className="align-distribute-panel-hint">Select at least two elements to use this.</p>
        )}
      </div>
    </div>
  )
}
