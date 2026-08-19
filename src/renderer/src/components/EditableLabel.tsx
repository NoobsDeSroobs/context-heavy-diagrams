import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'

interface EditableLabelProps {
  value: string
  onCommit: (value: string) => void
  className?: string
  inputClassName?: string
  // Font styling from NodeStyle/EdgeStyle (ADR 0014) — applied to both the
  // display div and the edit-mode input so the look doesn't jump on
  // double-click.
  style?: CSSProperties
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
  style
}: EditableLabelProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

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

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`editable-label-input nodrag nopan${inputClassName ? ` ${inputClassName}` : ''}`}
        dir="auto"
        style={style}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    )
  }

  return (
    <div className={className} dir="auto" style={style} onDoubleClick={startEditing}>
      {value}
    </div>
  )
}
