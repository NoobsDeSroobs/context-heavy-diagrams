import { useEffect, useMemo, useState } from 'react'
import type { IconRef, IconSlot } from '@shared/diagram'
import { loadBuiltinIconSvg, searchBuiltinIconIds } from '../icons/builtinIcons'

interface IconPickerProps {
  diagramPath: string | null
  icons: Partial<Record<IconSlot, IconRef>>
  initialSlot: IconSlot
  anchorRect: DOMRect
  onPick: (slot: IconSlot, icon: IconRef) => void
  onRemove: (slot: IconSlot) => void
  onClose: () => void
}

const SLOTS: { slot: IconSlot; label: string }[] = [
  { slot: 'topLeft', label: 'Top left' },
  { slot: 'topRight', label: 'Top right' },
  { slot: 'bottomLeft', label: 'Bottom left' },
  { slot: 'bottomRight', label: 'Bottom right' }
]

const MAX_RESULTS = 60
const PICKER_WIDTH = 220

// Deliberately minimal: pick an icon, pick a corner, done. No opacity/other
// style params — those belong to epic 0003's properties panel once it
// exists, same reasoning as why text alignment was deferred there.
//
// Fixed-positioned from the triggering node's on-screen rect (see
// DiagramContext) — this must NOT be a descendant of the node itself, or it
// inherits React Flow's zoom/pan transform and scales like a shape on the
// canvas instead of staying a normal, fixed-size UI popup.
export default function IconPicker({
  diagramPath,
  icons,
  initialSlot,
  anchorRect,
  onPick,
  onRemove,
  onClose
}: IconPickerProps): React.JSX.Element {
  const [slot, setSlot] = useState<IconSlot>(initialSlot)
  const [query, setQuery] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [customIcons, setCustomIcons] = useState<string[]>([])
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>({})

  // searchBuiltinIconIds is a plain synchronous lookup — no need to store
  // its result in state and set it from an effect, it can just be computed
  // during render. useMemo (not a bare recompute) so this only produces a
  // new array reference when `query` actually changes — the effect below
  // keys off it, and a fresh reference on every render would re-run that
  // effect (and re-fetch every icon preview) on every render, not just
  // every query change.
  const results = useMemo(() => searchBuiltinIconIds(query).slice(0, MAX_RESULTS), [query])

  // Same substring-on-lowercased-query convention as searchBuiltinIconIds
  // — was previously missing entirely, so the search box silently only
  // ever filtered built-in icons, never this diagram's own uploaded ones.
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

  const handleUpload = async (): Promise<void> => {
    if (!diagramPath) {
      alert('Save the diagram before adding a custom icon.')
      return
    }
    const path = await window.api.pickAndCopyCustomIcon(diagramPath)
    if (path) onPick(slot, { source: 'custom', path })
  }

  // To the right of the shape by default, clamped so it doesn't run off the
  // right edge of the screen.
  const left = Math.min(anchorRect.right + 8, window.innerWidth - PICKER_WIDTH - 8)
  const top = Math.min(anchorRect.top, window.innerHeight - 320)

  return (
    <div
      className="icon-picker nodrag nopan"
      style={{ left, top, width: PICKER_WIDTH }}
    >
      <div className="corner-picker">
        <div className="corner-picker-box" />
        {SLOTS.map(({ slot: s, label }) => (
          <button
            key={s}
            type="button"
            title={label}
            aria-label={label}
            className={`corner-picker-dot corner-picker-dot-${s}${s === slot ? ' active' : ''}${icons[s] ? ' occupied' : ''}`}
            onClick={() => setSlot(s)}
          />
        ))}
      </div>
      <input
        className="icon-picker-search"
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="icon-picker-scroll">
        <div className="icon-picker-grid">
          {results.map((id) => (
            <button
              key={id}
              type="button"
              title={id}
              onClick={() => onPick(slot, { source: 'builtin', id })}
              dangerouslySetInnerHTML={previews[id] ? { __html: previews[id] } : undefined}
            />
          ))}
        </div>
        {filteredCustomIcons.length > 0 && (
          <>
            <div className="icon-picker-label">This diagram&apos;s custom icons</div>
            <div className="icon-picker-grid">
              {filteredCustomIcons.map((path) => (
                <button
                  key={path}
                  type="button"
                  title={path}
                  onClick={() => onPick(slot, { source: 'custom', path })}
                >
                  {customPreviews[path] && <img src={customPreviews[path]} alt="" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="icon-picker-actions">
        <button type="button" onClick={handleUpload}>
          Upload custom icon…
        </button>
        {icons[slot] && (
          <button type="button" onClick={() => onRemove(slot)}>
            Remove icon
          </button>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
