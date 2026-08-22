# Known issues and challenges

A running log of real bugs and hard problems found during development — not a bug tracker for open work (that's `docs/planning/epics/`), but a lookup table: if something looks familiar, check here first before re-diagnosing it from scratch. Each entry captures the symptom, the actual root cause (often not what it looked like at first), and how it was resolved or why it's still open.

Add an entry whenever a bug takes real investigation to track down, or a design turns out to have a real, recurring class of failure — not for routine typos/typechecks caught immediately. Keep entries even after they're solved; the value here is precedent, not a to-do list.

## Status legend
- **Solved** — root cause fixed, shouldn't recur.
- **Worked around** — mitigated or narrowly patched, but the underlying cause is still there; a broader version of the problem could resurface.
- **Open** — known, not blocking, deliberately not fixed yet. Has a documented direction to revisit if it becomes a real complaint.

## Open items at a glance
- [Theme flip reads as "negative image" on toggle](#theme-flip-reads-as-negative-image-on-toggle) — Open, not urgent.
- [Enabling a highlight makes a container look like it shrinks](#enabling-a-highlight-makes-a-container-look-like-it-shrinks) — Open, not investigated.

---

## A menu bar's hover-switch races its own click handler
**Status:** Solved
**Found:** 2026-08-22, epic 0049, while building the custom top menu bar

**Symptom:** clicking a different top-level menu label (e.g. "View") while a sibling menu ("File") was already open closed the whole menu bar instead of switching to the clicked one. Only reproduced with a real click landing on a different label than whatever was already open — a bare click from a fully-closed state, or a repeat click on the same already-open label, both worked fine on their own.

**Root cause:** the menu bar supports the conventional "hover a sibling to switch while one is open" behavior via `onMouseEnter`. A mouse click gesture always fires `mouseenter` on the target element *before* `click` (the cursor has to arrive before it can press) — so by the time the click handler ran, `onMouseEnter` had already switched `openIndex` to the clicked menu. The click handler's own toggle logic (`current === index ? close : open`) then saw "you clicked the menu that's already open" and closed it, even though that "already open" state was only a few milliseconds old and produced by the same physical gesture, not a genuinely separate prior interaction.

**Resolution:** a ref (`hoverSwitchedToRef`) records the index `onMouseEnter` just switched *to*, but only when it represents a genuine switch (arriving from a different index — re-entering the same already-open menu, or hovering while nothing is open, don't touch it). The click handler checks this first: if the click is landing on the menu hover just switched to as part of the same gesture, it keeps the menu open instead of toggling it closed.

**Investigation note:** this was hard to pin down via the Browser pane's automated clicks — repeated attempts at the identical test sequence gave inconsistent results (sometimes the switch worked, sometimes it didn't), most likely because the automation tool's cursor-positioning between separate tool calls doesn't reliably match real continuous mouse movement (whether `mouseenter` fires at all, and exactly when, depended on exactly how the pointer "arrived"). Ground truth came from temporarily instrumenting the component with `console.log` on every `mouseenter`/`click` and reading the actual event sequence back via the console, not from trusting the automation's click results directly — worth reaching for that technique earlier next time a hover-timing-sensitive interaction needs debugging in this environment.

**References:** [epic 0049](planning/epics/0049-top-menu-bar.md), [ADR 0039](decisions/0039-top-menu-bar.md), `src/renderer/src/components/MenuBar.tsx`

---

## Enabling a highlight makes a container look like it shrinks
**Status:** Open, not investigated
**Found:** 2026-08-22, live use by the user, while testing epic 0026's highlight feature during epic 0049 design work

**Symptom:** enabling a highlight that matches a container makes the container appear slightly smaller — the user confirmed its actual transform (position/size data) is unchanged, so this is a rendering/visual effect only, not a real resize.

**Root cause:** not investigated yet. Plausible, unconfirmed hypothesis worth checking first: a single-match highlight overrides border width to `HIGHLIGHT_BORDER_WIDTH` (3px, `highlights.ts`) on top of a container's own default `1.5px dashed` border (`main.css`'s `.container-node`) — both node types are `box-sizing: border-box`, so the outer box shouldn't actually move, but a border doubling in width is a well-known perceptual effect (more visual "weight" at the edge reads as a smaller interior) and might be compounded by the dashed pattern's spacing changing at the new width. Unconfirmed — could also be a real (if small) box-sizing or dashed-border-rendering quirk specific to containers vs. shapes, not just perception.

**Current state:** flagged by the user explicitly as not urgent — logged so it isn't lost, not because a fix is wanted now. If revisited, start by checking whether `.container-node`'s rendered bounding box (`getBoundingClientRect`) actually changes at all when a highlight is enabled, which would immediately confirm or rule out the perceptual-only hypothesis above.

**References:** `src/renderer/src/highlights.ts`, `src/renderer/src/assets/main.css`'s `.container-node`, `src/renderer/src/nodes/ContainerNode.tsx`

---

## New-node z-index seeding ignored its own tier scheme
**Status:** Solved
**Found:** 2026-08-22, live use by the user, right after epic 0044 shipped

**Symptom:** creating a container then a shape in a diagram gave them z-index values of 10 and 20 — nowhere near the tiered ranges epic 0043 established (containers low, shapes/text much higher, so a fresh container defaults behind existing shapes and vice versa).

**Root cause:** `nextZIndex` (the helper behind `addShapeNode`/`addTextNode`/`addContainerNode`) only scoped *containers* correctly (to other existing containers). Shapes and text both scoped to *every* node regardless of type, with no tier floor at all — so in a small or empty diagram, "current max across everything, plus one gap" landed far below the intended tier. The load-time backfill (`backfillZIndex`, used for old files) had always done this correctly; only the new-node-creation path had the bug, so it went unnoticed until enough manual node creation happened in one session for the user to notice the numbers directly (visible in the layer panel).

**Resolution:** `nextZIndex` now always scopes to the node's own type and passes that type's own base floor into `nextZIndexAbove`, so a brand new node of any type lands solidly within its tier even when nothing of that type exists yet. Also added a third tier: text now seeds above shapes (`TEXT_BASE`, higher than `SHAPE_BASE`), a small enhancement bundled into the same fix at the user's request, since annotations reasonably belong on top of the shapes they label.

**References:** `docs/planning/epics/0043-layer-order-control.md`'s Notes, `src/renderer/src/layers/zIndexOrdering.ts`, `src/renderer/src/Canvas.tsx`

---

## React Flow requires `updateNodeInternals()` after dynamically adding a handle
**Status:** Solved
**Found:** 2026-08-20, epic 0022 gallery testing (originally shipped as part of epic 0013)

**Symptom:** a connection point added via "Add connection point here" rendered fine and looked clickable, but silently refused to accept an edge being dragged onto it — specifically as an edge's *target* (an edge originating elsewhere and terminating on the new point). The point had gone untested in that specific direction for months because gallery-scale diagrams hadn't exercised it until epic 0022.

**Root cause:** React Flow caches each node's handle bounds for connection validation at mount time. A `Handle` added to an already-rendered node afterward exists in the DOM and looks correct, but React Flow's internal cache doesn't know about it until `updateNodeInternals(nodeId)` is called explicitly. This codebase never called it.

**Resolution:** both the add and remove paths in `connectionPoints.ts` call `updateNodeInternals(id)` after mutating a node's connection points. Generalized into the standing pattern for any future dynamically-added handle, not just this one call site — see the pattern repeated (correctly) throughout epic 0039's later work on the same file. **If a future feature adds any other kind of dynamically-created handle to a node, check for this same requirement before assuming "it renders, so it works."**

**References:** [epic 0013](planning/epics/0013-configurable-connection-points.md), `src/renderer/src/nodes/connectionPoints.ts`

---

## Connection point count/spacing model — five-round bug chain
**Status:** Solved
**Found:** 2026-08-21/22, epic 0039

The single richest bug chain so far — worth reading in full via [ADR 0036](decisions/0036-connection-point-count-and-transfer.md) (five dated revisions) and [epic 0039](planning/epics/0039-connection-point-counts.md)'s Verification section, but the short version:

1. **Spacing overlap/clustering**: computing evenly-spaced offsets for only the *custom* points (ignoring that a side's always-present default point sat at a fixed 0.5) made every even total count overlap a point exactly onto the default, and every odd total visually cluster around it.
2. **Root cause of #1, and independently, wrong-neighbor edge transfers on reconnect**: the default point was a real, separate, hardcoded concept (4 unconditional `<Handle>` elements, fixed id, fixed offset) living entirely outside the array the app's own clockwise-ordering/transfer logic reasoned about. **General lesson: a "keep this one element fixed to avoid a bigger rework" scoping compromise, applied to something meant to look/behave uniformly with the rest of a set, tends to be a false economy — the exception becomes exactly where bugs hide.** Fixed by unifying the default into the same per-side array as everything else (synthesized on demand only for an untouched side, materialized as an ordinary point the moment the side is touched).
3. **Manual add/remove not re-spacing**: a deliberate "precision tool, don't touch anything but the one point you're editing" design choice — looked broken in practice rather than precise. Every structural operation (bulk count field, manual add, manual remove) now re-spaces the whole side afterward; only *which* point moves differs.
4. **Bottom/left mirrored**: the shared re-spacing helper always zipped ascending offset values onto a clockwise-sorted array by plain index — correct on top/right (clockwise = ascending raw offset there) but backwards on bottom/left (clockwise = descending). Fixed by reversing the offset assignment on those two sides.
5. **Max-per-side setting bypassed**: the setting was only ever wired into the property panel's number field; the separate manual right-click "add" code path had no knowledge of it at all. **General lesson: when a limit/setting needs enforcing, check every entry point that can trigger the guarded action, not just the one you're focused on** — threaded the setting through `DiagramContext` (shared by every node component) instead of just the one UI surface.

**References:** [ADR 0036](decisions/0036-connection-point-count-and-transfer.md), [epic 0039](planning/epics/0039-connection-point-counts.md), `src/renderer/src/nodes/connectionPoints.ts`

---

## Layer panel drag-and-drop: ambiguous drop target, then a dead zone
**Status:** Solved
**Found:** 2026-08-21, epic 0043, live testing by the user

**Symptom:** two separate issues found back to back while testing the new layer-reorder panel: (1) dropping directly onto a row didn't make clear which side of that row the dragged item would land on; (2) after adding a visible insertion-line indicator to fix that, dropping *between* rows (on the indicator itself, or in the gaps) produced a "not allowed" cursor and the drop silently failed.

**Root cause:** (1) was a UX gap, not a bug — no visual feedback for an inherently ambiguous gesture. (2) was a real bug: only the row elements had drag-over/drop listeners, so the space between them (where the insertion line rendered) had no drop handler at all.

**Resolution:** (1) replaced ambiguous drop-onto-a-row with a visible insertion line computed from cursor position. (2) moved drag-over/drop listening to the whole list container and computed the target slot geometrically from cursor position, rather than relying on which specific child element the pointer happened to be over.

**References:** [epic 0043](planning/epics/0043-layer-order-control.md), [ADR 0035](decisions/0035-layer-order-control.md), `src/renderer/src/components/LayerPanel.tsx`

---

## Edge reconnect-handle "ownership" at a shared connection point isn't decided by z-index
**Status:** Solved (with a documented fallback if it resurfaces)
**Found:** 2026-08-21, epic 0046

**Symptom:** with several edges converging on the same connection point, the reconnect-drag handle (the small circle used to move an edge's endpoint) always belonged to the *last-created* edge, regardless of which edge was actually selected — a user couldn't reliably grab a specific edge at a busy convergence point.

**Root cause investigation — the obvious theory was wrong.** React Flow's `elevateEdgesOnSelect` (on by default, never overridden here) should already bump a selected edge's z-index by 1000, which should win any hit-test "for free." It didn't, and reading the React Flow source didn't turn up why. The user tested directly on a real shape with three converging edges and found the *actual* mechanism was DOM/creation order, not z-index at all — React Flow's own reconnect-handle hit test appears to prefer whichever edge is later in paint order, independent of the z-index elevation.

**Resolution:** rather than keep chasing why the library's own z-index elevation doesn't win, the fix targets what the user's test actually implicated — `Canvas.tsx` now computes `orderedEdges`, a derived array with selected edges stably moved to the end before being passed to `<ReactFlow edges={...}>`, so DOM/paint order (not any z-index concept) decides the tie. The real `edges` state (save order, undo history) is untouched — this is rendering-only, same pattern as the unrelated `zIndexedNodes` computation already used for container/shape stacking.

**If this doesn't fully hold up in some other convergence scenario**: the documented fallback (not built, kept in reserve) is intercepting the pointer event directly — capture-phase listener on pointerdown, `elementsFromPoint` to find every element under the cursor, prefer the currently-selected edge if it's among them, `stopImmediatePropagation` and re-dispatch onto the correct DOM node. More complex (real event interception) but sidesteps needing to understand React Flow's own hit-test priority at all.

**References:** [epic 0046](planning/epics/0046-edge-selection-highlight-and-priority.md), `src/renderer/src/Canvas.tsx`

---

## Theme flip reads as "negative image" on toggle
**Status:** Open, not urgent
**Found:** 2026-08-21, epic 0040

**Symptom:** even after the Oklab-based fix for the color-mirroring mechanism (see below), the user reports a lingering feeling of "looking at a negative image of my diagram" when toggling between light and dark theme.

**Root cause:** not a bug — this is the expected visual signature of the *blanket* mirroring approach epic 0040 deliberately chose: every explicitly-colored element's lightness flips uniformly around the same midpoint on every theme change, which reads as a whole-diagram inversion. A targeted, contrast-driven approach (only adjust colors that actually have a legibility problem against the new background, leave everything else alone) would avoid this feeling, but was rejected in [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md) as more complexity than wanted for v1.

**Current state:** flagged by the user as something to get used to, not currently a real complaint — deliberately not fixed. **If it resurfaces as an actual complaint**, the contrast-driven alternative is the documented direction to revisit — see ADR 0034's Alternatives section for the tradeoffs already considered.

**References:** [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md), [epic 0040](planning/epics/0040-theme-adaptive-color-value-flip.md)

---

## Theme-mirror mechanism: HSV Value isn't hue-blind-safe
**Status:** Solved (same-day revision, before the issue above was ever separately reported)
**Found:** 2026-08-21, epic 0040, live testing by the user

**Symptom:** the first shipped version of the theme-adaptive color flip (mirroring HSV's Value channel: `V' = 100 - V`) produced real contrast problems on some colors when the user tested it live — some flipped colors were hard to read against their new background.

**Root cause:** HSV's Value doesn't track actual perceived brightness consistently across hues — it's hue-blind, so two colors with the same V can look quite different in actual lightness (a saturated red reads darker than its V value suggests). Mirroring V doesn't reliably preserve legibility.

**Resolution:** switched same-day to mirroring Oklab's Lightness channel instead (`flip(L) = 1 - L`, chroma/hue held fixed) — Oklab's L is designed to track actual perceived brightness across every hue, which is what a legibility-preserving mirror actually needs.

**References:** [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md), `src/renderer/src/styles/themeAdaptiveColor.ts`

---

## File → Close leaves a stale "this window shows path X" registration
**Status:** Solved
**Found:** 2026-08-22, epic 0020, live testing by the user

**Symptom:** open a file, File → Close it (resets to blank), then try to open that same file again — nothing visibly happens.

**Root cause:** `windows.ts` tracks which `BrowserWindow` shows which path (`windowsByPath`) so opening an already-open file focuses the existing window instead of duplicating it. That registration is normally kept in sync by `loadPathIntoWindow`, called on every real page navigation (initial open, File → Open reuse, link navigation). File → Close (epic 0049) deliberately resets the window's content *in place* — `loadDiagramIntoCanvas(null, ...)` in the renderer, no page navigation at all — so `windowsByPath` never learned the window stopped showing that path. Reopening the same file found the (stale) registration, and just focused the now-blank window instead of loading anything into it.

**Resolution:** new `windows:clearPath` IPC call, invoked from `handleClose` right after the in-place reset, which removes this window's entry from `windowsByPath` (reusing the existing `unregisterWindow` matches-by-window-reference helper, already used on real window close).

**References:** [epic 0020](planning/epics/0020-autosave-and-crash-recovery.md), [ADR 0039](decisions/0039-top-menu-bar.md) (File → Close's original design), `src/main/windows.ts`, `src/renderer/src/Canvas.tsx`

---

## React Flow's post-load auto-measurement was misclassified as a real edit
**Status:** Solved
**Found:** 2026-08-22, epic 0020, live testing by the user

**Symptom:** File → Close and File → Reload's confirm prompt ("changes since the last save will be lost") appeared every time, identically, whether or not the user had actually made any edits since opening the file.

**Root cause:** `onNodesChange`'s existing change-classifier (predates epic 0020) treats a `dimensions` NodeChange with `resizing === undefined` as a discrete, snapshot-worthy edit — meant to catch a scripted/programmatic resize. React Flow's own `ResizeObserver`-driven post-mount measurement of every freshly-loaded node fires that exact same shape of change (a `dimensions` change with `resizing` left undefined, since it isn't part of any user drag gesture). Before this epic, that misclassification was invisible — it just added a harmless extra no-op entry to the undo stack. Once `pushSnapshot()` also started marking the diagram dirty (this epic's whole point), every load falsely dirtied the diagram immediately, defeating the new dirty-aware prompts entirely.

**Resolution:** a short (500ms) grace window after any `loadDiagramIntoCanvas`, tracked via a ref, during which a `dimensions`-with-`resizing`-undefined change no longer counts as discrete. Every other discrete-change condition (remove/add/replace, a real position change) is untouched — deliberately the narrowest fix that addresses the specific ambiguous case rather than broadening the suppression window to cover more change types than necessary.

**References:** [epic 0020](planning/epics/0020-autosave-and-crash-recovery.md), [ADR 0040](decisions/0040-dirty-tracking-and-autosave-design.md), `src/renderer/src/Canvas.tsx`'s `onNodesChange`/`loadDiagramIntoCanvas`

---

## Unparented native dialog can open behind the app window
**Status:** Solved
**Found:** 2026-08-22, epic 0020, live testing by the user

**Symptom:** the startup orphan-recovery dialog (Recover/Discard for a diagram that crashed before ever being saved) opened *behind* the main Electron window instead of on top of it.

**Root cause:** `dialog.showMessageBox()` was called with no owning `BrowserWindow` — at the point the startup scan runs, no window created specifically *for* the recovered content exists yet (that window is only created if the user chooses Recover). An unparented native dialog has no guaranteed z-order relative to the app's own windows, and lost the race against the initial blank window claiming focus after its own `ready-to-show`.

**Resolution:** the app's already-created initial window (from `createWindow()`, called just before the scan starts) is passed as the dialog's owner, giving it a defined z-order/parent relationship instead of none.

**References:** [epic 0020](planning/epics/0020-autosave-and-crash-recovery.md), [ADR 0040](decisions/0040-dirty-tracking-and-autosave-design.md), `src/main/recovery.ts`'s `runStartupOrphanScan`, `src/main/index.ts`
