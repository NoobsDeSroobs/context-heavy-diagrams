# 0094: A command registry behind the keyboard handler, menu accelerators and the Help shortcuts page

## Status
Decided and implemented (2026-09-20). Typecheck/lint/unit tests pass; not live-tested (Electron renderer). Linux/Mac display unverified.

## Context

Shortcuts were hard-coded in three places that had to be kept in step by hand: one long `keydown` handler in `Canvas.tsx` (`mod && event.key.toLowerCase() === 's'`, …), the menu bar's `accelerator: 'Ctrl+S'` string labels (which also hard-coded "Ctrl" even on Mac), and — once a Help page was wanted — a third hand-written list. Mouse gestures (Ctrl+click follows a link, Shift+click multi-selects, …) had no listing anywhere except in code comments. A command palette is also planned, which needs the same list of titled, keyed actions.

## Decision

`src/renderer/src/commands.ts` is the single registry: an ordered list of `{ id, title, category, binding? | keys?, deferToTextField?, allowDefault? }`.

- **Bound commands** carry a `binding` (`key`, plus tri-state `mod`/`shift`: required / forbidden / ignored). `findKeyCommand(event, isEditingText)` returns the first match, skipping `deferToTextField` commands while a text field has focus (Ctrl+A/C/V/X/Z/D — the same set the old handler deferred).
- **Behaviour stays in `Canvas.tsx`**: the keydown effect builds a `Partial<Record<CommandId, () => unknown>>` map and dispatches whatever `findKeyCommand` returns. A handler returning `false` declines the press (used by Ctrl+C when there is a live text selection outside an input), which then keeps its native default; otherwise the default is prevented, except commands flagged `allowDefault` (Escape). The registry is metadata only; it imports nothing from React or Canvas, which is also why it can be unit-tested under plain Node.
- **Display-only entries** (`keys: 'Mod+Click'`) cover gestures and keys handled by React Flow or a component (Delete, arrow-key nudge, Shift+click / Shift+drag selection, double-click to edit a label, drag-to-connect, …). They are listed on the Help page and never dispatched.
- **Menu accelerators** are `acceleratorFor(id)`, derived from the binding.
- **Help → Keyboard shortcuts…** opens `ShortcutsDialog`, listing every entry grouped by category with a text filter. Modifiers render per OS: `Cmd` on Mac, `Ctrl` elsewhere (`isMac` from `navigator.platform`); the menu bar now does too.
- **Escape** is part of the registry as `selection.escape`; the Shortcuts dialog is the first link of its close-the-topmost-thing chain so Escape doesn't also deselect behind it.
- New features register here from day one; a unit test (`commands.test.mjs`) checks ids are unique, no two bindings can match the same key press, and the Save/Save As, Undo/Redo, text-field-deferral and Escape matching rules.

The command palette (deferred) will read the same list. Nothing in the registry is palette-specific yet — an "available now" predicate and per-command runtime `run` belong to that work, where the actual requirement (menu-item `disabled` states already live in `Canvas.tsx`) can be designed with it.

## Alternatives considered

- **A hand-written Help page**: drifts on the first shortcut change. The reason for the registry.
- **Registry holding the handlers too** (`{ id, keys, run }`): the handlers close over dozens of Canvas state values and would need the registry built inside the component every render, or a context. A static metadata list plus one id → handler map in the place that owns the state is simpler and keeps the registry testable.
- **Native Electron menu accelerators** (a native menu bar would carry its own): the menu bar is a custom in-renderer one by design (ADR 0039).
- **Extracting only the Help data** and leaving the keydown handler alone: that is the exact drift the registry exists to remove.

## Consequences

- Rebinding or adding a keyboard shortcut is one registry entry plus one handler line; menu labels and the Help page follow automatically.
- **Display-only entries can still drift**: they document behaviour implemented elsewhere (React Flow props, node components), and nothing links them. The registry can't fix that; it makes the list one place to update and review.
- Behaviour preserved from the old handler: Ctrl+S with Shift saves as, other bound commands ignore Shift, Escape ignores all modifiers and is not `preventDefault`ed.
- Not covered: shortcuts local to a focused component (search box Enter/Shift+Enter, label field Enter/Esc/Shift+Enter, bulk-create Ctrl+Enter) are documented display-only where a user would look for them, but their handlers stay in their components.
