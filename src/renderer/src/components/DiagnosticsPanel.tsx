// One diagram element (node, or a legend entry) that references a file on
// disk which no longer resolves — a linked diagram, a custom icon, a
// reference image, or a details `.md`. See ADR 0084. Computed in Canvas
// (an async fs check via IPC), passed in here.
export interface MissingFileEntry {
  // Stable key for React + the action dispatch back in Canvas.
  key: string
  ownerKind: 'node' | 'legend'
  ownerId: string
  // The element's label (or a legend entry's label).
  ownerLabel: string
  // Node type ('entity' | 'container' | 'text' | …) or 'legend'.
  ownerType: string
  resourceKind: 'linkedDiagram' | 'icon' | 'reference' | 'details'
  // The stored relative path.
  relativePath: string
  // Absolute path it was looked for at — the error detail.
  resolvedPath: string
  // Only set when resourceKind === 'icon' on a node — which of the 4 slots.
  iconSlot?: string
}

const RESOURCE_LABEL: Record<MissingFileEntry['resourceKind'], string> = {
  linkedDiagram: 'Linked diagram',
  icon: 'Icon',
  reference: 'Reference image',
  details: 'Details file'
}

// Which kinds have a "pick a replacement" flow (a file dialog). The others
// are fixed by restoring the file on disk and hitting Recheck.
const RELINKABLE = new Set<MissingFileEntry['resourceKind']>(['linkedDiagram', 'icon'])

interface DiagnosticsPanelProps {
  entries: string[]
  // Still-broken references the user hasn't decided on (dismissed ones are
  // already filtered out by Canvas).
  missingFiles: MissingFileEntry[]
  // References the user chose to remove — applied only when the diagram is
  // saved.
  stagedRemovals: MissingFileEntry[]
  onRecheck: () => void
  // Select + frame the owning node on the canvas (node owners only).
  onRevealNode: (nodeId: string) => void
  // Open a file dialog to repoint this reference (linkedDiagram / icon).
  onRelink: (entry: MissingFileEntry) => void
  // Hide this row for the rest of the session (comes back on Recheck).
  onDismiss: (entry: MissingFileEntry) => void
  // Stage / unstage the reference for removal-on-save.
  onStageRemoval: (entry: MissingFileEntry) => void
  onUnstageRemoval: (entry: MissingFileEntry) => void
  onClose: () => void
}

function OwnerLabel({ mf }: { mf: MissingFileEntry }): React.JSX.Element {
  return (
    <>
      <span className="diagnostics-missing-file-kind">{RESOURCE_LABEL[mf.resourceKind]}</span>
      <span className="diagnostics-missing-file-owner">
        {mf.ownerType} &ldquo;{mf.ownerLabel || '(unlabeled)'}&rdquo;
      </span>
    </>
  )
}

// Fixed right-side dock, same shell/toggle model as DetailsPanel/
// RequiredTagsPanel — see ADR 0013. First use was required-tags backfill
// notices (ADR 0022); the generic `entries` text list was deliberately kept
// as plain strings so an unrelated diagram-health check could reuse it
// without a shape change (the legend-empty advisory is one such). The
// "Missing files" section (ADR 0084) is the first check that needs per-row
// controls, so it gets its own typed block above the text list.
//
// Nothing here touches files on disk. A "Remove" only *stages* the
// reference; it is written out when — and only when — the diagram is saved.
// Session-only, recomputed not logged: `entries` is rebuilt every render;
// `missingFiles` / `stagedRemovals` are refreshed on load and on "Recheck".
export default function DiagnosticsPanel({
  entries,
  missingFiles,
  stagedRemovals,
  onRecheck,
  onRevealNode,
  onRelink,
  onDismiss,
  onStageRemoval,
  onUnstageRemoval,
  onClose
}: DiagnosticsPanelProps): React.JSX.Element {
  const empty =
    entries.length === 0 && missingFiles.length === 0 && stagedRemovals.length === 0

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
        {empty && <p className="diagnostics-panel-empty">No notices.</p>}

        {(missingFiles.length > 0 || stagedRemovals.length > 0) && (
          <div className="diagnostics-missing-files">
            <p className="diagnostics-section-title">
              Missing files ({missingFiles.length + stagedRemovals.length})
            </p>
            <p className="diagnostics-panel-hint">
              Decide per element: put the file back (or <em>Relink</em>) and Recheck,{' '}
              <em>Dismiss</em> if it&rsquo;s expected right now, or <em>Remove</em> the reference.
              Nothing is deleted from disk — a removal is written only when you save the diagram.
            </p>

            <ul className="diagnostics-missing-file-list">
              {missingFiles.map((mf) => (
                <li key={mf.key} className="diagnostics-missing-file">
                  {mf.ownerKind === 'node' ? (
                    <button
                      type="button"
                      className="diagnostics-missing-file-target"
                      title="Find this element on the canvas"
                      onClick={() => onRevealNode(mf.ownerId)}
                    >
                      <OwnerLabel mf={mf} />
                    </button>
                  ) : (
                    <span className="diagnostics-missing-file-target diagnostics-missing-file-target-static">
                      <OwnerLabel mf={mf} />
                    </span>
                  )}
                  <span className="diagnostics-missing-file-error" title={mf.resolvedPath}>
                    not found: {mf.relativePath}
                  </span>
                  <div className="diagnostics-missing-file-actions">
                    {RELINKABLE.has(mf.resourceKind) && (
                      <button type="button" onClick={() => onRelink(mf)}>
                        Relink…
                      </button>
                    )}
                    <button type="button" onClick={() => onDismiss(mf)}>
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="diagnostics-missing-file-remove"
                      onClick={() => onStageRemoval(mf)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {stagedRemovals.length > 0 && (
              <>
                <p className="diagnostics-subsection-title">Staged for removal on save</p>
                <ul className="diagnostics-missing-file-list">
                  {stagedRemovals.map((mf) => (
                    <li
                      key={mf.key}
                      className="diagnostics-missing-file diagnostics-missing-file-staged"
                    >
                      <span className="diagnostics-missing-file-target diagnostics-missing-file-target-static">
                        <OwnerLabel mf={mf} />
                      </span>
                      <span className="diagnostics-missing-file-error">{mf.relativePath}</span>
                      <div className="diagnostics-missing-file-actions">
                        <button type="button" onClick={() => onUnstageRemoval(mf)}>
                          Undo
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {entries.length > 0 && (
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
