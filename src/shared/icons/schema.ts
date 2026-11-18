// An icon reference (docs/file-format.md#icon-reference). `installed` names a pack on the reading
// machine and an icon in it (ADR 0188, docs/icon-packs.md); `builtin` is the Tabler pack's
// `Outline/<id>.svg`, kept as it was written; `custom` is a file beside the diagram.
export type IconRef =
  | { source: 'builtin'; id: string }
  | { source: 'custom'; path: string }
  | { source: 'installed'; pack: string; path: string }

export type IconSlot = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

// One entry of a diagram's `iconPacks` list: what the app wrote down about a pack the diagram uses,
// so a machine without it can say which pack and what to do. Written by the app from the icons a
// diagram holds each time it is saved; never edited by hand and never needed to draw anything.
export interface IconPackNote {
  name: string
  // The pack's own version label, if it has one.
  version?: string
  // The pack's own "if missing" text, if it has one.
  ifMissing?: string
}
