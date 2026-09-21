import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { IconRef } from '@shared/diagram'
import { loadBuiltinIconSvg } from '../icons/builtinIcons'
import { iconRefKey } from '../search'

interface SearchOverlayProps {
  query: string
  onQueryChange: (query: string) => void
  deepSearchEnabled: boolean
  onToggleDeepSearch: () => void
  deepSearchAvailable: boolean
  deepSearchLoading: boolean
  // Linked diagrams that couldn't be read in the last deep search.
  unreadableLinks: string[]
  onSubmit: () => void
  searchRun: boolean
  matchCount: number
  currentIndex: number
  onNext: () => void
  onPrev: () => void
  isolateActive: boolean
  onToggleIsolate: () => void
  diagramPath: string | null
  searchIcon: IconRef | null
  iconPickerOpen: boolean
  onToggleIconPicker: (anchorRect: DOMRect) => void
  onClearIcon: () => void
  queryProblems: string[]
  onClose: () => void
}

// Ctrl+F-triggered overlay — see ADR 0062. Deliberately not anchored
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
  unreadableLinks,
  onSubmit,
  searchRun,
  matchCount,
  currentIndex,
  onNext,
  onPrev,
  isolateActive,
  onToggleIsolate,
  diagramPath,
  searchIcon,
  iconPickerOpen,
  onToggleIconPicker,
  onClearIcon,
  queryProblems,
  onClose
}: SearchOverlayProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const iconButtonRef = useRef<HTMLButtonElement>(null)
  // Keyed by the icon it was loaded for, so a stale preview from a
  // previously-picked icon is never shown against the current one while the
  // new fetch is still in flight.
  const [iconPreview, setIconPreview] = useState<{ key: string; svg: string } | null>(null)

  // Ctrl+F opening the overlay should immediately put focus in the query
  // field — otherwise it opens with nothing focused and the user has to
  // click before typing, defeating the point of a keyboard-triggered find.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Picking an icon closes the icon-browser popup and leaves focus nowhere
  // useful. Return it to the query field so Enter / Shift+Enter keep
  // cycling through matches, exactly as they do for a text search (the
  // field stays read-only, not disabled, in icon mode precisely so it can
  // still hold focus and receive these key presses).
  useEffect(() => {
    if (searchIcon) inputRef.current?.focus()
  }, [searchIcon])

  // Load the currently-picked search icon for display in its button. A
  // built-in icon resolves to raw SVG; a custom one to a data URL. No
  // synchronous clear when there's no icon — `preview` below just ignores a
  // stale value whose key no longer matches.
  useEffect(() => {
    if (!searchIcon) return
    const key = iconRefKey(searchIcon)
    let cancelled = false
    const set = (svg: string): void => {
      if (!cancelled) setIconPreview({ key, svg })
    }
    if (searchIcon.source === 'builtin') {
      loadBuiltinIconSvg(searchIcon.id)?.then(set)
    } else if (diagramPath) {
      window.api.readIconAsDataUrl(diagramPath, searchIcon.path).then(set)
    }
    return () => {
      cancelled = true
    }
  }, [searchIcon, diagramPath])

  const preview =
    searchIcon && iconPreview && iconPreview.key === iconRefKey(searchIcon) ? iconPreview.svg : null

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
  const iconMode = searchIcon !== null
  const canSearch = iconMode || query.trim().length > 0

  return (
    <div className="search-overlay nodrag nopan">
      <input
        ref={inputRef}
        className="search-overlay-input"
        type="text"
        placeholder={
          iconMode
            ? 'Searching by icon…'
            : 'Search labels, ids, tags, notes…  (has:references, tag:…)'
        }
        title={
          'Free text (or any:) matches id, label, tags and the element\'s notes. All terms must match. Narrow with label:x, id:x, tag:value, tag:key=value, has:references, has:icon, has:details, has:link. Quote values with spaces: tag:"data class"=pii'
        }
        value={iconMode ? '' : query}
        readOnly={iconMode}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className="search-overlay-icon-wrap">
        <button
          ref={iconButtonRef}
          type="button"
          className={`search-overlay-icon${iconMode || iconPickerOpen ? ' active' : ''}`}
          aria-pressed={iconMode || iconPickerOpen}
          title={iconMode ? 'Change search icon' : 'Search by icon'}
          onClick={() => {
            if (iconButtonRef.current) {
              onToggleIconPicker(iconButtonRef.current.getBoundingClientRect())
            }
          }}
        >
          {preview ? (
            searchIcon?.source === 'custom' ? (
              <img src={preview} alt="" />
            ) : (
              <span
                className="search-overlay-icon-glyph"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            )
          ) : (
            <span className="search-overlay-icon-glyph" aria-hidden="true">
              ◈
            </span>
          )}
        </button>
        {iconMode && (
          <button
            type="button"
            className="search-overlay-icon-clear"
            title="Clear icon search"
            aria-label="Clear icon search"
            onClick={onClearIcon}
          >
            ✕
          </button>
        )}
      </span>
      <button type="button" className="search-overlay-run" onClick={onSubmit} disabled={!canSearch}>
        Search
      </button>
      <button
        type="button"
        className={`search-overlay-isolate${isolateActive ? ' active' : ''}`}
        aria-pressed={isolateActive}
        onClick={onToggleIsolate}
        disabled={!isolateActive && !canSearch}
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
            ? 'Also search every diagram this one links to, and theirs in turn, including their notes. A shape whose linked diagrams contain a match counts as a match. Slower.'
            : 'Save the diagram first — its links have nowhere to resolve from yet'
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
        {!deepSearchLoading && unreadableLinks.length > 0 && (
          <span className="search-overlay-problem" title={unreadableLinks.join('\n')}>
            {`${unreadableLinks.length} linked diagram${unreadableLinks.length === 1 ? '' : 's'} couldn't be read`}
          </span>
        )}
        {queryProblems.length > 0 && (
          <span className="search-overlay-problem" title={queryProblems.join('\n')}>
            {queryProblems[0]}
          </span>
        )}
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
