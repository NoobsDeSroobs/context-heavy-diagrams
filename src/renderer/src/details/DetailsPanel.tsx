import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DetailsPanelProps {
  title: string
  content: string
  onChange: (content: string) => void
  onClose: () => void
}

type Mode = 'edit' | 'preview'

// Fixed right-side dock, not a modal. Deliberately minimal
// formatting toolbar (bold/italic/heading/bullet), not a rich editor, per
// the brief's own framing: most substantial edits happen in an external
// editor, this is just enough to jot something down without leaving the app.
export default function DetailsPanel({
  title,
  content,
  onChange,
  onClose
}: DetailsPanelProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('preview')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wrapSelection = (before: string, after: string = before): void => {
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd, value } = el
    const selected = value.slice(selectionStart, selectionEnd)
    const next =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(selectionStart + before.length, selectionEnd + before.length)
    })
  }

  const prefixLine = (prefix: string): void => {
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd, value } = el
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length)
    })
  }

  return (
    <div className="details-panel">
      <div className="details-panel-toolbar">
        <span className="details-panel-title" title={title}>
          {title}
        </span>
        {mode === 'edit' && (
          <div className="details-panel-format-buttons">
            <button type="button" title="Bold" onClick={() => wrapSelection('**')}>
              <strong>B</strong>
            </button>
            <button type="button" title="Italic" onClick={() => wrapSelection('_')}>
              <em>I</em>
            </button>
            <button type="button" title="Heading" onClick={() => prefixLine('# ')}>
              H
            </button>
            <button type="button" title="Bullet list" onClick={() => prefixLine('- ')}>
              •
            </button>
          </div>
        )}
        <div className="details-panel-spacer" />
        <button type="button" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}>
          {mode === 'edit' ? 'Preview' : 'Edit'}
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="details-panel-body">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="details-panel-textarea"
            dir="auto"
            value={content}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Notes about this node — purpose, integration type, inputs/outputs, anything worth writing down."
          />
        ) : (
          <div className="details-panel-preview" dir="auto">
            {/* remark-gfm: tables, strikethrough, task lists — react-markdown
                is CommonMark-only without it (see known-issues.md). */}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
