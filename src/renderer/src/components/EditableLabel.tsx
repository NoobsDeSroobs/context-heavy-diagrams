import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent
} from 'react'

interface EditableLabelProps {
  value: string
  onCommit: (value: string) => void
  className?: string
  inputClassName?: string
  // Font styling from NodeStyle/EdgeStyle (ADR 0014) — applied to both the
  // display div and the edit-mode input so the look doesn't jump on
  // double-click.
  style?: CSSProperties
  // Opt-in multi-line editing (ADR 0074-era decision — see the multi-line
  // labels ADR): Shift+Enter inserts a newline, Enter still commits, and the
  // editor is an auto-growing <textarea>. Default false — single-line
  // <input>, unchanged — so structured fields (metadata values) stay
  // single-line. The on-canvas *display* guardrail (clip to the element's
  // box, don't grow the shape) is CSS on each label class, not here.
  multiline?: boolean
}

// Double-click to edit, Enter/blur commits, Escape cancels. dir="auto" so
// right-to-left text renders correctly without us tracking direction
// ourselves — see the "user-authored text" principle in
// docs/architecture/overview.md. The input needs `nodrag nopan`: same
// reasoning as TextNode's rotate handle — without it, clicking into the
// input to place a cursor gets intercepted as a node-drag attempt.
export default function EditableLabel({
  value,
  onCommit,
  className,
  inputClassName,
  style,
  multiline = false
}: EditableLabelProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // A <textarea> doesn't grow with its content on its own — match its height
  // to its scrollHeight after every change and when editing starts.
  const autosize = useCallback((): void => {
    const el = inputRef.current
    if (el instanceof HTMLTextAreaElement) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
      autosize()
    }
  }, [editing, autosize])

  const startEditing = (event: MouseEvent): void => {
    event.stopPropagation()
    setDraft(value)
    setEditing(true)
  }

  const commit = (): void => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }

  const cancel = (): void => {
    setEditing(false)
    setDraft(value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter') {
      // Mid-composition Enter (CJK IME) confirms the candidate, not the label.
      if (event.nativeEvent.isComposing) return
      // Shift+Enter in a multi-line field falls through to the textarea's
      // own newline insertion; everywhere else Enter commits.
      if (multiline && event.shiftKey) return
      event.preventDefault()
      commit()
    }
  }

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setDraft(event.target.value)
    if (multiline) autosize()
  }

  if (editing) {
    const inputClass = `editable-label-input${multiline ? ' editable-label-input-multiline' : ''} nodrag nopan${inputClassName ? ` ${inputClassName}` : ''}`
    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className={inputClass}
        dir="auto"
        rows={1}
        style={style}
        value={draft}
        onChange={onChange}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className={inputClass}
        dir="auto"
        style={style}
        value={draft}
        onChange={onChange}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    )
  }

  return (
    <div
      className={className}
      dir="auto"
      // pre-wrap only when multi-line is allowed, so a stray newline that
      // somehow lands in a single-line label (hand-edited file, paste) still
      // collapses to a space rather than breaking layout.
      style={multiline ? { whiteSpace: 'pre-wrap', ...style } : style}
      onDoubleClick={startEditing}
    >
      {value}
    </div>
  )
}
