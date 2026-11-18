import { useEffect, useMemo, useRef, useState } from 'react'
import type { IconRef } from '@shared/diagram'
import type { PackSummary } from '@shared/icons/installedPacks'
import { refForInstalledIcon } from '@shared/icons/iconRefs'
import InstalledIconPreview from './InstalledIconPreview'
import { iconTitle, matchingIcons, SUBSET_ROW_CAP, usablePacks } from './installedIconSearch'

// A cell draws its icon once it has scrolled into view, so a subset of hundreds is read as it is
// looked at. Without IntersectionObserver (a test) it draws at once.
function IconCell({
  pack,
  path,
  onPick
}: {
  pack: string
  path: string
  onPick: (icon: IconRef) => void
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null)
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const cell = ref.current
    if (seen || !cell) return undefined
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true)
        watcher.disconnect()
      }
    })
    watcher.observe(cell)
    return () => watcher.disconnect()
  }, [seen])
  return (
    <button
      ref={ref}
      type="button"
      title={iconTitle(path.slice(path.indexOf('/') + 1))}
      onClick={() => onPick(refForInstalledIcon(pack, path))}
    >
      {seen && <InstalledIconPreview pack={pack} path={path} />}
    </button>
  )
}

function Header({
  open,
  level,
  name,
  count,
  onToggle
}: {
  open: boolean
  level: 'pack' | 'subset'
  name: string
  count: number
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`icon-browser-section icon-browser-section-${level}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      <span className="icon-browser-section-name">{name}</span>
      <span className="icon-browser-section-count">{count}</span>
    </button>
  )
}

// The installed icon packs inside the icon browser (ADR 0188): a collapsible section per pack and,
// inside it, per subset. A search opens every section that has a match. The rows of a subset are
// capped, and each icon is read as it scrolls into view.
export default function InstalledIconSections({
  query,
  onPick
}: {
  query: string
  onPick: (icon: IconRef) => void
}): React.JSX.Element {
  const [packs, setPacks] = useState<PackSummary[] | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.listIconPacks().then((list) => {
        if (!cancelled) setPacks(usablePacks(list.packs))
      })
    }
    load()
    const stop = window.api.onIconPacksChanged(load)
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  const searching = query.trim() !== ''
  const shown = useMemo(
    () =>
      (packs ?? []).map((pack) => ({
        pack,
        subsets: pack.subsets
          .map((subset) => ({ subset, icons: matchingIcons(pack, subset, query) }))
          .filter((entry) => entry.icons.length > 0)
      })),
    [packs, query]
  )

  const toggle = (set: ReadonlySet<string>, key: string): Set<string> => {
    const next = new Set(set)
    if (!next.delete(key)) next.add(key)
    return next
  }

  return (
    <>
      {shown.map(({ pack, subsets }) => {
        if (searching && subsets.length === 0) return null
        const packKey = pack.meta.name
        const packOpen = searching || open.has(packKey)
        return (
          <div key={pack.folder} className="icon-browser-pack">
            <Header
              open={packOpen}
              level="pack"
              name={pack.meta.name}
              count={searching ? subsets.reduce((n, s) => n + s.icons.length, 0) : pack.iconCount}
              onToggle={() => setOpen(toggle(open, packKey))}
            />
            {packOpen &&
              subsets.map(({ subset, icons }) => {
                const subsetKey = `${packKey}\u0000${subset.folder}`
                const subsetOpen = searching || open.has(subsetKey)
                const all = showAll.has(subsetKey)
                const rows = all ? icons : icons.slice(0, SUBSET_ROW_CAP)
                return (
                  <div key={subset.folder} className="icon-browser-subset">
                    <Header
                      open={subsetOpen}
                      level="subset"
                      name={subset.meta.name}
                      count={icons.length}
                      onToggle={() => setOpen(toggle(open, subsetKey))}
                    />
                    {subsetOpen && (
                      <>
                        <div className="icon-browser-grid">
                          {rows.map((file) => (
                            <IconCell
                              key={file}
                              pack={pack.meta.name}
                              path={`${subset.folder}/${file}`}
                              onPick={onPick}
                            />
                          ))}
                        </div>
                        {!all && icons.length > rows.length && (
                          <button
                            type="button"
                            className="icon-browser-more"
                            onClick={() => setShowAll(toggle(showAll, subsetKey))}
                          >
                            Show all {icons.length}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
          </div>
        )
      })}
      <button
        type="button"
        className="icon-browser-more"
        onClick={() => void window.api.openIconPackManager()}
      >
        {packs !== null && packs.length === 0 ? 'Install an icon pack…' : 'Icon packs…'}
      </button>
    </>
  )
}
