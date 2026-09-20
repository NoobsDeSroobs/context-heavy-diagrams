// The command registry (ADR 0094): one list of every keyboard shortcut and
// mouse gesture the app supports. Three things read it — Canvas's global
// keydown handler (matches a key event to a command id), the menu bar's
// accelerator labels, and the Help -> Keyboard shortcuts dialog — so none of
// them can drift from the others. Canvas owns the *behaviour* (a handler per
// id); this module is pure metadata plus matching/formatting.

// `typeof` guard so the unit tests can import this under plain Node.
export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

const MOD_LABEL = isMac ? 'Cmd' : 'Ctrl'

export type CommandCategory =
  | 'File'
  | 'Edit'
  | 'View'
  | 'Style'
  | 'Selection'
  | 'Connections & creation'
  | 'Labels'
  | 'Links & details'
  | 'Search'

// Matching is per-modifier tri-state: `true` = must be held, `false` = must
// not be, omitted = ignored. `mod` is Ctrl on Windows/Linux and Cmd on Mac
// (either counts, as the old inline handler did). `key` is lower-case,
// compared against event.key.toLowerCase().
export interface KeyBinding {
  key: string
  mod?: boolean
  shift?: boolean
}

export interface CommandDef {
  id: string
  // The one-line description shown on the Help page.
  title: string
  category: CommandCategory
  // Present = the global keydown handler dispatches this command.
  binding?: KeyBinding
  // Display-only entry (mouse gesture, or a key handled natively / by a
  // component): shown on the Help page, never dispatched. `Mod` is replaced
  // with Ctrl/Cmd for the OS.
  keys?: string
  // Ctrl+A/C/V/Z… belong to a focused text field's own editing.
  deferToTextField?: boolean
  // Escape keeps its native default behaviour; every other bound key has it
  // prevented.
  allowDefault?: boolean
}

