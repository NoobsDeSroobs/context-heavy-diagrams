import type { OrphanedNoteEdit } from '@shared/document/documentSave'

// The first line with text, cut to a length that fits a row.
function preview(content: string): string {
  const line = content.split('\n').find((l) => l.trim() !== '') ?? ''
  const text = line.trim().replace(/^#+\s*/, '')
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

// The "Unsaved note edits" block of the Diagnostics panel (ADR 0092): text typed into a note whose
// element has since been deleted, or is not in the reloaded diagram. It is kept, so nothing typed
// is lost without the person saying so; undoing the deletion brings the element, and the text,
// back. Nothing is shown when there is none.
export default function OrphanedNotesSection({
  edits,
  onCopy,
  onDiscard
}: {
  edits: OrphanedNoteEdit[]
  onCopy: (edit: OrphanedNoteEdit) => void
  onDiscard: (edit: OrphanedNoteEdit) => void
}): React.JSX.Element | null {
  if (edits.length === 0) return null
  return (
    <div className="diagnostics-missing-files">
      <p className="diagnostics-section-title">Unsaved note edits ({edits.length})</p>
      <p className="diagnostics-panel-hint">
        The element these notes belonged to is no longer in the diagram. The text is kept until you
        discard it. <em>Copy</em> it first if you want it somewhere else; undoing the deletion
        brings the element back with its text.
      </p>
      <ul className="diagnostics-missing-file-list">
        {edits.map((edit) => (
          <li key={edit.nodeId} className="diagnostics-missing-file">
            <span className="diagnostics-missing-file-target diagnostics-missing-file-target-static">
              <span className="diagnostics-missing-file-kind">{edit.path ?? 'not saved yet'}</span>
              <span className="diagnostics-missing-file-owner">
                &ldquo;{preview(edit.content) || '(empty)'}&rdquo;
              </span>
            </span>
            <div className="diagnostics-missing-file-actions">
              <button type="button" onClick={() => onCopy(edit)}>
                Copy text
              </button>
              <button
                type="button"
                className="diagnostics-missing-file-remove"
                onClick={() => onDiscard(edit)}
              >
                Discard
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
