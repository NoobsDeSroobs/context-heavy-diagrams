# Known issues and challenges

A running log of real bugs and hard problems found during development — not a bug tracker for open work (that's `docs/planning/epics/`), but a lookup table: if something looks familiar, check here first before re-diagnosing it from scratch. Each entry captures the symptom, the actual root cause (often not what it looked like at first), and how it was resolved or why it's still open.

Add an entry whenever a bug takes real investigation to track down, or a design turns out to have a real, recurring class of failure — not for routine typos/typechecks caught immediately. Keep entries even after they're solved; the value here is precedent, not a to-do list.

## Status legend
- **Solved** — root cause fixed, shouldn't recur.
- **Worked around** — mitigated or narrowly patched, but the underlying cause is still there; a broader version of the problem could resurface.
- **Open** — known, not blocking, deliberately not fixed yet. Has a documented direction to revisit if it becomes a real complaint.

## Open items at a glance
- [Theme flip reads as "negative image" on toggle](#theme-flip-reads-as-negative-image-on-toggle) — Open, not urgent.

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
