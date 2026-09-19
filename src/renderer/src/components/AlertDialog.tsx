import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeToAlerts } from '../alerts'

// Renders whatever showAlert() (alerts.ts) receives. Mounted once, by Canvas.
// Messages queue rather than replace each other, so two errors fired in a
// row are both readable. The text is user-selectable and there's a Copy
// button — the whole reason this exists instead of window.alert. Deliberately
// no click-outside-to-close: an error shouldn't vanish because of a stray click
// while someone is trying to select it. Enter/Escape close it.
export default function AlertDialog(): React.JSX.Element | null {
  const [queue, setQueue] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => subscribeToAlerts((message) => setQueue((prev) => [...prev, message])), [])

  const current = queue[0]
  const dismiss = useCallback(() => {
    setCopied(false)
    setQueue((prev) => prev.slice(1))
  }, [])

  useEffect(() => {
    if (current === undefined) return undefined
    okRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, dismiss])

  if (current === undefined) return null

  const copy = (): void => {
    navigator.clipboard
      .writeText(current)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <div className="about-dialog-overlay">
      <div className="about-dialog alert-dialog" role="alertdialog" aria-modal="true">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">
            Message{queue.length > 1 ? ` (1 of ${queue.length})` : ''}
          </span>
        </div>
        <div className="about-dialog-body">
          <pre className="alert-dialog-message">{current}</pre>
          <div className="alert-dialog-actions">
            <button type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" ref={okRef} onClick={dismiss}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
