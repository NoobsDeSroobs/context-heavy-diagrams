# 0009: Linked-diagram navigation

## Status
Done

## Goal
Ctrl/Cmd+click on a node navigates into a linked diagram (a drill-down view), resolved via an explicit relative path stored on the node — see [docs/decisions/0005-diagram-identity-and-linking.md](../../decisions/0005-diagram-identity-and-linking.md) for the identity/linking model this builds on. Distinct trigger from the detail sublayer — both can exist on the same node.

## Tasks
- [x] Ctrl/Cmd+click handler on nodes, distinct from plain click (select) and right-click (details) — required explicitly pinning React Flow's `multiSelectionKeyCode` to `"Shift"` (it defaults to Ctrl/Cmd, which collided; also fixed a stale/backwards note about this in epic 0018)
- [x] Creating a *new* linked diagram from a node with none yet: default the new file's name to a sanitized version of that node's current label text
- [x] Linking to an *existing* diagram instead: let the user browse to or type a path directly — no new file created
- [x] Resolve the node's linked-diagram path and load it
- [x] Graceful missing-link handling: following a link whose target file doesn't exist shows a clear "linked diagram not found at `<path>`" error — never a silent failure or crash. The diagram containing the broken link must still open and work fine on its own.
- [x] Some way back to the parent diagram (breadcrumb / back navigation)

## Notes
Links only ever point downward (parent → child), never back up — this is what makes any diagram independently openable as its own root, per ADR 0005. Nothing here needs to know or care whether the diagram it's in is "the" top-level one or a branch partway down a tree.

Also added, beyond the original task list: a "Remove link" right-click menu item (re-linking is remove-then-Ctrl+click-again — no separate "change link" UI). New linked diagrams default into the same sibling colocation folder used for assets/details (`<diagramBase>/<sanitized-label>.chd`), per `docs/file-format.md`'s pre-existing forward note.

Deferred, not gaps — deliberate v1 scope decisions: no visual badge/icon on a node indicating it has a linked diagram (relies on the existing `title`-tooltip pattern only; a good well-contained follow-up). No "unsaved changes" warning on breadcrumb *back*-navigation, which still re-opens fresh from disk (this app has no dirty-tracking/autosave at all yet, see epic 0020).

A real bug caught during planning, not implementation: resolving a stored relative path with a bare `path.join` silently breaks when the path is actually absolute (which `path.relative` correctly produces for cross-Windows-drive links) — fixed by checking `path.isAbsolute()` first in `src/main/links.ts`.

**A real bug caught during your manual test pass**: creating or linking a diagram set the link in React state via `updateNodeData` and then immediately navigated into the target, replacing all in-memory state before the parent was ever written to disk — the link was lost every single time, not an occasional risk (this also fully retires the "orphaned file" deferred item above; it's not a residual risk anymore, it's fixed). Fixed by introducing `persistDiagram` in `Canvas.tsx` — the single place a diagram gets written to disk — and calling it (with the link merged into a freshly-computed node list, not via `updateNodeData` + hoping a later read sees it) before any forward link navigation, whether creating a new link, picking an existing one, or Ctrl+clicking an already-linked node. `performSave` was refactored to go through the same function rather than duplicating the write logic.

Also changed based on the same test pass: "Link to existing diagram…" no longer navigates into the target after linking — it links and stays put. Unlike "create new" (where jumping in to start working makes sense), pointing at something that already exists doesn't imply wanting to leave what you're doing. "Create new" still navigates in immediately.

A multi-window/tabs idea came up during testing as a possible fix — deliberately not adopted for this epic. The actual bug had a small, complete fix (above) that doesn't need it; viewing parent and child simultaneously without round-tripping through breadcrumbs is a legitimate but much larger feature, worth its own epic and design discussion rather than bundling into this one.
