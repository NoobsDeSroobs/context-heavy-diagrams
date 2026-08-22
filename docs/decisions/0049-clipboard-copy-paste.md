# 0049: Real clipboard copy/paste

## Status
Accepted

## Context
The project brief and epic 0025 ask for real `Ctrl+C`/`Ctrl+V`/`Ctrl+X` — deliberately more than `Ctrl+D` (duplicate-in-place, already built, epic 0018): a real clipboard model, id regeneration, and edges between copied nodes, none of which the simpler duplicate shortcut takes on. The epic's own Notes flagged one thing worth deciding early: whether paste should work across two different open diagrams, which depends on how multi-diagram-openness is actually shaped. That's already resolved — this app uses one real OS `BrowserWindow` per diagram, not tabs ([ADR 0023](0023-multi-window-diagram-model.md)) — which settles the clipboard-model question outright: an in-app-only React state clipboard cannot cross a window/renderer-process boundary at all without new IPC broadcasting machinery, whereas the real OS clipboard gets cross-window (and cross-app) paste for free and matches what a user already expects.

## Decision
- **Real OS clipboard, plain JSON text.** Electron's `clipboard` module is available directly in the preload (`sandbox: false`, `main/windows.ts`) with no IPC round-trip needed — `copyToClipboard`/`readClipboardText` are synchronous pass-throughs. The payload is `{ chdClipboard: true, version: 1, nodes, edges }`; `chdClipboard: true` is what distinguishes "this is our own payload" from arbitrary text the user copied elsewhere — anything unmarked or malformed is a silent no-op on paste, never an error, matching `duplicateSelected`'s own "nothing selected, do nothing" precedent.
- **Edges only tag along when both endpoints are also copied.** Copying "just an edge" alone (no nodes selected) is a no-op — matches the epic's own framing ("copy/paste for nodes... edges between copied nodes"), and a dangling edge with a missing endpoint isn't representable once ids get regenerated anyway.
- **Every id is regenerated on paste** (`remapForPaste`, `src/renderer/src/clipboard.ts`) via an old-id → new-id map, built once and applied to both nodes and edges' `source`/`target`. Connection point ids are left untouched — they're only ever looked up in combination with their owning node's id, so two different node instances reusing the same point id is already normal, not a collision.
- **Paste position: the current viewport's center, not the copied absolute position** — pasting into a different window/diagram makes "wherever it was copied from" meaningless (could be far outside the new diagram's content entirely), and even pasting back into the same diagram the view may have panned/zoomed since the copy. A multi-node copy keeps its internal relative arrangement (offset from the group's own centroid), just recentered.
- **Repeated Ctrl+V cascades diagonally** (+20px per repeat, tracked via a ref comparing the current clipboard text to the last-pasted one) — standard clipboard-paste convention so repeated pastes don't stack exactly on top of each other. Resets on a fresh copy or when the clipboard content changes underneath it (something copied elsewhere).
- **Cut reuses `rfInstance.deleteElements(...)`**, not a hand-rolled filter — this is the same cascade-aware removal React Flow's own `deleteKeyCode` handling uses internally, so container-children promotion ([ADR 0012](0012-container-node-design.md)) stays correct without duplicating that logic a second time.
- **Keyboard shortcuts defer to native text-field behavior** (`!isEditingText`, same guard already used for Ctrl+A/D/Z) so copying/pasting text inside a label field uses the browser's own clipboard handling, not this diagram-element one. Also added to the Edit menu (Cut/Copy disabled with nothing selected; Paste always enabled — checking clipboard validity on every render just to compute a menu's disabled state isn't worth a synchronous clipboard read on every re-render, especially with [epic 0067](../planning/epics/0067-diagram-context-rerender-performance.md)'s open re-render-cost concern in mind).

## Known limitation, inherited from `duplicateSelected`, not new here
A pasted (or duplicated) node's `data.details`, `data.linkedDiagram`, and any custom icon path are copied by *reference* — the copy points at the exact same file on disk as the original. Editing the copy's details/linked-diagram would edit the original's too. This isn't a regression: `duplicateSelected`'s existing shallow `{ ...n.data }` spread already has the identical behavior, just never flagged. Not fixed here — real file-duplication-on-copy is genuinely more scope than this epic asked for, and nobody has reported it as a problem yet.

## Alternatives considered
- **In-app-only clipboard (React state).** Rejected — see Context; couldn't cross the window boundary this app already commits to.
- **Cascading paste position from the original absolute position** (like `duplicateSelected`'s `+20,+20`). Rejected for paste specifically — real risk of landing far outside a different diagram's visible content; viewport-center avoids that entirely while still feeling natural for same-diagram paste.
- **Hand-rolled filter-based deletion for Cut.** Rejected — `deleteElements` already exists and correctly handles the container-cascade case; reimplementing it risks silently diverging from Delete-key behavior.
- **Duplicating referenced files (details/icons) on copy.** Rejected for now — see Known limitation above.

## Consequences
- New `src/renderer/src/clipboard.ts` (payload shape, build/parse/remap — pure, no Electron/React Flow imports beyond types).
- `preload/index.ts`/`.d.ts`: `copyToClipboard`/`readClipboardText`.
- `Canvas.tsx`: `copySelection`/`pasteFromClipboard`/`cutSelection`, wired into both the keyboard handler and the Edit menu.
- No `.chd` schema change — the clipboard payload reuses `Node`/`Edge` shapes as-is; nothing about the file format changes.
