import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMANDS, formatKeys, type CommandCategory, type CommandDef } from './commands'

interface ShortcutsDialogProps {
  onClose: () => void
}

// Help -> Keyboard shortcuts (ADR 0094). A centered overlay shell shared with
// AboutDialog; rows come straight from the command registry, so keys are
// shown with the right modifier for the OS and can't drift from what the
// keydown handler actually does.
export default function ShortcutsDialog({ onClose }: ShortcutsDialogProps): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

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

  // Categories in registry order (first appearance), rows filtered by either
  // the description or the key text.
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const byCategory = new Map<CommandCategory, { def: CommandDef; keys: string }[]>()
    for (const def of COMMANDS as readonly CommandDef[]) {
      const keys = formatKeys(def)
      if (needle && !`${def.title} ${keys}`.toLowerCase().includes(needle)) continue
      const rows = byCategory.get(def.category) ?? []
      rows.push({ def, keys })
      byCategory.set(def.category, rows)
    }
    return [...byCategory.entries()]
  }, [filter])

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog shortcuts-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Keyboard shortcuts &amp; gestures</span>
          <input
            className="shortcuts-dialog-filter"
            type="search"
            placeholder="Filter…"
            aria-label="Filter shortcuts"
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shortcuts-dialog-body">
          {groups.length === 0 && <p className="shortcuts-dialog-empty">Nothing matches.</p>}
          {groups.map(([category, rows]) => (
            <section key={category}>
              <h3 className="shortcuts-dialog-category">{category}</h3>
              {rows.map(({ def, keys }) => (
                <div key={def.id} className="shortcuts-dialog-row">
                  <span className="shortcuts-dialog-title">{def.title}</span>
                  <kbd className="shortcuts-dialog-keys">{keys}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
