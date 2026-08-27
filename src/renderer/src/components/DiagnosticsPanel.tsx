interface DiagnosticsPanelProps {
  entries: string[]
  onRecheck: () => void
  onClose: () => void
}

// Fixed right-side dock, same shell/toggle model as DetailsPanel/
// RequiredTagsPanel — see ADR 0013. First use was required-tags backfill
// notices (ADR 0022); the list was deliberately kept as generic
// text so a future, unrelated diagram-health check could reuse it without
// a shape change — the legend-empty advisory is the first of
// those, combined with the required-tags notices at Canvas.tsx's own
// display layer (`displayedDiagnostics`), not inside this state at all.
//
// Session-only: `entries` is recomputed fresh by the caller on every
// render (the legend check) plus Canvas's own `diagnostics` state
// (replaced, not appended to, on every required-tags sync pass) — neither
// half is written into the .chd file, and neither is a growing history
// log. `onRecheck` currently just re-runs the required-tags sync — the
// button itself is deliberately generic ("Recheck," not "Resync required
// tags") so it keeps making sense as more checks get folded in; the
// check(s) it actually runs are Canvas's call, not this panel's.
export default function DiagnosticsPanel({
  entries,
  onRecheck,
  onClose
}: DiagnosticsPanelProps): React.JSX.Element {
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
          <p className="diagnostics-panel-empty">No notices.</p>
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
