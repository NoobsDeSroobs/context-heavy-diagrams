# Known issues and challenges

A running log of real bugs and hard problems found during development — not a bug tracker for open work (that's `docs/planning/epics/`), but a lookup table: if something looks familiar, check here first before re-diagnosing it from scratch. Each entry has the symptom, the actual root cause (often not what it looked like at first), and how it was resolved or why it's still open.

Add an entry whenever a bug takes real investigation to track down, or a design turns out to have a real, recurring class of failure — not for routine typos or errors caught immediately. Solved entries are kept short (symptom, cause, fix, lesson); Open and Worked-around entries keep their full reasoning.

## Status legend

- **Solved** — root cause fixed, shouldn't recur.
- **Worked around** — mitigated or narrowly patched, but the underlying cause is still there; a broader version of the problem could resurface.
- **Closed** — investigated and not a defect to fix: not reproducible, explained, or accepted by design. The entry says why and what would reopen it.
- **Open** — known, not blocking, deliberately not fixed yet. Has a documented direction to revisit if it becomes a real complaint.

## Open and worked-around at a glance

- [Alt+drag duplicate may be swallowed by Linux window managers](#alt-drag-duplicate-may-be-swallowed-by-linux-window-managers) — Open, untested on Linux.
- [A colour typed in light mode comes back changed (the theme flip is not exactly reversible)](#a-colour-typed-in-light-mode-comes-back-changed-the-theme-flip-is-not-exactly-reversible) — Open, needs a design decision.
- [A native confirm() dialog left `<select>` elements unresponsive afterward](#a-native-confirm-dialog-left-select-elements-unresponsive-afterward) — Worked around.
- [Clicking a container selects a different container that visually encloses it](#clicking-a-container-selects-a-different-container-that-visually-encloses-it) — Worked around.

---

## Opening a diagram with highlight groups asks to save when it is closed

**Status:** Solved (2026-10-22, [ADR 0128](decisions/0128-a-diagram-repaired-on-load-counts-as-changed.md))
**Found:** 2026-10-21 (a save-or-discard dialog after toggling the legend and a highlight)

**Symptom:** open an older diagram that has highlight groups (the gallery examples with highlights did), change nothing, close the window: the app asks whether to save. Toggling the legend, the highlights panel or a highlight was never the cause.

**Cause:** the automatic highlight resync (ADR 0026 addendum) runs while `Canvas.tsx` renders and calls `markDirty()` when it changes the catalog; for older files it adds the implicit "None" (`null`) entry or a newly allowed value. Every other repair at load (container references, required tags, security references) was silent, so the same kind of change sometimes asked to save and usually did not.

**Fix:** a diagram the load had to repair now always counts as changed (a comparison of what a save would write with what was read, in `loadDiagramIntoCanvas`), and the four example files that needed repairs were saved in sync. `Canvas.test.tsx` opens every example and fails if one would ask to save.

**References:** `src/renderer/src/canvas/Canvas.tsx` (`repairedOnLoad`), `src/renderer/src/canvas/Canvas.test.tsx`

---

## Alt+drag duplicate may be swallowed by Linux window managers

**Status:** Open, untested on Linux
**Found:** 2026-09-24, while designing the duplicate-drag feature (not yet observed — no Linux machine available)

**Symptom (expected):** on Linux desktops where the window manager grabs Alt+drag to move windows (GNOME/Mutter, KDE/KWin and XFCE by default), the app never receives the Alt mouse-down, so Alt+drag duplicate does nothing and the whole window moves instead.

**Deliberately not fixed yet:** the author would rather not have OS-dependent hotkeys, so Alt ships on all platforms and this is logged as a potential problem to verify on a Linux machine.

**If it bites:** switch `DUPLICATE_DRAG_MODIFIER` in `src/renderer/src/canvas/useModifierDragDuplicate.ts` to `'ctrlKey'` (one line; also update the `create.duplicateDrag` label in `commands.ts`) — Ctrl+drag is not grabbed by those window managers and nothing else in the app uses it. Choosing the modifier per OS is the alternative the author wants to avoid. Also verify on Linux that `setMenuBarVisibility(false)` in `src/main/windows.ts` keeps Alt from revealing the native menu.

**References:** [ADR 0099](decisions/0099-modifier-drag-duplicate.md), `src/renderer/src/canvas/useModifierDragDuplicate.ts`

---

## A colour typed in light mode comes back changed (the theme flip is not exactly reversible)

**Status:** Open, measured 2026-10-17 (pre-existing; found while verifying ADR 0117). Decided 2026-10-18 not to block the first release; to be fixed later

**Symptom:** in light mode, select an element, type `#ff0000` into a colour field, and the field settles on `#c83a2d`; the element is drawn that colour, not the red that was typed. Switching to dark mode shows `#9f0000` for the same stored value, and back to light shows `#c83a2d` again, so the panel and the drawing always agree with each other, just not with what was typed.

**Root cause:** an edit stores `themeAdaptiveColor(typed, theme)` (the dark-theme baseline) and the display flips it back. The flip mirrors lightness in Oklab and keeps hue and chroma; for a saturated colour the mirrored lightness falls outside the sRGB gamut and is clamped, so flipping twice does not return the original. Pale or low-chroma colours round-trip almost exactly; strong reds, blues and greens do not.

**Why it matters:** stored values are the dark baseline and light mode is a conversion of it, which is right, but the *edit* path in light mode must then find a baseline whose conversion equals what was typed, and today it only applies the forward flip.

**Direction (not decided):** solve for the baseline instead of flipping the typed value, e.g. search the stored-form colour whose light-mode conversion is closest to what was typed (hue and chroma fixed, lightness found numerically), or accept the typed value exactly in the current theme and store the nearest baseline. Needs a decision on how close is close enough, and a test over a grid of colours.

**References:** `src/renderer/src/styling/themeAdaptiveColor.ts`, `src/renderer/src/properties/PropertyPanel.tsx` (the `onChange` of each `ColorField`), [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md)

---

## A native confirm() dialog left `<select>` elements unresponsive afterward

**Status:** Worked around
**Found:** 2026-08-22, live testing

**Symptom:** after `AllowedValuesEditor`'s in-use warning (`window.confirm(...)`) was dismissed — confirmed or cancelled — every `<select>` in the Required Tags panel stopped opening on click. No console error.

**Root cause:** not understood at the Electron/Chromium level; a focus/interaction state left broken by the native dialog closing. The app uses `confirm()`/`alert()` successfully elsewhere, but none of those is immediately followed by opening a native `<select>` in the same still-open panel, which is probably what exposed it.

**Workaround:** replaced the native `confirm()` with an in-panel confirmation (the row being removed becomes an inline message plus Confirm/Cancel buttons). **Any feature that shows a native `confirm()`/`alert()` and then expects the user to keep using `<select>` elements in the same view should watch for this and prefer an in-app confirmation.**

**References:** [ADR 0047](decisions/0047-allowed-values-list-editor.md), `src/renderer/src/tagging/RequiredTagsSection.tsx`

---

## Clicking a container selects a different container that visually encloses it

**Status:** Worked around, confirmed (2026-10-17). The z-inversion itself is a React Flow invariant and cannot be fixed; it is surfaced instead of silent.
**Found:** 2026-08-29, live use on a real Azure overview diagram

**Symptom:** two containers; the Layers panel shows A above B, but clicking A's visible area selects B.

**Root cause:** in the file, B is a **child** of A (`parentId`) but is the geometrically larger box that fully encloses A, so the data hierarchy is inverted relative to the visual nesting (B was resized past its parent; resizing doesn't un-parent). React Flow forces a child's effective z-index to at least `parentZ + 1` regardless of the explicit `zIndex` (`calculateChildXYZ` in `@xyflow/system`, kept even with `zIndexMode: 'manual'`), so B renders and hit-tests above A while this app's Layers panel, which reads raw `data.zIndex`, correctly says A is on top. Nothing reconciled the two.

**What was done (ADR 0075):** a standing Diagnostics advisory names both containers when a child extends outside its parent; the Layers panel keeps sorting on raw `data.zIndex` (that is what drag-to-restack edits) but marks rows where raw and effective order disagree (`in: <parent>` with a warning icon); a right-click **Detach from parent** is available on any nested node. Auto-un-parenting was declined (the child may overflow deliberately); load-time healing covers only dangling or cyclic `parentId`.

**References:** [ADR 0035](decisions/0035-layer-order-control.md), [ADR 0075](decisions/0075-container-hierarchy-integrity.md), `src/shared/canvas/zIndexOrdering.ts`, `src/renderer/src/layers/LayerPanel.tsx`

---

## Details panel Markdown: tables (and other GFM syntax) rendered as literal text

**Status:** Solved (2026-09-05)

**Symptom:** a pipe table in a node's details `.md` showed as plain text in the preview.

**Cause:** pipe tables, strikethrough and `- [ ]` task lists are GitHub-Flavored Markdown extensions; `react-markdown` is CommonMark-only without `remark-gfm`, which was never wired in.

**Fix:** `remark-gfm` added to the Details panel's `ReactMarkdown`, plus `.details-panel-preview table/th/td` styling (otherwise a correctly parsed table would have no visible grid and look like the same bug).

**References:** `src/renderer/src/details/DetailsPanel.tsx`, `src/renderer/src/assets/main.css`

---

## File → Recent Diagrams never reused an empty calling window

**Status:** Solved (2026-09-05)

**Symptom:** File → Open and drag-drop reuse an empty window; picking a recent diagram from an empty window opened a separate one.

**Cause:** `windows:openRecent` was modelled on link navigation (which deliberately never reuses the calling window) instead of on File → Open, although it is a top-level "open a diagram" entry point.

**Fix:** it now takes the same `callingWindowEmpty` flag as `windows:pickAndOpen` and passes the calling window as the reuse candidate.

**References:** `src/main/windows.ts` (`openOrFocusWindow`, `windows:openRecent`), [ADR 0023](decisions/0023-multi-window-diagram-model.md)

---

## Text nodes have zero internal padding — label touches the border, and clicking near the start grabs the node instead of placing a text cursor

**Status:** Solved, confirmed live (2026-10-17)

**Symptom:** a text node's label touched its left border, and clicking near the start of the text grabbed the node's edge instead of placing the cursor.

**Cause:** neither `.text-node` nor `.text-node-label` set any padding (entities already had `4px 8px`), and the `.chd` format has no padding field to work around it.

**Fix:** `padding: 8px` on `.text-node-label`; edit mode needed its own `.text-node-label-input` rule placed after the shared `.editable-label-input` (same specificity, source order wins).

---

## Text node content isn't clipped to its own box — a long label bleeds over whatever sits below it on canvas

**Status:** Solved, confirmed live (2026-10-17)

**Symptom:** a long text node label rendered taller than the node and covered shapes below it.

**Cause:** no node type clipped its content. `overflow: hidden` cannot go on `.text-node` itself because `NodeResizer`'s handles are DOM children that sit partly outside the box by design.

**Fix:** `max-height: 100%; overflow: hidden` on `.text-node-label` only (the percentage resolves because React Flow gives the node wrapper a definite height). Entity and container labels have the same latent gap and are left until reported.

---

## Legend line/shape swatches with no explicit `color` rendered completely invisible

**Status:** Solved, confirmed live (2026-10-17)

**Symptom:** a hand-authored legend entry without `color` drew nothing.

**Cause:** `LegendSwatch` set `stroke={entry.color}` / `background: entry.color` with no fallback; `undefined` means no stroke and a transparent background, not "use the default look" like every other styleable surface.

**Fix:** line swatches fall back to `var(--xy-edge-stroke-default)`, shape swatches to `var(--ev-c-gray-1)`.

---

## Default edge stroke (color and width) was React Flow's stock value, unreadable against this app's dark-theme canvas

**Status:** Solved for what was reported (the stroke is readable); the related blank-property-panel gap was fixed later (see "Property panel shows blank fields for style values that are unset")
**Found:** 2026-09-05

**Symptom:** an edge with no explicit `style.stroke` was hard to see, worst in dark theme.

**Cause:** the app never overrode React Flow's `--xy-edge-stroke-default` (`#3e3e3e` dark, `#b1b1b7` light) or its 1px default width.

**Fix:** per-theme overrides of the colour variables in `base.css` (lighter on dark, darker on light). Width could **not** be done with a CSS variable: `LabeledEdge.tsx` sets an inline `strokeWidth` unconditionally, and an inline style beats a custom property every time, so the JS constant went from 1 to 1.5. Later (2026-09-15) `stroke` was also made unconditionally inline (`DEFAULT_STROKE_COLOR`, kept equal to `base.css` by hand) because that asymmetry was also why the PNG arrowhead bug only hit unstyled edges.

**Lesson:** before a "default via CSS variable" change on a component, check whether the property is already set unconditionally inline.

**References:** `src/renderer/src/assets/base.css`, `src/renderer/src/edges/LabeledEdge.tsx`

---

## A hand-authored edge with no `type` field silently rendered as React Flow's built-in default edge, not this app's `LabeledEdge` — no style, no highlights, no custom routing, no error

**Status:** Solved, confirmed live (2026-09-05)

**Symptom:** edges without a `type` (valid per the file format) drew in the right place with a label, but ignored highlights, style edits and custom routing. No console error; opening an app-generated file worked, which made it hard to localise.

**Cause:** `fromDiagramFile` built every edge with `type: e.type` unconditionally, producing an own-property `type: undefined`. React Flow resolves the type with `edge = { ...defaultEdgeOptions, ...edge }`, and spreading copies `undefined` values, so the `'labeled'` default was overwritten, `edge.type || 'default'` picked React Flow's own built-in component, and nothing reported an error.

**Fix:** spread `type` conditionally like every other optional field (`...(e.type ? { type: e.type } : {})`). The skill's examples still declare `"type": "labeled"` explicitly, as insurance for older builds.

**Lesson:** never put an optional key on an object as `key: undefined` when a later spread is meant to fill it from defaults.

**References:** `src/renderer/src/canvas/Canvas.tsx` (`fromDiagramFile`, `DEFAULT_EDGE_OPTIONS`), `@xyflow/react`'s `EdgeWrapper`

---

## Diagnostics "missing files" check didn't flag a reported broken relative path in real diagram data

**Status:** Closed, cannot reproduce (2026-10-17)
**Found:** 2026-09-04

**Symptom:** a user's diagram had icon/details/link paths that looked copy-pasted from a sibling diagram (e.g. `Project Overview/assets/Azure-Cosmos-DB.svg` stored inside a diagram in another folder) and should not resolve, but the Diagnostics "Missing files" section did not list them.

**Status of the investigation:** the scan path (`collectResourceRefs` → `resources:checkExist` → `resolveLinkPath`) was traced twice by reading and no gap was found; the files are not in this repository, so it was never verified against real data. Either there is a false negative somewhere, or the paths were not actually broken.

**Reopen with** the diagram and a listing of its folder; first confirm the path really does not resolve before touching scan code.

**References:** [ADR 0084](decisions/0084-diagnostics-missing-files.md), `src/main/links/linkPaths.ts`

---

## Dragging a new edge from a node inside a locked container can snap to the container itself

**Status:** Closed, no longer reproduces (2026-10-17)
**Found:** 2026-08-24

**Symptom:** dragging a connection from a shape near its container's edge snapped to the (locked) container instead of passing through it.

**Outcome:** the author reports it no longer happens. Nothing was changed for it on purpose; the likely reason is incidental (the anchor placeholder was removed in 2026-10, which changed what a drop on empty space does). The original hypothesis, never confirmed, was that `locked` maps only to `draggable`/`deletable` and leaves a container's connection handles live. Reopen with exact steps.

---

## "Reverse direction" did nothing visible on a styled edge

**Status:** Solved (2026-09-04, ADR 0083)

**Symptom:** right-click → Reverse direction appeared to do nothing (or showed arrowheads at both ends on an earlier build).

**Cause:** the helper swapped `startMarker` ↔ `endMarker` by value *and* the caller swapped `source`/`target`. Swapping the endpoints already moves the arrowhead, so doing both cancelled out for any edge with an explicit `endMarker`.

**Fix:** one function, `reverseEdgeDirection(edge)`, swaps endpoints and handles, reverses catmull-rom `points`, mirrors a custom `labelPosition`, and does **not** touch markers. It is a byte-for-byte involution.

**Lesson:** a fragment that callers must compose with a manual step invites exactly this double-apply; make the helper do the whole operation.

**References:** `src/renderer/src/edges/edgeDirectionSets.ts`

---

## Hovering a single edge on a large diagram re-renders every node and edge several times over

**Status:** Solved (2026-08-29, ADR 0073), live-confirmed
**Found:** 2026-08-24 on a large diagram (82 nodes, 84 edges)

**Symptom:** marquee-select stuttered; merely hovering an edge produced ~340 `LabeledEdge` and ~280 `EntityNode` renders.

**Cause:** the memoised `DiagramContext` value was stable, but three of the callbacks inside it (`pushSnapshot`, `beginContinuousEdit`, `openDetailsPanel`, and `handleLinkClick`) closed over `nodes`/`edges`, so they changed identity on every array change. Edge hover wrote `edge.data.hovered` into the shared array, which rebuilt those callbacks, which rebuilt the context value, which re-rendered every consumer. Two earlier fixes (stable per-item wrappers, stable `<ReactFlow>` props including `defaultEdgeOptions`, which React Flow reads with an unguarded `useStore`) were real but did not move the numbers.

**Fix:** hover is local `useState` in `LabeledEdge`; the callbacks read a `graphRef` / `rfInstance` / `useEventCallback` instead of closing over state; `onlyRenderVisibleElements` enabled.

**Lesson:** a memoised context value is only as stable as the *callbacks* inside it; look at their dependencies, not just the value's own dependency list. Counting renders from outside has diminishing returns; reading identity chains is faster.

**References:** [ADR 0056](decisions/0056-diagram-context-rerender-performance.md), [ADR 0073](decisions/0073-react-flow-render-performance-round-2.md), `src/renderer/src/canvas/useEventCallback.ts`

---

## A large diagram's edges, selection box, and new-connection dragging all silently failed until node measurement happened to catch up

**Status:** Solved (2026-08-24)

**Symptom:** opening one large file showed no edges, drag-select selected everything, and new connections couldn't be dragged. A blank diagram worked; the console was clean.

**Cause:** React Flow's `EdgeWrapper` silently returns `null` for an edge whose source or target node isn't initialised (`handleBounds` and measured size missing). That measurement normally arrives passively via `ResizeObserver`, and at this scale it sometimes never caught up.

**Fix:** after load, call `updateNodeInternals` for every node, deferred one animation frame so the DOM exists; it measures synchronously.

**References:** `src/renderer/src/canvas/Canvas.tsx` (`loadDiagramIntoCanvas`), `@xyflow/react`'s `EdgeWrapper`

---

## `.react-flow__edgelabel-renderer`'s z-index ceiling went stale, silently breaking edge labels and (new) bend points

**Status:** Solved (2026-08-24)

**Symptom:** a new bend point couldn't be dragged or right-clicked, and edge labels couldn't be added.

**Cause:** the shared label/bend-point portal had `z-index: 5000`, sized against an old ceiling of ~4000. Later work raised real z-indexes to 200,000 (text tier) and added a +1,000,000 boost for a selected edge, so a selected edge painted and hit-tested above the portal and swallowed the clicks.

**Fix:** raised to `2_000_000` with headroom, and the rule's comment now names the source constants (`TEXT_BASE`, `SELECTED_EDGE_Z_BOOST`) and says it is a manually maintained ceiling. First thing to re-check if this class of bug returns.

**References:** [ADR 0030](decisions/0030-edge-label-z-index-override.md), `src/shared/canvas/zIndexOrdering.ts`

---

## `serializeDiagram` silently dropped `locked`, `gravityPresets`, and a line's `points` on every save

**Status:** Solved (2026-08-23; recurred and was fixed again twice)

**Symptom:** a locked shape came back unlocked after save and reload, custom gravity presets reverted, a freeform line lost its points.

**Cause:** `serializeDiagram` rebuilds the object field by field to get a fixed key order, so every field added later has to be added there too, and three were not. The same gap hit `maxConnectionPointsPerSide` (2026-08-31) and `data.references` (2026-09-01, so reference images never survived a save), each found by chance. Live testing missed it because no pass included a save-and-reload round trip.

**Fix:** the missing fields were added. The root cause, the manual picklist, remains; replacing it with spread-and-omit would reorder emitted keys and churn every `.chd` diff, so it needs its own careful pass. A round-trip test over all `examples/*.chd` now guards against losing known fields.

**Lesson:** a new persisted field is not done until a save-and-reload round trip shows it survives.

**References:** `src/shared/diagram/`, `src/shared/savedWith.test.mjs`

---

## A menu bar's hover-switch races its own click handler

**Status:** Solved (2026-08-22)

**Symptom:** clicking a different top-level menu while another was open closed the whole menu bar instead of switching.

**Cause:** the hover-to-switch `onMouseEnter` fires before `click`, so by the time the click handler ran, the clicked menu already looked "open" and its toggle closed it.

**Fix:** a ref remembers the menu that hover just switched to; a click landing on it keeps it open.

**Lesson:** the browser automation's cursor movement did not reproduce real pointer sequences reliably; temporary `console.log` on every `mouseenter`/`click` gave the ground truth.

**References:** [ADR 0039](decisions/0039-top-menu-bar.md), `src/renderer/src/MenuBar.tsx`

---

## Enabling a highlight makes a container look like it shrinks

**Status:** Closed, explained (2026-10-17)

**Symptom:** a highlighted container appears slightly smaller; its actual size is unchanged.

**Explanation (from the code, not measured):** both node types are `box-sizing: border-box` at 100% size, so the outer box cannot change. A highlight raises the border from 1.5px to 3px, and a border-box border grows **inward**, which on a transparent dashed container reads as the box shrinking. If it ever bothers anyone, draw the highlight as an outer ring (`box-shadow`) instead of widening the border.

---

## New-node z-index seeding ignored its own tier scheme

**Status:** Solved (2026-08-22)

**Symptom:** a new container and entity got z-indexes 10 and 20, far below the tier ranges the layer system defines.

**Cause:** `nextZIndex` scoped only containers correctly; entities and text scoped to every node with no tier floor, so a small diagram landed below the tier. The load-time backfill had always been right.

**Fix:** always scope to the node's own type and pass that type's base floor; text now seeds above entities.

**References:** `src/shared/canvas/zIndexOrdering.ts`

---

## React Flow requires `updateNodeInternals()` after dynamically adding a handle

**Status:** Solved (2026-08-20)

**Symptom:** a connection point added at runtime rendered and looked clickable but refused to accept an edge dragged onto it as a target.

**Cause:** React Flow caches handle bounds for connection validation at mount; a handle added later exists in the DOM but not in that cache until `updateNodeInternals(nodeId)` is called.

**Fix:** the add and remove paths call it. **Any feature that adds another kind of dynamic handle must do the same; "it renders" does not mean "it works".**

**References:** `src/renderer/src/nodes/connectionPoints.ts`

---

## Connection point count/spacing model — five-round bug chain

**Status:** Solved (2026-08-21/22)

The richest bug chain so far; the full story is in [ADR 0036](decisions/0036-connection-point-count-and-transfer.md) (five dated revisions). In short:

1. **Spacing overlap:** offsets were computed for the custom points only, ignoring the always-present default at 0.5, so even counts overlapped it and odd counts clustered around it.
2. **Wrong-neighbour edge transfers:** the default point was a separate hard-coded concept outside the array the ordering logic reasoned about. Fixed by putting it in the same per-side array as everything else. **Lesson: a "keep this one element fixed to avoid a bigger rework" compromise on something meant to be uniform becomes exactly where the bugs hide.**
3. **Manual add/remove not re-spacing:** a deliberate "precision tool" choice that looked broken in practice; every structural operation now re-spaces the side.
4. **Bottom and left mirrored:** the re-spacing zipped ascending offsets onto a clockwise-sorted array, wrong on the two sides where clockwise is descending.
5. **Max-per-side bypassed:** the limit was enforced only in the property panel field, not the right-click add path. **Lesson: when a limit needs enforcing, check every entry point that can trigger the guarded action.**

---

## A dragged edge endpoint snapped to the wrong side's point after a count change

**Status:** Closed, cannot reproduce (2026-10-17)
**Found:** 2026-08-22

**Symptom:** after changing a shape's left side from 1 to 2 points, dragging an edge end onto the new left point snapped to the last point on the bottom side. Not reproduced on a second attempt.

**Outcome:** the data path was traced by hand and is correct. The leading theory, `updateNodeInternals` running before React commits the new handle, is ruled out: React Flow's own `useUpdateNodeInternals` (v12.11.3) defers measurement to the next animation frame, after the commit. Never seen again. Reopen with exact steps; first capture the handle ids on both sides.

---

## Layer panel drag-and-drop: ambiguous drop target, then a dead zone

**Status:** Solved (2026-08-21)

**Symptom:** dropping onto a row didn't show which side the item would land on; after adding an insertion line, dropping between rows silently failed.

**Fix:** a visible insertion line computed from the cursor position, and drag-over/drop handled on the whole list container with the slot computed geometrically, since the gaps had no handler at all.

**References:** [ADR 0035](decisions/0035-layer-order-control.md), `src/renderer/src/layers/LayerPanel.tsx`

---

## Edge reconnect-handle "ownership" at a shared connection point isn't decided by z-index

**Status:** Solved (2026-08-22; the first fix on 2026-08-21 was wrong)

**Symptom:** with several edges converging on one connection point, the reconnect handle belonged to the wrong edge regardless of which was selected.

**Cause:** the first theory (DOM order; selected edges moved last in the array) happened to pass one test. Instrumenting `onReconnectStart` and reading React Flow's source showed each edge renders in its **own `<svg style={{ zIndex }}>`**, and `elevateEdgesOnSelect` **defaults to false**, so selection had no effect on z-index. What governed it was the app's own midpoint-of-endpoint-z-index computation.

**Fix:** `zIndexedEdges` adds `SELECTED_EDGE_Z_BOOST = 1_000_000` for a selected edge; the DOM reordering stays as a harmless tie-breaker.

**Lesson:** verify a fix against the real mechanism, not just the one scenario that happened to pass.

**References:** `src/renderer/src/canvas/Canvas.tsx` (`zIndexedEdges`), `@xyflow/react`'s `getElevatedEdgeZIndex`

---

## Theme flip reads as "negative image" on toggle

**Status:** Closed, accepted by design (2026-10-17)

**Explanation:** not a bug. Every explicit colour's lightness is mirrored around one midpoint on each theme change, which reads as a whole-diagram inversion. A contrast-driven approach (adjust only colours with a legibility problem) would avoid it but was rejected in [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md) as more complexity than wanted. That alternative is the documented direction if it becomes a real complaint.

---

## Theme-mirror mechanism: HSV Value isn't hue-blind-safe

**Status:** Solved (2026-08-21)

**Cause:** the first colour flip mirrored HSV Value, which doesn't track perceived brightness across hues (a saturated red reads darker than its V suggests), so some flipped colours were hard to read.

**Fix:** mirror Oklab Lightness instead (`flip(L) = 1 - L`, hue and chroma held).

**References:** [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md), `src/renderer/src/styling/themeAdaptiveColor.ts`

---

## File → Close leaves a stale "this window shows path X" registration

**Status:** Solved (2026-08-22)

**Symptom:** open a file, File → Close, open it again: nothing happens.

**Cause:** `windowsByPath` is updated on page navigation, but File → Close resets the window in place with no navigation, so the registration stayed and "open" just focused the blank window.

**Fix:** a `windows:clearPath` IPC call right after the in-place reset.

**References:** `src/main/windows.ts`

---

## React Flow's post-load auto-measurement was misclassified as a real edit

**Status:** Solved (2026-08-22)

**Symptom:** Close and Reload always asked "changes will be lost", even with no edits.

**Cause:** `onNodesChange` treated a `dimensions` change with `resizing === undefined` as a discrete edit; React Flow's own post-mount measurement emits exactly that. Harmless until `pushSnapshot()` also marked the diagram dirty.

**Fix:** a 500 ms grace window after any load during which that specific change shape doesn't count; every other change type is untouched.

**References:** [ADR 0040](decisions/0040-dirty-tracking-and-autosave-design.md)

---

## Unparented native dialog can open behind the app window

**Status:** Solved (2026-08-22)

**Cause:** the startup orphan-recovery `dialog.showMessageBox` had no owner window, so its z-order lost the race against the initial window taking focus.

**Fix:** the already-created initial window is passed as the owner.

**References:** `src/main/document/recovery.ts`

---

## `registerWindowPath` never cleared a window's own previous entry

**Status:** Solved (2026-08-22)

**Symptom:** drop file1, then file2 with "Open Here", then file1 again: silently ignored.

**Cause:** `windowsByPath` is keyed by path and `registerWindowPath` only added entries, so the stale `file1 → window` survived and the app "focused" the already-focused window. Same class as the Close bug above (a registration never replaced instead of never cleared).

**Fix:** `registerWindowPath` first unregisters the target window's existing entries, so a window has at most one path at the one place entries are added.

**References:** `src/main/windows.ts`

---

## Drop-onto-a-dirty-window prompt was misleading and inconsistent with the close-prompt

**Status:** Solved (2026-08-22)

**Cause:** not a logic bug; the "Open Here" button was identical in the clean and dirty branches, the clean branch had no Cancel, and the dirty branch offered no Save, unlike the close prompt.

**Fix:** every button names its consequence ("Save changes, Open Here" / "Discard changes, Open Here" / "New Window" / "Cancel"), both branches have a real Cancel, the message states the dirty state, and Save reuses the close prompt's `performSaveNow`.

**References:** `src/main/windows.ts` (`openDroppedFileForWindow`)

---

## Highlights panel couldn't grow past a flat 320px cap

**Status:** Solved (2026-08-22)

**Cause:** a static `max-height: 320px`, unrelated to the space available; the scrolling CSS was fine but never exercised until a diagram had 37 highlights.

**Fix:** `maxHeight` computed inline from the space above the panel's anchor; the static cap removed.

---

## Setting `style={{ backgroundColor }}` on `<ReactFlow>` does nothing

**Status:** Solved (2026-08-22)

**Cause:** the `style` prop does land on `.react-flow`, but `<Background>` paints a separate absolutely positioned SVG whose rule reads the **custom property** `--xy-background-color`, not the literal `background-color`.

**Fix:** set `style={{ '--xy-background-color': value }}`.

**Lesson:** several React Flow defaults (edge stroke, node background, handle colour) follow a `var(--xy-*-props, var(--xy-*, var(--xy-*-default)))` chain; check for the custom property before assuming a plain style reaches the paint layer.

**References:** [ADR 0048](decisions/0048-style-palette-and-defaults.md)

---

## A concave line's bounding box was clickable everywhere inside it, not just on the curve

**Status:** Solved (2026-08-22)

**Cause:** React Flow hit-tests a node's rectangular box, and a sparse or concave freeform line's box includes large empty areas.

**Fix:** `pointerEvents: 'none'` on the line node's wrapper through the node's own `style` field (distinct from this app's `data.style`); the line's invisible hit-stroke and its point handles opt back in.

**Lesson:** for any node whose shape doesn't fill its box, `Node.style` is the escape hatch for default box-based hit-testing.

**References:** [ADR 0050](decisions/0050-freeform-line-as-node-type.md), `src/renderer/src/nodes/LineNode.tsx`

---

## `npm run lint` reports ~10,000 CRLF warnings repo-wide

**Status:** Solved (2026-10-17)

**Cause:** Git on Windows has `core.autocrlf=true`, so files are checked out with CRLF, while Prettier's default `endOfLine: lf` flagged every line (21,479 warnings across 103 files).

**Fix:** `endOfLine: auto` in `.prettierrc.yaml`; the 171 genuine formatting differences left were fixed with `eslint --fix` (code only, never the docs) and 8 `react-hooks/exhaustive-deps` warnings by hand. `npm run lint` reports nothing.

---

## Exported PNGs had no visible arrowheads on any edge

**Status:** Solved (2026-08-23)

**Cause:** `EdgeMarkerDefs` renders every `<marker>` in a separate zero-size `<svg>` that is a sibling of `<ReactFlow>`; PNG export clones only `.react-flow__viewport`, so every `marker-end="url(#…)"` pointed at an id that wasn't in the captured content.

**Fix:** the defs svg is tagged `data-export-role="edge-marker-defs"`; `captureDiagramPng` inserts a clone of it into the viewport for the duration of the capture and removes it in a `finally`.

**Lesson:** anything that captures only a subtree must check whether it relies on DOM state that lives outside it.

**References:** [ADR 0051](decisions/0051-png-export.md), `src/renderer/src/export/exportPng.ts`

---

## "Use canvas color" PNG export always exported plain white

**Status:** Solved (2026-08-23)

**Cause:** the code read the custom property `--xy-background-color` directly, but React Flow only *uses* it inside `var()` fallback chains and never assigns it unless a custom colour is set, so the read returned empty and hit the hard-coded `#ffffff`. In light mode with no override the real colour comes from the app's `body` background several ancestors up.

**Fix:** `resolveEffectiveBackgroundColor()` walks up the ancestors reading each one's computed `backgroundColor` until it finds one that isn't transparent.

**Lesson:** a custom property and the standard property that consumes it via `var()` are not interchangeable to read back.

**References:** [ADR 0051](decisions/0051-png-export.md), `src/renderer/src/export/exportPng.ts`

---

## Adding a new required tag immediately stamps its placeholder key onto every element, then demotes it to a stray free tag on rename

**Status:** Solved (2026-09-15)

**Symptom:** after "Add required tag" and renaming the key, every element kept a stray free tag called `key` (or `key (demoted)`). Removal of a still-default-named tag did the same.

**Cause:** `addTag()` committed `{ key: 'key', … }` immediately, unlike every other field in the panel, which drafts and commits on blur; `syncElementMetadata` backfilled `"key"` onto every element, and its "demote, don't delete" rule then preserved it.

**Fix:** a new tag starts with a blank key and `seedMetadata`/`syncElementMetadata` skip entries with an empty key, so nothing is stamped until the tag is named. No key-name heuristics.

**References:** [ADR 0022](decisions/0022-unified-tag-and-metadata-system.md), `src/renderer/src/tagging/RequiredTagsSection.tsx`

---

## Pasting a copied child-of-a-container node can land it far off screen

**Status:** Solved (ADR 0075, 2026-08-30)

**Cause:** a child's `position` is relative to its parent, but `remapForPaste` applied absolute centroid math to it and never touched `parentId`: a child pasted without its container kept a dangling reference, and one pasted with it still pointed at the old id.

**Fix:** if the parent is in the payload, `parentId` is remapped through the same id map and the relative position is kept; otherwise `parentId` is stripped and the node pastes top-level. The centroid uses top-level nodes only, and a load-time `healHierarchy` pass drops dangling `parentId`s from files saved in this state. Copy/paste with containers confirmed working by the author (2026-10-17).

**References:** [ADR 0075](decisions/0075-container-hierarchy-integrity.md), [ADR 0049](decisions/0049-clipboard-copy-paste.md), `src/renderer/src/canvas/clipboard.ts`

---

## "Attach contained entities" can fling a node to the canvas origin

**Status:** Solved, confirmed live (2026-10-17)

**Cause:** the candidate filter could pick a node that is the container's own *parent* (it fully contains the container), creating a parent cycle; React Flow then reads an unpositioned parent as `{0,0}` and collapses the node to the origin. The drag-to-reparent path already had an ancestry check.

**Fix:** reject ancestors of the container and any candidate whose bounds enclose it ([ADR 0075](decisions/0075-container-hierarchy-integrity.md)).

---

## Icon picker's grid overflowed horizontally, not just missing a vertical scrollbar gutter

**Status:** Solved (2026-08-25)

**Symptom:** the rightmost icon column looked covered, with a horizontal scrollbar.

**Cause:** a grid item's default `min-width: auto` includes its content's intrinsic size (each button holds a raw SVG), so the six `1fr` columns couldn't shrink below it. With only `overflow-y` set, CSS computes `overflow-x` to `auto` too. A first fix (`scrollbar-gutter: stable`) addressed a plausible cause and was never verified.

**Fix:** `min-width: 0` on `.icon-picker-grid button` and `overflow-x: hidden` on the scroll container.

**Lesson:** grid/flex items holding images or SVGs resist shrinking unless `min-width: 0` is set. When a fix can't be seen in the Electron renderer, a static reproduction served through the dev server (not a bare `file://` URL) gives real measurements.

---

## Deleting / cutting a container + its selected children removes only the container, keeps the children

**Status:** Solved (2026-10-17, [ADR 0116](decisions/0116-deleting-a-container-and-its-selected-children.md)), pending live test

**Cause:** deleting a container promotes its children (ADR 0012), and the rule filtered out the removal of any descendant of a removed container even when the child was explicitly selected too.

**Fix:** decided with the author: promote when only the container is selected, delete everything selected otherwise (`resolveDeletion` in `onBeforeDelete`, unit-tested). Also fixed in the same cascade: unwrapping a container used to delete the edges of the children it promoted. To check live: delete only a container (children and their edges stay); select everything and delete; `Ctrl+X` the same.

---

## Copy/paste doesn't preserve container relationships

**Status:** Solved (confirmed by the author 2026-10-17)

Fixed by the paste rework described under "Pasting a copied child-of-a-container node can land it far off screen". Not addressed and left as is: selecting a container and copying copies only the container, because `buildClipboardPayload` copies only selected nodes.

---

## PNG-exported arrowheads were invisible on any edge relying on this app's own `context-stroke` markers

**Status:** Solved (2026-09-15)

**Symptom:** an edge without an explicit stroke exported to PNG with an invisible arrowhead; on screen it was fine. A first fix (pointing `markerEnd` at the app's own marker instead of React Flow's grey one) was a real bug but did not fix the report.

**Cause:** `context-fill`/`context-stroke` (so one marker can serve any edge colour) don't survive `html-to-image`, and an unstyled edge's colour comes from a CSS custom-property chain that is also fragile there; an edge with an explicit inline stroke exported correctly, which was the decisive clue.

**Fix:** `resolveMarkersForExport` runs for the duration of the capture: for each element referencing one of the app's markers it reads the element's already-resolved computed `stroke` and repoints it at a clone of the marker with that literal colour, restoring everything in `finally`. Live rendering is untouched.

**Lesson:** in this export path, treat anything resolved indirectly (CSS variables, paint-context keywords) as suspect even when it works on screen; use literal, already-resolved values.

**References:** [ADR 0014](decisions/0014-node-and-edge-style-schema.md), `src/renderer/src/export/exportPng.ts`

---

## Search couldn't find text in a note that had never been saved to disk

**Status:** Solved (2026-09-23)

**Cause:** `elementMatchesViaDetails` gates on the node's stored details path, but a brand-new note has no path until its first save even though its text already exists in the renderer's in-memory shadow, so it looked like "no note".

**Fix:** `computeMatchIds` sets a truthy placeholder `details` whenever a live shadow exists for the node. "Deep search" being greyed out in the same session was unrelated and by design (it needs a saved path). Also noted in the same pass: `src/main/details/details.ts` joined paths itself instead of using the shared `resolveLinkPath`; fixed there, with a milder gap in `icons.ts`/`references.ts` left for later.

**References:** [ADR 0097](decisions/0097-deep-search-across-linked-diagrams.md), `src/shared/search/search.ts`

---

## Save could copy and delete files outside the diagram's folder, driven by a path in a shared `.chd`

**Status:** Solved (found 2026-10-17, during the pre-release security pass; not exploited anywhere)

**Symptom (found by reading, then reproduced with failing tests):** a node's `details` path is plain text. If it was `../../Documents/report.docx`, the next Save treated the note as "renamed", copied that file into the notes folder, then deleted the original.

**Cause:** the multi-file save executor joined stored paths onto the diagram's folder with `join()`, which resolves `..`; nothing checked containment.

**Fix:** `containedPath()` refuses absolute paths, climbing `..` and drive-relative or stream paths on Windows; `executeSave` uses it for every copy-from, write and delete. Read-only handlers were left alone (they only display content, and the app is offline).

**Precedent:** any code that writes, copies from or deletes a path read out of a file must contain it. Not covered: symbolic links inside the folder that point outside.

**References:** [ADR 0115](decisions/0115-paths-stored-in-diagrams-are-untrusted.md), `src/main/containedPath.ts`

---

## A link in a note navigated the app window to a remote page that had the file-access API

**Status:** Solved (found 2026-10-16, same pass)

**Cause:** the details panel renders Markdown links as plain anchors, and the app window has `window.api` (file access over IPC) exposed by its preload; dropping a file onto the window had the same shape.

**Fix:** a navigation guard cancels any navigation away from the app's page and hands web and mail links to the user's browser; the preload is sandboxed and no longer exposes generic IPC ([ADR 0112](decisions/0112-electron-hardening-sandbox-and-navigation.md)).

---

## The app resolved the host `wpad` on every start, with no request of its own

**Status:** Solved (found 2026-10-16, same pass)

**Cause:** Chromium's proxy auto-detection runs at startup by default; a grep for network calls could never have found it.

**Fix:** the `no-proxy-server` switch, a session policy cancelling every non-local request, and a test that fails if a network API enters the code ([ADR 0113](decisions/0113-enforced-offline-behaviour.md)). To re-measure: run the app with `--log-net-log=<file> --net-log-capture-mode=Everything` and look for `"url"` or `"host"` entries.

---

## Property panel shows blank fields for style values that are unset

**Status:** Solved (2026-10-17, ADR 0117), verified in the packaged app

**Symptom:** an element with no explicit style showed empty colour, width and font fields, as if it had no colour or border.

**Cause:** the panel read only the stored style; the built-in default look lived in CSS and in constants inside the edge component, where the panel could not see it.

**Fix:** the built-in default look is now data ([ADR 0117](decisions/0117-built-in-style-defaults-are-data.md)), read by the panel, by the CSS through generated custom properties, and by the edge and line components. The drawn look is unchanged (51 of 52 measured properties identical, the 52nd a flaw in the old baseline).

---

## A pasted element landed to the right of centre, by roughly half its size plus the dock

**Status:** Solved (2026-10-17), measured in the running app

**Cause, three stacking effects:** `remapForPaste` put the group's top-left corner on the paste point instead of centring it (off by half the element's size); the paste point was the centre of the whole window rather than of the canvas, which is narrower because of the dock; and a paste selects its result, which swaps the narrow palette dock (96 px) for the properties panel (260 px) and shrinks the canvas from the right.

**Fix:** `remapForPaste` centres the group's bounding box; the point is the centre of the canvas as it will be with the properties panel open (`visibleCanvasCenter`, reading the width from `--dock-properties-width`). Measured in the packaged build: offset 0, 0.

**References:** `src/renderer/src/canvas/clipboard.ts`, `src/renderer/src/canvas/Canvas.tsx` (`visibleCanvasCenter`)
