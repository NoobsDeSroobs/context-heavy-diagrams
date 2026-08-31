import { useEffect, useRef, useState } from 'react'

export interface MenuBarItem {
  label: string
  accelerator?: string
  // Native tooltip on hover — e.g. the full absolute path behind a
  // shortened Recent Diagrams label.
  title?: string
  disabled?: boolean
  // A thin rule rendered above this item — for grouping within a menu, same
  // idea as ContextMenu's own `separatorBefore`.
  separatorBefore?: boolean
  // One level of nesting only (File -> Recent Diagrams -> …, ADR 0078).
  // An item with a submenu ignores `onSelect` — it only opens the flyout.
  submenu?: MenuBarItem[]
  onSelect?: () => void
}

export interface MenuBarMenu {
  label: string
  items: MenuBarItem[]
}

interface MenuBarProps {
  menus: MenuBarMenu[]
}

// One row of a dropdown — a leaf (runs `onSelect` and closes the bar) or a
// submenu parent (hovering/clicking opens a flyout to its right). `close`
// tears the whole bar down after a leaf runs, same "close before the action"
// ordering ContextMenu.tsx documents.
//
// Hovering only ever *opens* a flyout (on a submenu parent) — never closes
// one. Hovering a plain leaf leaves any open flyout alone, so moving the
// pointer diagonally from a parent toward its flyout can cross sibling
// leaves without the flyout vanishing (the classic menu-corner problem).
// A flyout closes only on: another submenu parent hovered, a leaf clicked,
// a top-level switch, or click-outside/Escape.
function DropdownItem({
  item,
  open,
  onOpen,
  close
}: {
  item: MenuBarItem
  open: boolean
  onOpen: () => void
  close: () => void
}): React.JSX.Element {
  const hasSubmenu = !!item.submenu && item.submenu.length > 0
  return (
    <>
      {item.separatorBefore && <div className="menu-bar-separator" />}
      <div className="menu-bar-submenu-anchor" onMouseEnter={hasSubmenu ? onOpen : undefined}>
        <button
          type="button"
          className="menu-bar-dropdown-item"
          title={item.title}
          disabled={item.disabled}
          aria-haspopup={hasSubmenu || undefined}
          aria-expanded={hasSubmenu ? open : undefined}
          onClick={() => {
            if (hasSubmenu) {
              onOpen()
              return
            }
            close()
            item.onSelect?.()
          }}
        >
          <span>{item.label}</span>
          {item.accelerator && <span className="menu-bar-accelerator">{item.accelerator}</span>}
          {hasSubmenu && <span className="menu-bar-submenu-caret">▸</span>}
        </button>
        {hasSubmenu && open && (
          <div className="menu-bar-dropdown menu-bar-submenu">
            {item.submenu!.map((sub) => (
              <DropdownItem
                key={sub.label}
                item={sub}
                open={false}
                onOpen={() => {}}
                close={close}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// Custom in-renderer menu bar — see ADR 0039. Deliberately not a
// native Electron menu (see that ADR for the tradeoff): every item reuses
// an existing handler as-is, no new main<->renderer IPC needed beyond
// File -> Close. Click-outside/Escape-to-close and the "close before
// running the action" ordering are copied from ContextMenu.tsx — an
// item's own onSelect() opening new UI (a dialog, another popup) must not
// have its state update raced by this menu's own close, same reasoning
// documented there.
export default function MenuBar({ menus }: MenuBarProps): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // Which submenu-parent is expanded, one level deep only. Scoped to the
  // top-level menu it belongs to ({ menu, label }) so switching top-level
  // menus implicitly drops it — no effect needed to reset it.
  const [openSubmenu, setOpenSubmenu] = useState<{ menu: number; label: string } | null>(null)
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

  const close = (): void => {
    setOpenIndex(null)
    setOpenSubmenu(null)
  }

  useEffect(() => {
    if (openIndex === null) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
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
              setOpenSubmenu(null)
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
                <DropdownItem
                  key={item.label}
                  item={item}
                  open={openSubmenu?.menu === index && openSubmenu.label === item.label}
                  onOpen={() =>
                    setOpenSubmenu(
                      item.submenu && item.submenu.length > 0
                        ? { menu: index, label: item.label }
                        : null
                    )
                  }
                  close={close}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