export const COMMANDS = [
  { id: 'file.new', title: 'New diagram', category: 'File', binding: { key: 'n', mod: true } },
  { id: 'file.open', title: 'Open diagram…', category: 'File', binding: { key: 'o', mod: true } },
  {
    id: 'file.save',
    title: 'Save',
    category: 'File',
    binding: { key: 's', mod: true, shift: false }
  },
  {
    id: 'file.saveAs',
    title: 'Save as…',
    category: 'File',
    binding: { key: 's', mod: true, shift: true }
  },
  { id: 'file.close', title: 'Close diagram', category: 'File', binding: { key: 'w', mod: true } },

  {
    id: 'edit.undo',
    title: 'Undo',
    category: 'Edit',
    binding: { key: 'z', mod: true, shift: false },
    deferToTextField: true
  },
  {
    id: 'edit.redo',
    title: 'Redo',
    category: 'Edit',
    binding: { key: 'z', mod: true, shift: true },
    deferToTextField: true
  },
  {
    id: 'edit.cut',
    title: 'Cut selection',
    category: 'Edit',
    binding: { key: 'x', mod: true },
    deferToTextField: true
  },
  {
    id: 'edit.copy',
    title: 'Copy selection',
    category: 'Edit',
    binding: { key: 'c', mod: true, shift: false },
    deferToTextField: true
  },
  {
    id: 'edit.paste',
    title: 'Paste',
    category: 'Edit',
    binding: { key: 'v', mod: true, shift: false },
    deferToTextField: true
  },
  {
    id: 'edit.duplicate',
    title: 'Duplicate selection',
    category: 'Edit',
    binding: { key: 'd', mod: true },
    deferToTextField: true
  },
  {
    id: 'edit.delete',
    title: 'Delete selection',
    category: 'Edit',
    keys: 'Delete / Backspace'
  },

  {
    id: 'style.copy',
    title:
      'Copy the selected element’s style, then click elements of the same type to apply it (again or Esc to stop)',
    category: 'Style',
    binding: { key: 'c', mod: true, shift: true },
    deferToTextField: true
  },
  {
    id: 'style.paste',
    title: 'Apply the copied style to every selected element of the same type',
    category: 'Style',
    binding: { key: 'v', mod: true, shift: true },
    deferToTextField: true
  },
  {
    id: 'selection.selectAll',
    title: 'Select everything',
    category: 'Selection',
    binding: { key: 'a', mod: true },
    deferToTextField: true
  },
  {
    id: 'selection.escape',
    title: 'Close the topmost panel or popup; with none open, deselect all',
    category: 'Selection',
    binding: { key: 'escape' },
    allowDefault: true
  },
  {
    id: 'selection.multi',
    title: 'Add or remove an element from the selection',
    category: 'Selection',
    keys: 'Shift+Click'
  },
  {
    id: 'selection.box',
    title: 'Box-select by dragging across the canvas',
    category: 'Selection',
    keys: 'Shift+Drag'
  },
  {
    id: 'selection.nudge',
    title: 'Nudge the selection 1 px (4 px with Shift)',
    category: 'Selection',
    keys: 'Arrow keys / Shift+Arrow keys'
  },

  {
    id: 'view.fit',
    title: 'Fit the whole diagram in view',
    category: 'View',
    binding: { key: '0', mod: true }
  },
  { id: 'view.pan', title: 'Pan the canvas', category: 'View', keys: 'Drag empty canvas' },
  { id: 'view.zoom', title: 'Zoom the canvas', category: 'View', keys: 'Mouse wheel' },

  {
    id: 'search.toggle',
    title: 'Open or close search',
    category: 'Search',
    binding: { key: 'f', mod: true }
  },
  {
    id: 'search.next',
    title: 'Next / previous match (while the search box is focused)',
    category: 'Search',
    keys: 'Enter / Shift+Enter'
  },

  {
    id: 'links.follow',
    title: "Follow a node's linked diagram (or create/link one if it has none)",
    category: 'Links & details',
    keys: 'Mod+Click'
  },
  {
    id: 'links.peek',
    title: "Peek at an element's details, tags and link while hovering it",
    category: 'Links & details',
    keys: 'Hold Mod'
  },
  {
    id: 'links.menu',
    title: 'Open an element’s context menu (details, links, icons, …)',
    category: 'Links & details',
    keys: 'Right-click'
  },

  {
    id: 'labels.edit',
    title: 'Edit an element’s label',
    category: 'Labels',
    keys: 'Double-click'
  },
  {
    id: 'labels.commit',
    title: 'Commit the label; new line in a multi-line label',
    category: 'Labels',
    keys: 'Enter / Shift+Enter'
  },
  { id: 'labels.cancel', title: 'Cancel the label edit', category: 'Labels', keys: 'Esc' },

  {
    id: 'create.palette',
    title: 'Add an element by dragging it from the palette onto the canvas',
    category: 'Connections & creation',
    keys: 'Drag from palette'
  },
  {
    id: 'create.bulk',
    title: 'Create many shapes or containers from a pasted list',
    category: 'Connections & creation',
    keys: 'Right-click the palette button'
  },
  {
    id: 'create.bulkConfirm',
    title: 'Create the shapes from the list (in the bulk-create dialog)',
    category: 'Connections & creation',
    keys: 'Mod+Enter'
  },
  {
    id: 'create.connect',
    title: 'Connect two shapes; releasing on empty canvas leaves a placeholder end',
    category: 'Connections & creation',
    keys: 'Drag from a connection point'
  },
  {
    id: 'create.reconnect',
    title: 'Move an edge end to another connection point',
    category: 'Connections & creation',
    keys: 'Drag the selected edge’s end'
  }
] as const satisfies readonly CommandDef[]

export type CommandId = (typeof COMMANDS)[number]['id']

const BY_ID = new Map<string, CommandDef>(COMMANDS.map((c) => [c.id, c]))

function keyLabel(key: string): string {
  if (key === 'escape') return 'Esc'
  return key.length === 1 ? key.toUpperCase() : key
}

// "Ctrl+Shift+S" / "Cmd+Shift+S" from a binding, or a display-only entry's
// `keys` text with `Mod` swapped for the OS's modifier.
export function formatKeys(def: CommandDef): string {
  if (def.binding) {
    const { key, mod, shift } = def.binding
    return [mod ? MOD_LABEL : null, shift ? 'Shift' : null, keyLabel(key)].filter(Boolean).join('+')
  }
  return (def.keys ?? '').replace(/\bMod\b/g, MOD_LABEL)
}

// Menu-bar accelerator label for a command id.
export function acceleratorFor(id: CommandId): string {
  return formatKeys(BY_ID.get(id)!)
}

function matches(binding: KeyBinding, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== binding.key) return false
  const mod = event.ctrlKey || event.metaKey
  if (binding.mod !== undefined && binding.mod !== mod) return false
  if (binding.shift !== undefined && binding.shift !== event.shiftKey) return false
  return true
}

// First bound command matching this key event, skipping the ones that defer
// to a focused text field when one has focus.
export function findKeyCommand(event: KeyboardEvent, isEditingText: boolean): CommandDef | null {
  for (const def of COMMANDS as readonly CommandDef[]) {
    if (!def.binding || !matches(def.binding, event)) continue
    if (def.deferToTextField && isEditingText) continue
    return def
  }
  return null
}
