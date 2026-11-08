import { HUB_FILE_KEY, changedFilesMessage, type ChangedFile } from '@shared/document/changedFiles'

// The one notice for files that changed outside the app (ADR 0159): which ones, which of them have
// unsaved edits here, and what to do. Review is offered when the diagram itself changed.
export default function OutsideChangeNotice({
  files,
  onReview,
  onReload,
  onIgnore
}: {
  files: ChangedFile[]
  onReview: () => void
  onReload: () => void
  onIgnore: () => void
}): React.JSX.Element | null {
  if (files.length === 0) return null
  const diagramChanged = files.some((f) => f.key === HUB_FILE_KEY)
  return (
    <span className="toolbar-external-change" role="alert">
      {changedFilesMessage(files)}
      {diagramChanged && (
        <button type="button" onClick={onReview}>
          Review changes
        </button>
      )}
      <button type="button" onClick={onReload}>
        Reload
      </button>
      <button type="button" onClick={onIgnore}>
        Ignore
      </button>
    </span>
  )
}
