# 0023: Multiple open diagrams — separate windows, not tabs

## Status
Accepted

## Context
Epic 0009 (linked-diagram navigation) surfaced a real, legitimate need: seeing a parent diagram and a linked child *at the same time*, instead of navigating into the child and breadcrumb-backing out to see the parent again. Deliberately not solved in 0009 itself (the actual bug reported there had a small, complete fix that didn't need it), it became its own epic (0024), left genuinely unscoped: "tabs within one window vs. separate `BrowserWindow`s per diagram."

Two things resolved the tie once this epic actually started:

- **The stated goal is simultaneous visibility**, not switching between many diagrams one at a time. A tab bar alone doesn't provide that — it would need a further split-pane feature on top, which is more surface area than tabs by themselves suggest.
- **The existing codebase already assumes one diagram per renderer process.** `App.tsx` is just `<Canvas />`; `Canvas.tsx` owns all state (nodes/edges/undo history) for exactly one diagram per mounted instance. `createWindow()` in `src/main/index.ts` is already a plain, reusable function, and all diagram-related IPC handlers (`src/main/diagram.ts`, `src/main/links.ts`) are stateless and path-driven — nothing in main assumes a single window. A second `BrowserWindow` showing a different diagram is close to free architecturally. Tabs, by contrast, would require either mounting multiple concurrent `Canvas`/`DiagramContext` instances (to keep an inactive tab's undo history and in-memory edits alive across a switch) or a new per-tab state store feeding a single `Canvas` — real new renderer architecture that doesn't exist today in any form.

## Decision
Multiple open diagrams are separate OS-level `BrowserWindow`s, one per diagram, not tabs in a single window. Concretely:

- **File → New** and **File → Open** always open a new window; neither ever replaces the diagram in the window the action was triggered from.
- **Creating a new linked sub-diagram** (Ctrl/Cmd+click a not-yet-linked node → "Create new linked diagram…") opens the new child in a new window. The parent window is left exactly as it was — no navigation, no state replacement.
- **Following an existing link** (Ctrl/Cmd+click an already-linked node) also opens the target in a new window, for the same reason and for consistency with "create new." This directly retires breadcrumb back-navigation (epic 0009's `breadcrumbs` state, `navigateToBreadcrumb`, and the breadcrumb UI): nothing replaces a window's diagram in-place anymore, so there is nothing to breadcrumb back *from*. The feature is removed as dead code by this epic, not left unused — see epic 0009's Notes for the cross-reference.
- **Duplicate-window guard:** opening a diagram file (via File → Open or by following a link) that's already open in another window focuses that existing window instead of opening a second one on the same file. Without this, and with no dirty-tracking/autosave yet (epic 0020), two windows on the same file would let whichever saves last silently overwrite the other's in-memory edits with no warning — a real footgun worth closing off now that it's newly possible, cheap to add (main process already needs to track open windows; it just needs a path→window map).

Tabs-in-one-window is not rejected outright, only deferred: the user does sometimes work with multiple diagrams that aren't a parent/child pair, and three monitors makes per-window management fine for now but wouldn't scale indefinitely. If that need grows, tabs can be layered on top of the window model later as its own epic, without reworking this decision — a tab would just host what a window hosts today.

## Alternatives considered
- **Tabs within one window.** Rejected for v1: doesn't solve the actual motivating use case (simultaneous visibility) without also building split-pane, and requires new renderer architecture (concurrent `Canvas` instances or a per-tab state store) that doesn't exist today, unlike windows which the codebase is already shaped for.
- **Tabs + "open in new window" escape hatch (VS Code-style).** The most capable option, but strictly more scope than either alone — building both the tab infrastructure and the window infrastructure at once. Deferred in favor of shipping windows now and layering tabs on later only if the need materializes.
- **Split-pane within one window.** Would solve simultaneous visibility without spawning OS windows, but is arguably harder to build well (pane resizing, nested layout state) than just using windows, which get all of that for free from the OS/window manager. Not seriously pursued.

## Consequences
- Nearly all the new work is plumbing, not new architecture: a `windows:*` IPC surface for open-new / open-in-new-window(-or-focus) / open-linked-in-new-window(-or-focus), a path→`BrowserWindow` registry in main for the duplicate guard, and a renderer-side mount effect to load an initial diagram from a `?path=` query string passed to the new window.
- Breadcrumb back-navigation (epic 0009) is removed. If tabs are ever added later, in-window navigation history could resurface then, but as a fresh design against whatever tabs actually need, not a revival of this code.
- Epic 0006 (undo/redo)'s forward note about needing undo history to persist per-tab-for-the-tab's-whole-lifetime is resolved for free: a `Canvas` instance's undo stack already lives exactly as long as its `BrowserWindow`, no extra design needed.
- Two diagrams that link to *each other's siblings* but aren't directly parent/child can still each be opened in their own window and arranged side by side — the model isn't restricted to strict parent/child pairs, it's just "any diagram file, any window."
- If tabs get added later, this ADR's window-per-diagram model doesn't need to be undone — a tab would host today's window content, and "open in new window" would remain a natural escape hatch out of a tab, same shape as VS Code.
