// How an icon is named in words, for a card or a review line: a built-in icon by its id, a custom
// one by its file name (with the extension, which also tells it from a built-in of the same name).
// The corners are listed in the order an element draws them.

import type { IconRef, IconSlot } from './schema.ts'

export const ICON_SLOTS: { slot: IconSlot; where: string }[] = [
  { slot: 'topLeft', where: 'top left' },
  { slot: 'topRight', where: 'top right' },
  { slot: 'bottomLeft', where: 'bottom left' },
  { slot: 'bottomRight', where: 'bottom right' }
]

export function iconName(ref: IconRef): string {
  return ref.source === 'builtin' ? ref.id : (ref.path.split(/[/\\]/).pop() ?? ref.path)
}

// An element's icons as `top left: server` pairs, in drawing order.
export function namedIcons(
  icons: Partial<Record<IconSlot, IconRef>> | undefined
): { where: string; name: string }[] {
  return ICON_SLOTS.flatMap(({ slot, where }) => {
    const ref = icons?.[slot]
    return ref ? [{ where, name: iconName(ref) }] : []
  })
}
