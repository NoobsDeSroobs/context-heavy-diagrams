import { useEffect, useMemo, useState } from 'react'
import type { IconRef } from '@shared/diagram'
import InstalledIconSections from './InstalledIconSections'

interface IconBrowserProps {
  diagramPath: string | null
  onPick: (icon: IconRef) => void
}

// The icon-browsing core shared by IconPicker (assign an icon to a node
// corner) and SearchOverlay's icon search (find every node already using
// this icon) — see ADR 0072 for icon search, ADR 0006 for the icon model.
// Owns only the search box plus the installed-pack (Tabler included) and this-diagram's-custom
// grids; the caller owns everything wrapped around it (IconPicker's corner
// selector, the search popup's shell, and what a pick actually does).
export default function IconBrowser({ diagramPath, onPick }: IconBrowserProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [customIcons, setCustomIcons] = useState<string[]>([])
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>({})

  const filteredCustomIcons = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? customIcons.filter((path) => path.toLowerCase().includes(q)) : customIcons
  }, [customIcons, query])

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
        <InstalledIconSections query={query} onPick={onPick} />
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
