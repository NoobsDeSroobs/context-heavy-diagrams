import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SAVE_AS_OPTIONS,
  type SaveAsOptions,
  type SaveAsPlan
} from '@shared/document/saveAsCopy'
import {
  subscribeToSaveAsDialog,
  suggestedCopyPath,
  type SaveAsChoice,
  type SaveAsRequest
} from './saveAsPrompt'

interface Pending {
  request: SaveAsRequest
  resolve: (choice: SaveAsChoice | null) => void
}

const SHOWN_REMOVED = 6

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const removedWord = (ticked: boolean): string => (ticked ? '' : ' removed')

// The Save As dialog (ADR 0160). Mounted once, by Canvas. The path is only ever set by the
// operating system's save picker (Browse), which checks the folder and the extension itself; what the
// copy would contain is planned by main for the chosen path and toggles, so what the dialog says is
// what Save a copy then does.
export default function SaveAsDialog(): React.JSX.Element | null {
  const [pending, setPending] = useState<Pending | null>(null)
  const [path, setPath] = useState('')
  const [options, setOptions] = useState<SaveAsOptions>(DEFAULT_SAVE_AS_OPTIONS)
  const [plan, setPlan] = useState<SaveAsPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const browseRef = useRef<HTMLButtonElement>(null)
  const pathRef = useRef<HTMLInputElement>(null)
  const generation = useRef(0)

  useEffect(
    () =>
      subscribeToSaveAsDialog((request, resolve) => {
        setPending((current) => {
          // One at a time: a second request while one is open is a Cancel.
          if (current) {
            resolve(null)
            return current
          }
          setPath('')
          setOptions(DEFAULT_SAVE_AS_OPTIONS)
          setPlan(null)
          setError(null)
          return { request, resolve }
        })
      }),
    []
  )

  const finish = (choice: SaveAsChoice | null): void => {
    pending?.resolve(choice)
    setPending(null)
  }

  useEffect(() => {
    if (!pending) return undefined
    browseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') finish(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only reads `pending`
  }, [pending])

  // A long path shows its end, where the file name is.
  useEffect(() => {
    if (pathRef.current) pathRef.current.scrollLeft = pathRef.current.scrollWidth
  }, [path])

  // Plan again whenever the path or a toggle changes; an older answer arriving late is dropped.
  useEffect(() => {
    if (!pending || path === '') return
    const mine = ++generation.current
    pending.request
      .planFor(path, options)
      .then((next) => {
        if (mine !== generation.current) return
        setPlan(next)
        setError(null)
      })
      .catch((e: unknown) => {
        if (mine !== generation.current) return
        setPlan(null)
        setError(e instanceof Error ? e.message : String(e))
      })
  }, [pending, path, options])

  if (!pending) return null

  const browse = async (): Promise<void> => {
    const picked = await window.api.pickSavePath(suggestedCopyPath(pending.request.currentPath))
    if (picked) {
      setPlan(null)
      setPath(picked)
    }
  }
  const toggle = (key: keyof SaveAsOptions): void => {
    setPlan(null)
    setOptions((o) => ({ ...o, [key]: !o[key] }))
  }

  const counts = plan?.counts
  const ready = plan !== null && plan.problems.length === 0
  const rows: { key: keyof SaveAsOptions; label: string; hint: string }[] = [
    {
      key: 'notes',
      label: 'Notes',
      hint: counts ? `${plural(counts.notes, 'note', 'notes')}${removedWord(options.notes)}` : ''
    },
    {
      key: 'images',
      label: 'Images and custom icons',
      hint: counts ? `${plural(counts.images, 'file', 'files')}${removedWord(options.images)}` : ''
    },
    {
      key: 'linked',
      label: 'Linked diagrams, recursively, with the same settings',
      hint: counts
        ? options.linked
          ? plural(counts.linked, 'diagram', 'diagrams')
          : `${plural(counts.linked, 'link', 'links')} removed`
        : ''
    }
  ]

  return (
    <div className="about-dialog-overlay">
      <div
        className="about-dialog saveas-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saveas-title"
      >
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title" id="saveas-title">
            Save a copy as
          </span>
        </div>
        <div className="about-dialog-body">
          <div className="saveas-path">
            <input
              ref={pathRef}
              type="text"
              readOnly
              value={path}
              placeholder="Choose where to save the copy"
              aria-label="Path of the copy"
              title={path}
            />
            <button type="button" ref={browseRef} onClick={() => void browse()}>
              Browse…
            </button>
          </div>

          <fieldset className="saveas-options">
            <legend>Copy with the new diagram</legend>
            {rows.map((row) => (
              <label key={row.key} className="saveas-option">
                <input
                  type="checkbox"
                  checked={options[row.key]}
                  onChange={() => toggle(row.key)}
                />
                <span className="saveas-option-label">{row.label}</span>
                <span className="saveas-option-hint">{row.hint}</span>
              </label>
            ))}
          </fieldset>

          <p className="saveas-warning">
            Anything not ticked is removed from the copy. The original is not changed.
          </p>

          {plan && plan.removed.length > 0 && (
            <div className="saveas-removed">
              <p>Also removed, because it cannot be copied:</p>
              <ul>
                {plan.removed.slice(0, SHOWN_REMOVED).map((r, i) => (
                  <li key={i}>
                    {r.label} → {r.path} ({r.reason})
                  </li>
                ))}
                {plan.removed.length > SHOWN_REMOVED && (
                  <li>and {plan.removed.length - SHOWN_REMOVED} more</li>
                )}
              </ul>
            </div>
          )}

          {(plan?.problems.length ?? 0) > 0 || error ? (
            <ul className="saveas-problems" role="alert">
              {(plan?.problems ?? []).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {error && <li>{error}</li>}
            </ul>
          ) : null}

          <div className="alert-dialog-actions">
            <button type="button" onClick={() => finish(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => plan && finish({ path, options, plan })}
            >
              Save a copy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
