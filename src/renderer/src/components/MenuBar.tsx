import { useEffect, useRef, useState } from 'react'

export interface MenuBarItem {
  label: string
  accelerator?: string
  disabled?: boolean
  onSelect: () => void
}

export interface MenuBarMenu {
  label: string
  items: MenuBarItem[]
}

interface MenuBarProps {
  menus: MenuBarMenu[]
}

// Custom in-renderer menu bar — epic 0049/ADR 0039. Deliberately not a
// native Electron menu (see that ADR for the tradeoff): every item reuses
// an existing handler as-is, no new main<->renderer IPC needed beyond
// File -> Close. Click-outside/Escape-to-close and the "close before
// running the action" ordering are copied from ContextMenu.tsx — an
// item's own onSelect() opening new UI (a dialog, another popup) must not
// have its state update raced by this menu's own close, same reasoning
// documented there.
export default function MenuBar({ menus }: MenuBarProps): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  // Which index the hover-switch below most recently opened, if any — a
  // click always fires after mouseenter for the same gesture (moving onto
  // a new label necessarily fires mouseenter before the click lands), so
  // by the time the click handler runs, `openIndex` already reflects
  // hover's switch. Without this, the click's own toggle logic reads that
  // as "you clicked the menu that's already open" and closes it right back
  // — a real bug caught live: clicking a different top-level menu while
  // another was open did nothing but close the bar. This ref lets a click
  // tell "hover just switched us here as part of this same gesture" apart
  // from "this menu was already open from an earlier, separate click."
  const hoverSwitchedToRef = useRef<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpenIndex(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenIndex(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openIndex])

  return (
    <div ref={ref} className="menu-bar nodrag nopan">
      {menus.map((menu, index) => (
        <div key={menu.label} className="menu-bar-item">
          <button
            type="button"
            className={openIndex === index ? 'menu-bar-label open' : 'menu-bar-label'}
            onClick={() => {
              if (hoverSwitchedToRef.current === index) {
                // Hover already brought us here as part of this same
                // click gesture — keep it open rather than toggling it
                // closed (see hoverSwitchedToRef's own comment above).
                hoverSwitchedToRef.current = null
                setOpenIndex(index)
                return
              }
              setOpenIndex((current) => (current === index ? null : index))
            }}
            // Once one top-level menu is open, hovering a sibling switches
            // straight to it — the classic menu-bar convention — but
            // hovering does nothing while none is open, so a stray mouse
            // pass over "Edit" doesn't pop it open uninvited.
            onMouseEnter={() =>
              setOpenIndex((current) => {
                // Only a genuine switch (arriving from a *different* open
                // menu) should suppress the next click's toggle-close —
                // re-entering the same already-open menu (a stray extra
                // mouseenter with no real transition, or the pointer
                // never having left) must not.
                if (current === null || current === index) return current
                hoverSwitchedToRef.current = index
                return index
              })
            }
          >
            {menu.label}
          </button>
          {openIndex === index && (
            <div className="menu-bar-dropdown">
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="menu-bar-dropdown-item"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpenIndex(null)
                    item.onSelect()
                  }}
                >
                  <span>{item.label}</span>
                  {item.accelerator && <span className="menu-bar-accelerator">{item.accelerator}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
