import { useEffect, useMemo, useState } from 'react'
import type { IconRef } from '@shared/diagram'
import { loadBuiltinIconSvg, searchBuiltinIconIds } from './builtinIcons'

interface IconBrowserProps {
  diagramPath: string | null
  onPick: (icon: IconRef) => void
}

const MAX_RESULTS = 60

// The icon-browsing core shared by IconPicker (assign an icon to a node
// corner) and SearchOverlay's icon search (find every node already using
// this icon) — see ADR 0072 for icon search, ADR 0006 for the icon model.
// Owns only the search box plus the built-in and this-diagram's-custom
// grids; the caller owns everything wrapped around it (IconPicker's corner
// selector, the search popup's shell, and what a pick actually does).
export default function IconBrowser({ diagramPath, onPick }: IconBrowserProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [customIcons, setCustomIcons] = useState<string[]>([])
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>({})

  // searchBuiltinIconIds is a plain synchronous lookup — computed during
  // render, memoized so it only produces a new array reference when `query`
  // changes (the preview-loading effect keys off it).
  const results = useMemo(() => searchBuiltinIconIds(query).slice(0, MAX_RESULTS), [query])

  const filteredCustomIcons = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? customIcons.filter((path) => path.toLowerCase().includes(q)) : customIcons
  }, [customIcons, query])

  useEffect(() => {
    let cancelled = false
    for (const id of results) {
      loadBuiltinIconSvg(id)?.then((svg) => {
        if (!cancelled) setPreviews((prev) => ({ ...prev, [id]: svg }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [results])

  useEffect(() => {
    if (!diagramPath) return
    let cancelled = false
    window.api.listCustomIcons(diagramPath).then((paths) => {
      if (cancelled) return
      setCustomIcons(paths)
      for (const path of paths) {
        window.api.readIconAsDataUrl(diagramPath, path).then((url) => {
          if (!cancelled) setCustomPreviews((prev) => ({ ...prev, [path]: url }))
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [diagramPath])

  return (
    <>
      <input
        className="icon-browser-search"
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="icon-browser-scroll">
        <div className="icon-browser-grid">
          {results.map((id) => (
            <button
              key={id}
              type="button"
              title={id}
              onClick={() => onPick({ source: 'builtin', id })}
              dangerouslySetInnerHTML={previews[id] ? { __html: previews[id] } : undefined}
            />
          ))}
        </div>
        {filteredCustomIcons.length > 0 && (
          <>
            <div className="icon-browser-label">This diagram&apos;s custom icons</div>
            <div className="icon-browser-grid">
              {filteredCustomIcons.map((path) => (
                <button
                  key={path}
                  type="button"
                  title={path}
                  onClick={() => onPick({ source: 'custom', path })}
                >
                  {customPreviews[path] && <img src={customPreviews[path]} alt="" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
