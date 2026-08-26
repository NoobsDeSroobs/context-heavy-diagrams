import { useEffect, useRef, type KeyboardEvent } from 'react'

interface SearchOverlayProps {
  query: string
  onQueryChange: (query: string) => void
  deepSearchEnabled: boolean
  onToggleDeepSearch: () => void
  deepSearchAvailable: boolean
  deepSearchLoading: boolean
  onSubmit: () => void
  searchRun: boolean
  matchCount: number
  currentIndex: number
  onNext: () => void
  onPrev: () => void
  isolateActive: boolean
  onToggleIsolate: () => void
  onClose: () => void
}

// Ctrl+F-triggered overlay — epic 0062/ADR 0062. Deliberately not anchored
// to any toolbar button (there isn't one yet, on purpose — see the ADR's
// "provisional entry point" note); a plain fixed position top-right, same
// visual language (position/z-index/colors) as LegendPanel/HighlightsPanel.
export default function SearchOverlay({
  query,
  onQueryChange,
  deepSearchEnabled,
  onToggleDeepSearch,
  deepSearchAvailable,
  deepSearchLoading,
  onSubmit,
  searchRun,
  matchCount,
  currentIndex,
  onNext,
  onPrev,
  isolateActive,
  onToggleIsolate,
  onClose
}: SearchOverlayProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl+F opening the overlay should immediately put focus in the query
  // field — otherwise it opens with nothing focused and the user has to
  // click before typing, defeating the point of a keyboard-triggered find.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Enter submits the first time; once a run has live matches, repeated
  // Enter cycles instead of re-running the same query — same convention as
  // a browser's own find bar. Shift+Enter goes backward. Editing the query
  // clears searchRun (Canvas.tsx's onSearchQueryChange), so this falls
  // back to submitting again as soon as the query actually changes.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (searchRun && matchCount > 0) {
        if (event.shiftKey) onPrev()
        else onNext()
      } else {
        onSubmit()
      }
    }
  }

  const noMatches = searchRun && !deepSearchLoading && matchCount === 0

  return (
    <div className="search-overlay nodrag nopan">
      <input
        ref={inputRef}
        className="search-overlay-input"
        type="text"
        placeholder="Search labels, ids, tags…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="search-overlay-run"
        onClick={onSubmit}
        disabled={query.trim().length === 0}
      >
        Search
      </button>
      <button
        type="button"
        className={`search-overlay-isolate${isolateActive ? ' active' : ''}`}
        aria-pressed={isolateActive}
        onClick={onToggleIsolate}
        disabled={!isolateActive && query.trim().length === 0}
        title={
          isolateActive
            ? 'Turn off Isolate'
            : 'Dim everything except matches for the current query, and frame them all at once'
        }
      >
        Isolate
      </button>
      <label
        className="search-overlay-deep"
        title={
          deepSearchAvailable
            ? "Also scan each element's detail notes on disk — slower, no live-as-you-type"
            : 'Save the diagram first — detail files have nowhere to resolve from yet'
        }
      >
        <input
          type="checkbox"
          checked={deepSearchEnabled}
          disabled={!deepSearchAvailable}
          onChange={onToggleDeepSearch}
        />
        Deep search
      </label>
      <div className="search-overlay-status">
        {deepSearchLoading && <span>Scanning…</span>}
        {!deepSearchLoading && searchRun && matchCount > 0 && (
          <>
            <span>
              {currentIndex + 1} / {matchCount}
            </span>
            <button
              type="button"
              onClick={onPrev}
              title="Previous match"
              aria-label="Previous match"
            >
              ‹
            </button>
            <button type="button" onClick={onNext} title="Next match" aria-label="Next match">
              ›
            </button>
          </>
        )}
        {noMatches && <span>No matches</span>}
      </div>
      <button
        type="button"
        className="search-overlay-close"
        title="Close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  )
}
