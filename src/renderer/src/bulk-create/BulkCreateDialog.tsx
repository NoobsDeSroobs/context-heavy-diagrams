import { useEffect, useRef, useState } from 'react'

interface BulkCreateDialogProps {
  // e.g. "entity" / "container" — used for the title and the live count line.
  typeLabel: string
  onConfirm: (labels: string[]) => void
  onClose: () => void
}

function parseLabels(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// Right-click entry point on ItemPalette's Entity/Container buttons — see
// ADR 0089. Styled after ExportImageDialog's centered-overlay shell rather
// than the click-anchored popups (ColorPickerPopup/IconPicker); a
// multi-line paste target reads better centered than pinned to a small
// button's corner.
export default function BulkCreateDialog({
  typeLabel,
  onConfirm,
  onClose
}: BulkCreateDialogProps): React.JSX.Element {
  const [text, setText] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const labels = parseLabels(text)

  const confirm = (): void => {
    if (labels.length === 0) return
    onConfirm(labels)
  }

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog bulk-create-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Create multiple {typeLabel}s</span>
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="about-dialog-body">
          <p>
            One line per {typeLabel} — each becomes that {typeLabel}&apos;s label.
          </p>
          <textarea
            ref={textareaRef}
            className="bulk-create-textarea"
            value={text}
            placeholder={'l1\nl2\nl3'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                confirm()
              }
            }}
          />
          <p className="bulk-create-count">
            {labels.length} {typeLabel}
            {labels.length === 1 ? '' : 's'} will be created
          </p>
          <div className="required-tag-value-confirm-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" disabled={labels.length === 0} onClick={confirm}>
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
