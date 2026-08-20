interface DiagnosticsPanelProps {
  entries: string[]
  onRecheck: () => void
  onClose: () => void
}

// Fixed right-side dock, same shell/toggle model as DetailsPanel/
// RequiredTagsPanel — see ADR 0013. First use is required-tags backfill
// notices (epic 0034/ADR 0022), but the list is generic text so future
// diagram-health checks can reuse it without a shape change.
//
// Session-only: `entries` is Canvas's `diagnostics` state, replaced (not
// appended to) on every sync pass, not written into the .chd file — it
// shows the current state as of the last sync, not a growing history log.
// `onRecheck` currently just re-runs that same required-tags sync — the
// button itself is deliberately generic ("Recheck," not "Resync required
// tags") so a future second compliance check can wire into the same
// button without a rename; the check(s) it actually runs are Canvas's
// call, not this panel's.
export default function DiagnosticsPanel({ entries, onRecheck, onClose }: DiagnosticsPanelProps): React.JSX.Element {
  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-panel-toolbar">
        <span className="diagnostics-panel-title">Diagnostics</span>
        <div className="details-panel-spacer" />
        <button type="button" onClick={onRecheck}>
          Recheck
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="diagnostics-panel-body">
        {entries.length === 0 ? (
          <p className="diagnostics-panel-empty">No notices — metadata is in sync with the required-tags template.</p>
        ) : (
          <ul className="diagnostics-panel-list">
            {entries.map((message, index) => (
              // Plain text, no stable id from the source (see
              // syncElementMetadata) — index is fine since this list is
              // wholly replaced on every sync, never reordered in place.
              <li key={index}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
