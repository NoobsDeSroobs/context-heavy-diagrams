import { useEffect, useRef, useState } from 'react'

interface RevisionDialogProps {
  // True when the window has edits it has not saved: the comparison reads the file on disk.
  hasUnsavedChanges: boolean
  onCompare: (revision: string) => void
  onClose: () => void
}

// Asks which git revision to compare the diagram with (a branch, a tag, a commit, HEAD~2). Enter
// compares, Escape cancels; like the alert dialog, a stray click outside does not close it.
export default function RevisionDialog({
  hasUnsavedChanges,
  onCompare,
  onClose
}: RevisionDialogProps): React.JSX.Element {
  const [revision, setRevision] = useState('HEAD')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    const trimmed = revision.trim()
    if (trimmed !== '') onCompare(trimmed)
  }

  return (
    <div className="about-dialog-overlay">
      <div className="about-dialog alert-dialog" role="dialog" aria-modal="true">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Compare with a git revision</span>
        </div>
        <div className="about-dialog-body">
          <p className="alert-dialog-message">
            Compares the file on disk with the version at this revision: a branch, a tag, a commit,
            or HEAD for the last commit (HEAD~2 for two commits back).
            {hasUnsavedChanges ? ' This window has unsaved changes; they are not included.' : ''}
          </p>
          <input
            ref={inputRef}
            type="text"
            value={revision}
            spellCheck={false}
            aria-label="Git revision"
            onChange={(event) => setRevision(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') onClose()
            }}
          />
          <div className="alert-dialog-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={revision.trim() === ''}>
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
