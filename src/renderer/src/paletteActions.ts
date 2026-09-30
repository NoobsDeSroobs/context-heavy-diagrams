import type { MenuBarMenu } from './components/MenuBar'

// One row of the command palette (ADR 0100).
export interface PaletteAction {
  // React key only — never persisted, never compared across renders.
  id: string
  title: string
  category: string
  shortcut?: string
  run: () => void
}

// A keyboard-only action with a real handler but no menu item of its own —
// see ADR 0100 for which ones and why.
export interface ExtraPaletteAction {
  id: string
  title: string
  category: string
  shortcut?: string
  run: () => void
}

// Flattens the live menu bar into palette rows (ADR 0100): every menu leaf
// item becomes one row, using its own label/accelerator/onSelect — the exact
// same values <MenuBar> renders, so the palette can never show something the
// menu bar disagrees with. A submenu parent (only "Recent Diagrams" today —
// its entries are per-file, not stable named actions) or a `disabled` item is
// left out entirely, not shown greyed out: the palette only ever offers
// something that can actually run right now.
export function buildPaletteActions(
  menus: MenuBarMenu[],
  extra: ExtraPaletteAction[]
): PaletteAction[] {
  const fromMenus: PaletteAction[] = []
  for (const menu of menus) {
    for (const item of menu.items) {
      if (item.submenu || !item.onSelect || item.disabled) continue
      fromMenus.push({
        id: `menu:${menu.label}:${item.label}`,
        title: item.label,
        category: menu.label,
        shortcut: item.accelerator,
        run: item.onSelect
      })
    }
  }
  return [...fromMenus, ...extra]
}

// Substring match on title + category, case-insensitive — same style as
// ShortcutsDialog's own filter. A blank query returns every action, in the
// order buildPaletteActions produced them (menu order, then the extras).
export function filterPaletteActions(actions: PaletteAction[], query: string): PaletteAction[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return actions
  return actions.filter((a) => `${a.title} ${a.category}`.toLowerCase().includes(needle))
}
