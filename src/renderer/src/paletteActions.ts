import type { MenuBarItem, MenuBarMenu } from './MenuBar'

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
// menu bar disagrees with. The leaves of a submenu are listed too, titled
// "Parent: leaf" so "Diagram" under New reads as what it is; a submenu marked
// `notInPalette` (Recent Diagrams, whose entries are files) is left out. A
// `disabled` item is left out entirely, not shown greyed out: the palette only
// ever offers something that can actually run right now.
export function buildPaletteActions(
  menus: MenuBarMenu[],
  extra: ExtraPaletteAction[]
): PaletteAction[] {
  const fromMenus: PaletteAction[] = []
  const add = (menu: string, item: MenuBarItem, parent?: string): void => {
    if (item.submenu) {
      if (item.notInPalette || item.disabled) return
      for (const sub of item.submenu)
        add(menu, sub, parent ? `${parent}: ${item.label}` : item.label)
      return
    }
    if (!item.onSelect || item.disabled) return
    fromMenus.push({
      id: `menu:${menu}:${parent ? `${parent}:` : ''}${item.label}`,
      title: parent ? `${parent}: ${item.label}` : item.label,
      category: menu,
      shortcut: item.accelerator,
      run: item.onSelect
    })
  }
  for (const menu of menus) for (const item of menu.items) add(menu.label, item)
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
