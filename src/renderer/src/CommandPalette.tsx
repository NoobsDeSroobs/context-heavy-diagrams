import { useEffect, useMemo, useRef, useState } from 'react'
import { filterPaletteActions, type PaletteAction } from './paletteActions'

interface CommandPaletteProps {
  actions: PaletteAction[]
  onClose: () => void
}

// Ctrl/Cmd+K — see ADR 0100. A slim, top-anchored overlay (Spotlight/Raycast
// convention), not the centered ShortcutsDialog/AboutDialog shell: this is a
// type-and-go launcher you dismiss the instant you've run something, not a
// reference page you browse. `actions` is already flattened+built by the
// caller (Canvas.tsx) — this component only filters, navigates and runs.
export default function CommandPalette({
  actions,
  onClose
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  const filtered = useMemo(() => filterPaletteActions(actions, query), [actions, query])

  // Typing narrows the list out from under whatever was highlighted — land
  // back on the top match rather than an index that may now point at an
  // unrelated row or past the end. Adjusted during render (React's own
  // "adjusting state when a prop changes" pattern), not in an effect: an
  // effect that just calls setState synchronously is exactly the cascading-
  // render shape the react-compiler lint rule (enforced as an error in this
  // repo) rejects. `filtered` is a fresh useMemo reference only when
  // actions/query actually changed, so this never fires on an unrelated
  // re-render.
  const [lastFiltered, setLastFiltered] = useState(filtered)
  let highlightedNow = highlighted
  if (filtered !== lastFiltered) {
    setLastFiltered(filtered)
    setHighlighted(0)
    highlightedNow = 0
  }

  useEffect(() => {
    rowRefs.current[highlightedNow]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedNow])

  // Click-outside/Escape-to-close mirrors MenuBar.tsx/ShortcutsDialog.tsx.
  // Arrow/Enter navigation is handled by the input's own onKeyDown below
  // instead, so it only ever fires while the palette actually has focus.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) onClose()
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

  // Close before running — same ordering as MenuBar's own DropdownItem, so
  // an action that opens another dialog doesn't race the palette's own
  // unmount.
  const run = (action: PaletteAction): void => {
    onClose()
    action.run()
  }

  return (
    <div className="command-palette-overlay">
      <div ref={overlayRef} className="command-palette">
        <input
          className="command-palette-input"
          type="text"
          placeholder="Type a command…"
          aria-label="Command palette"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHighlighted((i) => Math.min(i + 1, filtered.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlighted((i) => Math.max(i - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const action = filtered[highlightedNow]
              if (action) run(action)
            }
          }}
        />
        <div className="command-palette-list" role="listbox">
          {filtered.length === 0 && <p className="command-palette-empty">Nothing matches.</p>}
          {filtered.map((action, index) => (
            <button
              key={action.id}
              ref={(el) => {
                rowRefs.current[index] = el
              }}
              type="button"
              role="option"
              aria-selected={index === highlightedNow}
              className={
                index === highlightedNow ? 'command-palette-row highlighted' : 'command-palette-row'
              }
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => run(action)}
            >
              <span className="command-palette-title">{action.title}</span>
              <span className="command-palette-category">{action.category}</span>
              {action.shortcut && <kbd className="command-palette-shortcut">{action.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
