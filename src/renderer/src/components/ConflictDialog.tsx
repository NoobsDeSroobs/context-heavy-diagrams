import { useEffect, useRef, useState } from 'react'
import { HUB_KEY, type Decision } from '@shared/documentSave'
import {
  subscribeToConflictDialog,
  type ConflictDecisions,
  type ConflictItem
} from '../conflictDialog'

interface Pending {
  items: ConflictItem[]
  resolve: (d: ConflictDecisions | null) => void
}

// The per-file save-conflict dialog (ADR 0092). Mounted once, by Canvas. Every file
// that has unsaved edits here AND changed on disk gets its own choice — Keep mine
// (overwrite the disk version) or Take disk (drop my edits, adopt the file) — so a
// single blanket answer never throws work away. Nothing is preselected: overwriting
// or discarding is always a deliberate click. Like the alert dialog: no
// click-outside-to-close (an error shouldn't vanish on a stray click), Escape cancels.
export default function ConflictDialog(): React.JSX.Element | null {
  const [pending, setPending] = useState<Pending | null>(null)
  const [choices, setChoices] = useState<Record<string, Decision | undefined>>({})
  const queueRef = useRef<Pending[]>([])
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () =>
      subscribeToConflictDialog((items, resolve) => {
        const request = { items, resolve }
        // One dialog at a time; a second request waits its turn.
        setPending((current) => {
          if (current) {
            queueRef.current.push(request)
            return current
          }
          setChoices({})
          return request
        })
      }),
    []
  )

  const finish = (result: ConflictDecisions | null): void => {
    pending?.resolve(result)
    const next = queueRef.current.shift() ?? null
    setChoices({})
    setPending(next)
  }

  useEffect(() => {
    if (!pending) return undefined
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') finish(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only reads `pending`
  }, [pending])

  if (!pending) return null
  const { items } = pending
  const allChosen = items.every((item) => choices[item.key] !== undefined)
  const setAll = (decision: Decision): void =>
    setChoices(Object.fromEntries(items.map((item) => [item.key, decision])))

  return (
    <div className="about-dialog-overlay">
      <div className="about-dialog conflict-dialog" role="alertdialog" aria-modal="true">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Changed outside the app</span>
        </div>
        <div className="about-dialog-body">
          <p>
            Everything else was saved. {items.length === 1 ? 'This file has' : 'These files have'}{' '}
            unsaved changes here AND {items.length === 1 ? 'was' : 'were'} changed outside the app.
            Choose what to keep for each:
          </p>
          <ul className="conflict-dialog-list">
            {items.map((item) => {
              const choice = choices[item.key]
              return (
                <li key={item.key} className="conflict-dialog-row">
                  <span className="conflict-dialog-name">{item.label}</span>
                  <span className="conflict-dialog-choices">
                    <button
                      type="button"
                      className={choice === 'mine' ? 'selected' : ''}
                      aria-pressed={choice === 'mine'}
                      onClick={() => setChoices((c) => ({ ...c, [item.key]: 'mine' }))}
                    >
                      Keep mine
                    </button>
                    <button
                      type="button"
                      className={choice === 'disk' ? 'selected' : ''}
                      aria-pressed={choice === 'disk'}
                      onClick={() => setChoices((c) => ({ ...c, [item.key]: 'disk' }))}
                    >
                      Take disk
                    </button>
                  </span>
                  {item.key === HUB_KEY && choice === 'disk' && (
                    <span className="conflict-dialog-hint">
                      Reloads the diagram from disk — your unsaved changes to the diagram itself
                      are lost (unsaved notes are kept) — and stops this save; save again after.
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="conflict-dialog-note">
            To keep both versions: Cancel (they stay unsaved here), commit the disk version in
            git, then save again and reconcile in git.
          </p>
          <div className="alert-dialog-actions">
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => setAll('mine')}>
                  Keep mine for all
                </button>
                <button type="button" onClick={() => setAll('disk')}>
                  Take disk for all
                </button>
              </>
            )}
            <button type="button" ref={cancelRef} onClick={() => finish(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!allChosen}
              onClick={() => finish(choices as ConflictDecisions)}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
