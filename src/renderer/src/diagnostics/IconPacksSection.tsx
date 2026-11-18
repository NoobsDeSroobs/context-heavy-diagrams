import type { IconPackProblems } from './iconPackProblems'

// The "Icon packs" part of the Diagnostics panel (ADR 0188): the installed packs the diagram's icons
// name that this machine lacks, with the pack's own "if missing" text from the file and a way to
// the manager, and the icons missing from a pack that is installed.
export default function IconPacksSection({
  problems,
  onRevealNode,
  onOpenManager
}: {
  problems: IconPackProblems
  onRevealNode: (nodeId: string) => void
  onOpenManager: () => void
}): React.JSX.Element | null {
  const { missingPacks, missingIcons } = problems
  if (missingPacks.length === 0 && missingIcons.length === 0) return null
  return (
    <div className="diagnostics-missing-files">
      <p className="diagnostics-section-title">
        Icon packs ({missingPacks.length + missingIcons.length})
      </p>
      <ul className="diagnostics-missing-file-list">
        {missingPacks.map((pack) => {
          const first = pack.uses.find((use) => use.ownerKind === 'node')
          return (
            <li key={pack.name} className="diagnostics-missing-file">
              <span className="diagnostics-missing-file-target diagnostics-missing-file-target-static">
                <span className="diagnostics-missing-file-kind">Icon pack</span>
                <span className="diagnostics-missing-file-owner">
                  &ldquo;{pack.name}&rdquo;
                  {pack.note?.version ? ` (version ${pack.note.version})` : ''} is not installed
                </span>
              </span>
              <span className="diagnostics-missing-file-error">
                {pack.note?.ifMissing ||
                  'Install the pack from its files, or the icons are left empty.'}{' '}
                Used by {pack.uses.length} icon{pack.uses.length === 1 ? '' : 's'}.
              </span>
              <div className="diagnostics-missing-file-actions">
                <button type="button" onClick={onOpenManager}>
                  Icon packs…
                </button>
                {first && (
                  <button type="button" onClick={() => onRevealNode(first.ownerId)}>
                    Find one
                  </button>
                )}
              </div>
            </li>
          )
        })}
        {missingIcons.map((use, index) => (
          <li
            key={`${use.ownerId}:${use.pack}:${use.path}:${index}`}
            className="diagnostics-missing-file"
          >
            {use.ownerKind === 'node' ? (
              <button
                type="button"
                className="diagnostics-missing-file-target"
                title="Find this element on the canvas"
                onClick={() => onRevealNode(use.ownerId)}
              >
                <span className="diagnostics-missing-file-kind">Icon</span>
                <span className="diagnostics-missing-file-owner">
                  {use.ownerType} &ldquo;{use.ownerLabel || '(unlabeled)'}&rdquo;
                </span>
              </button>
            ) : (
              <span className="diagnostics-missing-file-target diagnostics-missing-file-target-static">
                <span className="diagnostics-missing-file-kind">Icon</span>
                <span className="diagnostics-missing-file-owner">
                  legend &ldquo;{use.ownerLabel || '(unlabeled)'}&rdquo;
                </span>
              </span>
            )}
            <span className="diagnostics-missing-file-error">
              not in pack &ldquo;{use.pack}&rdquo;: {use.path}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
