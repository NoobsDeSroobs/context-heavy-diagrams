# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master` — a PoC in the literal sense (validated the hardest interaction ideas, settled the `.chd` shape), not a milestone toward MVP. 0018, 0013, and 0006 (selection/shortcuts, connection points, undo/redo) are also done and merged.

**Next batch, agreed order (expanded 2026-08-19)**: [0004](docs/planning/epics/0004-containers.md) (containers) → [0003](docs/planning/epics/0003-styling-panel.md) (styling panel + ADR 0010's named presets) → [0011](docs/planning/epics/0011-alignment-and-snapping.md) (alignment and snapping) → [0014](docs/planning/epics/0014-drag-edge-to-create-shape.md) (drag-edge-to-create-shape) → [0021](docs/planning/epics/0021-detail-frontmatter.md) (detail frontmatter) → [0024](docs/planning/epics/0024-multi-diagram-tabs-or-windows.md) (multi-diagram tabs/windows) → [0023](docs/planning/epics/0023-custom-metadata-bucket.md) (custom metadata bucket) → [0026](docs/planning/epics/0026-tagging-and-overlay-visualization.md) (tagging and overlay visualization).

One epic in flight at a time — don't start the next epic's branch until the current one is actually merged to `master`. Two epics in this batch aren't fully scoped yet and will need a real design pass when their turn comes, not just implementation: **0024** (marked "not yet scoped" — no design exists) and **0026** (mostly scoped, but several technical questions were deliberately deferred — see its Notes).

## Next up

**Epic 0004 (containers) implemented 2026-08-19** — `ContainerNode` (resizable, connectable, not rotatable — see [ADR 0012](docs/decisions/0012-container-node-design.md)), `parentId` schema field, drag-into/out-of-container reparenting, container-delete-promotes-children. Typecheck/lint clean; core hierarchy math (nested reparenting, array ordering, cycle safety) verified via a standalone script.

You tested it twice and found five things, all fixed same session:
1. Dragging a *multi-selected* group into a container only reparented the one node under the cursor — `onNodeDragStop` was ignoring React Flow's third callback argument (every node that moved), fixed to process all of them.
2. No bulk way to encapsulate a lot of already-positioned shapes at once — added an "Attach contained shapes" container menu item for exactly that.
3. Opening an existing diagram and clicking "Add container"/"Add shape" **deleted your already-placed nodes** — the fresh session's id counter collided with ids already used in the loaded file (e.g. regenerating `shape-2` when one already existed), silently overwriting it. First patched by syncing the counter past whatever a loaded file uses; you then asked why not just use a real globally-unique id instead — correct call, replaced the whole counter with `crypto.randomUUID()`-suffixed ids, which is simpler code and removes the bug class rather than patching each new collision path (e.g. epic 0025 copy/paste will need this too).
4. Dragging a shape back out of a container didn't work, stuck inside its bounds — caused by `extent: 'parent'` (added for resize-clamping) hard-blocking any drag past the container's edge, including the drag meant to leave it. Removed; container resize no longer clamps children as a result (accepted tradeoff, see epic 0004's Design).
5. New shapes/containers/text spawned at a fixed canvas origin, off-screen on a large panned/zoomed diagram — now spawn centered on the current viewport.

**Still not independently verified — yours to check**: dragging a node back out of a container (now that the bug's fixed), nested containers in the actual UI, and container deletion actually promoting a real child. Right-click menus and toolbar buttons turned out to be scriptable for verification after all; drag/selection still isn't — React Flow's custom pointer-capture system doesn't respond to synthetic events. See epic 0004's Notes for detail.

**Pre-existing lint cleanup, spun off while touching this code**: asked what the 6 pre-existing ESLint errors (unrelated to epic 0004) actually were. 2 were trivial/zero-risk and fixed immediately (an unescaped apostrophe in `IconPicker.tsx`, and a genuinely-unnecessary `useState`+`useEffect` there that's now a plain `useMemo`d derived value). The other 4 need real understanding first, not a rushed pass — split into [epic 0028](docs/planning/epics/0028-remaining-lint-cleanup.md), which has a full plain-language writeup of both remaining issues (a Fast-Refresh dev-only false positive on `DiagramContext.tsx`, and a "reset state before an async fetch" pattern in 3 places that's arguably correct today and needs a `key`-driven remount to fix properly without introducing a stale-content-flash regression).

Also outstanding, not in this batch: 0005 (dark/light), 0010/0016 (export), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), 0022 (example gallery — better after 0003/0004 land), 0025 (copy/paste, unscoped), 0027 (app branding + licensing — GPL-3.0-or-later decided and LICENSE landed, see [ADR 0011](docs/decisions/0011-software-license-choice.md); branding itself and a few licensing paperwork tasks still open), 0028 (remaining lint cleanup, see above).
