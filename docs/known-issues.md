# Known issues and challenges

A running log of real bugs and hard problems found during development — not a bug tracker for open work (that's `docs/planning/epics/`), but a lookup table: if something looks familiar, check here first before re-diagnosing it from scratch. Each entry captures the symptom, the actual root cause (often not what it looked like at first), and how it was resolved or why it's still open.

Add an entry whenever a bug takes real investigation to track down, or a design turns out to have a real, recurring class of failure — not for routine typos/typechecks caught immediately. Keep entries even after they're solved; the value here is precedent, not a to-do list.

## Status legend

- **Solved** — root cause fixed, shouldn't recur.
- **Worked around** — mitigated or narrowly patched, but the underlying cause is still there; a broader version of the problem could resurface.
- **Open** — known, not blocking, deliberately not fixed yet. Has a documented direction to revisit if it becomes a real complaint.

## Open items at a glance

- [Diagnostics "missing files" check didn't flag a reported broken relative path in real diagram data](#diagnostics-missing-files-check-didnt-flag-a-reported-broken-relative-path-in-real-diagram-data) — Open, reported once, not reproduced/confirmed.
- [Dragging a new edge from a node inside a locked container can snap to the container itself](#dragging-a-new-edge-from-a-node-inside-a-locked-container-can-snap-to-the-container-itself) — Open, not investigated.
- [Hovering a single edge on a large diagram re-renders every node and edge several times over](#hovering-a-single-edge-on-a-large-diagram-re-renders-every-node-and-edge-several-times-over) — Solved, ADR 0073 / epic 0101.
- [A large diagram's edges, selection box, and new-connection dragging all silently failed until node measurement happened to catch up](#a-large-diagrams-edges-selection-box-and-new-connection-dragging-all-silently-failed-until-node-measurement-happened-to-catch-up) — Solved.
- [`.react-flow__edgelabel-renderer`'s z-index ceiling went stale, silently breaking edge labels and (new) bend points](#react-flowedgelabel-rendereres-z-index-ceiling-went-stale-silently-breaking-edge-labels-and-new-bend-points) — Solved.
- [`serializeDiagram` silently dropped `locked`, `gravityPresets`, and a line's `points` on every save](#serializediagram-silently-dropped-locked-gravitypresets-and-a-lines-points-on-every-save) — Solved (+ 4th `maxConnectionPointsPerSide` 2026-08-31, + 5th `data.references` 2026-09-01).
- [Theme flip reads as "negative image" on toggle](#theme-flip-reads-as-negative-image-on-toggle) — Open, not urgent.
- [Enabling a highlight makes a container look like it shrinks](#enabling-a-highlight-makes-a-container-look-like-it-shrinks) — Open, not investigated.
- [A dragged edge endpoint snapped to the wrong side's point after a count change](#a-dragged-edge-endpoint-snapped-to-the-wrong-sides-point-after-a-count-change) — Open, not reproduced.
- [A native confirm() dialog left <select> elements unresponsive afterward](#a-native-confirm-dialog-left-select-elements-unresponsive-afterward) — Worked around, class of bug could recur.
- [`npm run lint` reports ~10,000 CRLF warnings repo-wide](#npm-run-lint-reports-10000-crlf-warnings-repo-wide) — Open, not this machine's normal experience, cause not confirmed.
- [Exported PNGs had no visible arrowheads on any edge](#exported-pngs-had-no-visible-arrowheads-on-any-edge) — Solved.
- ["Use canvas color" PNG export always exported plain white](#use-canvas-color-png-export-always-exported-plain-white) — Solved.
- [Adding a new required tag immediately stamps its placeholder key onto every element, then demotes it to a stray free tag on rename](#adding-a-new-required-tag-immediately-stamps-its-placeholder-key-onto-every-element-then-demotes-it-to-a-stray-free-tag-on-rename) — Open, root cause understood, not fixed.
- [Pasting a copied child-of-a-container node can land it far off screen](#pasting-a-copied-child-of-a-container-node-can-land-it-far-off-screen) — Solved (ADR 0075 / epic 0103), pending live test.
- [Clicking a container selects a different container that visually encloses it](#clicking-a-container-selects-a-different-container-that-visually-encloses-it) — Worked around (ADR 0075 / epic 0103) — the z-inversion is a React Flow invariant; surfaced via Diagnostics + a Layers-panel marker. Pending live test.
- ["Attach contained shapes" can fling a node to the canvas origin](#attach-contained-shapes-can-fling-a-node-to-the-canvas-origin) — Solved (ADR 0075 / epic 0103), pending live test.
- [Icon picker's grid overflowed horizontally, not just missing a vertical scrollbar gutter](#icon-pickers-grid-overflowed-horizontally-not-just-missing-a-vertical-scrollbar-gutter) — Solved.
- [Deleting / cutting a container + its selected children removes only the container, keeps the children](#deleting--cutting-a-container--its-selected-children-removes-only-the-container-keeps-the-children) — Open, deliberately not fixed (user wants a decision later).
- [Copy/paste doesn't preserve container relationships](#copypaste-doesnt-preserve-container-relationships) — Open; ADR 0075 / epic 0103 reworked `remapForPaste` for exactly this, unmerged — retest after merge.
- ["Reverse direction" did nothing visible on a styled edge (and showed arrows on both ends before that)](#reverse-direction-did-nothing-visible-on-a-styled-edge) — Solved (ADR 0083 / epic 0106).

---

## Diagnostics "missing files" check didn't flag a reported broken relative path in real diagram data

**Status:** Open, reported once, not reproduced or confirmed
**Found:** 2026-09-04, user report while live-testing epic 0108 (Diagnostics — missing files) on the same `epic/0108-diagnostics-broken-links` branch it shipped on

**Symptom:** the user's real "Project Overview" project (used elsewhere as the source of epic 0103's `parentId`-drift bugs) has a `Service platform.chd` diagram whose nodes carry `icons[slot].path`/`details`/`linkedDiagram` values that look like they were copy-pasted in from a sibling diagram (`Project Overview.chd`) without the paths being adjusted for the new file's own directory — e.g. an icon path of `"Project Overview/assets/Azure-Cosmos-DB.svg"` stored *inside* `Service platform.chd`, which per `docs/file-format.md`'s "relative to the diagram file's own directory" rule should resolve to a nonexistent, doubled-up path. Opening this diagram in-app and checking the Diagnostics panel's "Missing files" section (including after Recheck) did **not** report any of these as missing.

**What's confirmed vs. not:** code-read only, not verified against the actual files (they live outside this repo, on the user's own disk — not shared this session). Traced the whole scan path — `collectResourceRefs` (`Canvas.tsx`) → `resources:checkExist` IPC (`main/links.ts`) → `resolveLinkPath` (`main/linkPaths.ts`) — and it appears to correctly cover all four resource kinds (`linkedDiagram`, custom `icon`, `reference`, `details`) and to resolve exactly per the documented rule; no gap found by reading the code alone. That leaves two live possibilities, neither ruled out: (a) a genuine false-negative somewhere in the scan/check path that code-reading didn't surface, or (b) the specific paths in this file aren't actually broken the way they first looked (the "doubled path" read came from inferring the resolution rule against a directory listing, not from confirming inside the running app).

**Why logged instead of chased:** reported once, not reproduced on a second look, and the underlying "does paste corrupt resource paths" question it was raised alongside was addressed separately (see the paste-time retarget fix below, `src/renderer/src/clipboard.ts`'s `retargetResourcePath`/`retargetNodeData`) — logging this now means the next time Diagnostics looks like it's missed something, this is the first place to check instead of re-diagnosing from scratch.

**If revisited:** get the actual file — either the real directory (so `resolveLinkPath`'s output can be checked against a real `fs.access` call), or at minimum the exact `data.icons`/`data.details`/`data.linkedDiagram` values of the specific node plus a directory listing of what's actually sitting next to `Service platform.chd`. Confirm first whether the path is *actually* unresolved (settles (a) vs (b) above) before touching any scan code.

**References:** `src/renderer/src/Canvas.tsx`'s `collectResourceRefs`/`scanMissingFiles`, `src/main/links.ts`'s `resources:checkExist` handler, `src/main/linkPaths.ts`'s `resolveLinkPath`, [ADR 0084](decisions/0084-diagnostics-missing-files.md), [epic 0108](planning/epics/0108-diagnostics-missing-files.md)

---

## Dragging a new edge from a node inside a locked container can snap to the container itself

**Status:** Open, not investigated
**Found:** 2026-08-24, live use by the user, reported to be logged rather than fixed immediately

**Symptom:** dragging a new connection from a shape that sits inside a container, near the container's own edge, snaps/connects to the _container_ rather than passing through it — even when that container is locked. Dropping the connection there then pops up the "what do you want to create" prompt (the void-drop AnchorNode flow, `spawnAnchorAt`/`resolveAnchorNode`, epic 0014) rather than behaving as a normal connection or a clean drop onto empty canvas. The user's expectation: a locked container should be completely transparent to this interaction, "as if it was not there."

**Not yet investigated**, but a likely starting point: `locked` (`data.locked`, `deriveNodeFields` in `Canvas.tsx`) only ever maps onto React Flow's `draggable`/`deletable` node overrides — `selectable` and, implicitly, connectability are deliberately left untouched (see that function's own comment: "the whole point was blocking accidental drags/deletes while keeping selection/highlighting working normally"). That was a deliberate choice for _selection_, but connection-drag snapping was never considered against it — a locked container's own connection-point handles are plausibly just as live as an unlocked one's, which would fully explain this symptom without needing anything container-specific or z-index-related.

**If revisited**: check whether the same snap happens near an _unlocked_ container too (isolates whether this is really about `locked` specifically, or a more general "a container's own handles are too eager to claim a nearby connection drag" issue that locked state happens to make more noticeable). If it's confirmed to be about `locked` specifically, the fix is likely making connection validation (`isValidConnection` or equivalent) reject a locked node the same way dragging/deleting it already does.

**References:** `src/renderer/src/Canvas.tsx`'s `deriveNodeFields`, `spawnAnchorAt`/`resolveAnchorNode` (epic 0014's void-drop flow), `src/renderer/src/nodes/ContainerNode.tsx`

---

## "Reverse direction" did nothing visible on a styled edge

**Status:** Solved (ADR 0083 / epic 0106)
**Found:** 2026-09-04, user live-testing edge direction sets with per-set styles

**Symptom:** right-clicking an edge → "Reverse direction" appeared to do nothing. On an earlier build it instead showed an arrowhead at *both* ends. Switching edge direction sets in a way that flipped an edge had the same problem.

**Root cause:** `flipEdgeVisuals` (the old helper in `edges/edgeDirectionSets.ts`, shared by "Reverse direction" and a set switch) returned only the visual touch-ups and swapped `style.startMarker` ↔ `style.endMarker` *by value*; each caller then separately swapped the edge's `source`/`target`. But that endpoint swap alone already relocates the visible arrowhead — an `endMarker` renders at `target`, a `startMarker` at `source`, so trading the endpoints moves a target-anchored arrow to the other end. Doing both cancels out: a one-arrow edge stays a one-arrow edge on the *same physical end* → visual no-op. (Before the interim `undefined`→`'none'` patch, the swapped `endMarker: undefined` also fell through to React Flow's default end arrow in `LabeledEdge`, so you got arrows on both ends.) Latent since "Reverse direction" shipped (epic 0084, never live-tested); plain edges with an empty `style` happened to work because RF's default arrow just follows `target`. Epic 0106 made it the common case by seeding new edges with an explicit `endMarker` from the active direction set.

**Fix:** the helper was also mis-factored — a fragment callers had to compose with a manual endpoint swap, which is how "also swap the markers" crept in. Replaced with **`reverseEdgeDirection(edge): Edge`** — one function that reverses the whole edge: swap the endpoints (+ handles), reverse the catmull-rom `points` order, mirror a custom `labelPosition`. **Markers are not touched** — the endpoint swap moves them by itself. The "Reverse direction" menu action calls it directly; `applyDirectionToEdge` calls it for the flip case then overrides endpoints/handles from the stored record. A clean byte-for-byte involution.

**References:** `reverseEdgeDirection` / `applyDirectionToEdge` in `src/renderer/src/edges/edgeDirectionSets.ts`, the "Reverse direction" handler in `Canvas.tsx`, `LabeledEdge`'s `computedMarkerEnd`/`computedMarkerStart`

---

## Hovering a single edge on a large diagram re-renders every node and edge several times over

**Status:** Solved (2026-08-29, ADR 0073 / epic 0101), live-confirmed by the user — the whole diagram now "feels smooth as hell" for hover, marquee-select and colour drags, with no regressions found
**Found:** 2026-08-24, live use by the user on the Meridian Rail landscape (82 nodes, 84 edges), while live-testing the fix for the entry below

**Symptom:** on this large diagram, drag-to-select noticeably stutters (~300ms) every time the selection boundary crosses in or out of an item. Isolated further via live `console.count` instrumentation in `ShapeNode`/`LabeledEdge` (same technique as the epic 0067/ADR 0056 investigation): merely **hovering one edge and moving off** — no click, no selection, from a fully-settled diagram — produced ~340 `LabeledEdge` renders and ~280 `ShapeNode` renders (roughly 4 and 3.4 per element, for what should be a change affecting exactly one edge). Reproduced identically across multiple clean restarts (all `electron.exe`/`node.exe` processes killed each time), ruling out stale HMR/caching.

**Two real, confirmed contributing causes found and fixed** (`src/renderer/src/Canvas.tsx`), but fixing both changed the render counts by roughly 0% — something else, not yet identified, dominates:

1. `zIndexedNodes`/`zIndexedEdges` were rebuilt as fresh wrapper objects for _every_ node/edge on _every_ render, regardless of whether that item had actually changed — this also directly caused the separate bug in the entry below (React Flow's `adoptUserNodes` only reuses a node's cached measurement when the _exact same_ object is passed back). Replaced with an effect that materializes the derived fields (`zIndex`/`draggable`/`deletable`/edge `hovered`) directly onto `nodes`/`edges` state, only replacing the specific items that changed — see `deriveNodeFields`/`deriveEdgeFields` (module scope) and their call sites. Written as a "read during render, write only from an effect" pattern specifically because this repo's react-compiler ESLint rule (enforced as an error) disallows reading _or_ writing a ref's `.current` during render, which ruled out the more obvious manual-cache approach tried first.
2. `onEdgeMouseEnter`/`onEdgeMouseLeave`/`defaultEdgeOptions` were passed to `<ReactFlow>` as inline arrow functions/object literals, recreated on every render. `defaultEdgeOptions` in particular is read by React Flow's own `EdgeWrapper` via a _separate, unguarded_ `useStore(s => s.defaultEdgeOptions)` call with no equality check — a fresh reference there forces every edge to re-render regardless of whether `nodes`/`edges` themselves changed. Fixed: `onEdgeMouseEnter`/`onEdgeMouseLeave` are now `useCallback`-stable, `defaultEdgeOptions` is a static module-level constant (it never depended on any state).

**Not yet found:** after both fixes, a clean-restart retest produced render counts within noise of the original (340/280 → still ~338-340/~280). Whatever is forcing _every_ node and edge to re-render from a single edge's hover state is still active. `NodeWrapper` (`@xyflow/react`) has only one `useStore` call, correctly using `shallow` comparison, unlike `EdgeWrapper`'s extra unguarded one — so nodes re-rendering in lockstep with edges, from a change that only touches `hoveredEdgeId`/one edge's data, doesn't fit either mechanism found so far. `DiagramContext`'s value is confirmed properly memoized (no selection/hover-related dependencies) via ADR 0056's existing fix, so it's very likely not the shared cause either. Ruled out as _not_ the cause: React Flow's own reference-preserving `applyChanges`/`adoptUserNodes` (confirmed correct by reading `@xyflow/system`'s source), stale caching/HMR (reproduced fresh every time), and `DiagramContext` re-render cascade (already fixed in epic 0067, deps checked again here).

**If revisited:** the user made the call to stop here rather than continue via `console.count` instrumentation, given several rounds already produced fixes that didn't move the actual numbers — diminishing returns on this technique for this specific problem. The recommended next step is the **React DevTools Profiler**, attached to the Electron renderer, which can show _why_ a given render happened (props/state/context/parent) instead of just _that_ it happened — a fundamentally more precise tool for this class of problem than counting renders from the outside.

**2026-08-29 — root-caused and fixed (ADR 0073 / epic 0101), by code reading rather than the profiler.** The prior round's "`DiagramContext`'s value is confirmed properly memoized (no selection/hover-related dependencies)" was the miss: the memoized value's own dependency list looked clean, but three of the _callbacks_ in it — `pushSnapshot`, `beginContinuousEdit`, `openDetailsPanel` (and `handleLinkClick`) — closed over `nodes`/`edges` and so were rebuilt whenever either array changed. Edge hover wrote `edge.data.hovered` via a `setEdges` effect → new `edges` array → new `pushSnapshot`/`openDetailsPanel` identities → new `diagramContextValue` identity → every `useContext` consumer (every node and edge) re-rendered, which is exactly why nodes re-rendered in lockstep with edges from a pure hover. Fixes: (1) hover is now per-edge local `useState` in `LabeledEdge`, never touching the shared array; (2) those callbacks read a `graphRef` / `rfInstance.getNode` / a new `useEventCallback` wrapper instead of closing over state, so `diagramContextValue` keeps a stable identity across edits. Also enabled `onlyRenderVisibleElements` (viewport culling). **Live-confirmed by the user**: hover, marquee-select and colour drags on the Meridian Rail landscape are all smooth, no regressions found (PNG export of an oversized diagram, reconnect handles, undo/redo, container delete, etc. all still work). The React DevTools Profiler round and a state-store refactor were both left unused — not needed once the callback-identity cause was found.

**References:** `src/renderer/src/Canvas.tsx` (`graphRef`, `pushSnapshot`, `openDetailsPanel`, `deriveEdgeFields`, `onlyRenderVisibleElements`), `src/renderer/src/edges/LabeledEdge.tsx` (local `hovered` state), `src/renderer/src/hooks/useEventCallback.ts`, `node_modules/@xyflow/react`'s `NodeWrapper`/`EdgeWrapper`, [ADR 0056](decisions/0056-diagram-context-rerender-performance.md) and [ADR 0073](decisions/0073-react-flow-render-performance-round-2.md), `examples/gallery/landscape/meridian-rail-landscape.chd`

---

## A large diagram's edges, selection box, and new-connection dragging all silently failed until node measurement happened to catch up

**Status:** Solved
**Found:** 2026-08-24, live use by the user opening the Meridian Rail landscape (82 nodes, 84 edges — the largest diagram in the gallery) on both `epic/0032-edge-routing-and-waypoints` and `master`

**Symptom:** opening this one file — and only this file — showed zero edges: no arrows, nothing selectable, no highlighting, right from the first paint. Separately, drag-to-select selected every element regardless of how small the drag box was or where it was drawn, and dragging a new connection between two existing shapes didn't work either. A brand-new blank diagram worked perfectly for all three. Console was clean throughout — no errors, no warnings. Reproduced after a fully clean restart (all `electron.exe`/`node.exe` processes killed, `node_modules/.vite` deleted), on both branches, ruling out every caching theory tried first (Vite dev-server cache, a stale Electron process, a stale crash-recovery snapshot — the recovery folder was confirmed empty).

**Root cause:** confirmed by temporarily instrumenting `loadDiagramIntoCanvas`, the `zIndexedEdges` computation, and `LabeledEdge`'s render (same live `console.log`/`console.count` technique as this log's other hard bugs) rather than guessing. `edges` state genuinely held all 84 edges immediately after load, and 84 were being passed to `<ReactFlow edges={...}>` — but `LabeledEdge` was only ever invoked for roughly half of them. Reading `@xyflow/react`'s own source (`EdgeWrapper`) found the mechanism: it silently returns `null` — no warning, no error — for any edge whose source or target node isn't yet "initialized," which specifically means `node.internals.handleBounds` and `node.measured.width/height` aren't populated yet in React Flow's own internal store. That measurement is normally driven passively by a `ResizeObserver` per node after mount, converging over an unpredictable number of render passes — usually fast enough to be invisible, but at this diagram's scale (82 nodes, several with 10+ connection-point handles) it sometimes never fully caught up on its own. The same missing/incomplete `nodeLookup` data plausibly explains the other two symptoms too (rubber-band selection and new-connection dragging both depend on the same internal node/handle bounds) — not separately root-caused, but a single underlying cause was sufficient to explain all three, and fixing it resolved all three together.

**Resolution:** `loadDiagramIntoCanvas` now calls React Flow's `updateNodeInternals` for every just-loaded node, deferred one animation frame (so the nodes' DOM elements — found by `data-id`, which `updateNodeInternals` queries for directly — actually exist by the time it runs). Unlike the passive `ResizeObserver` path, `updateNodeInternals` measures a node's handle bounds and dimensions synchronously via direct `getBoundingClientRect()` reads (confirmed by reading `@xyflow/system`'s own implementation), so every node's internal state is populated in one deterministic pass right after load instead of racing. Live-confirmed by the user: edges render immediately with no wait, drag-to-select behaves correctly, and new connections can be dragged, all on the first open of the same large file.

**References:** `src/renderer/src/Canvas.tsx`'s `loadDiagramIntoCanvas`, `node_modules/@xyflow/react`'s `EdgeWrapper`/`isNodeInitialized`, `node_modules/@xyflow/system`'s `updateNodeInternals`, `examples/gallery/landscape/meridian-rail-landscape.chd`

---

## `.react-flow__edgelabel-renderer`'s z-index ceiling went stale, silently breaking edge labels and (new) bend points

**Status:** Solved
**Found:** 2026-08-24, live use by the user testing epic 0032's new catmull-rom edge bend points

**Symptom:** a newly-added bend point on a catmull-rom-routed edge rendered correctly (right position, curve bent correctly) but couldn't be interacted with at all — no drag, no right-click menu, no hover response. Separately, and apparently unrelated at first: the user also reported having "lost the ability to add a label to an edge" — an existing, long-shipped feature (epic 0012), not something epic 0032 touched.

**Root cause:** both symptoms were the same bug. `main.css`'s `.react-flow__edgelabel-renderer` rule (the shared portal React Flow's `<EdgeLabelRenderer>` renders every edge's label — and, as of epic 0032, every catmull-rom edge's bend-point handles — into) sets an explicit `z-index` specifically so it always paints and hit-tests above the edges/nodes it visually overlaps; without it, epic 0042 found labels painting behind their own selected edge. That value was `5000`, sized in epic 0042 against a documented ceiling of ~4000 ("2000 node z-index + up to ~2000 more from selection elevation"). Two later epics silently invalidated that ceiling without anyone revisiting this comment: epic 0043/ADR 0035's real z-index tiers (`zIndexOrdering.ts`) go up to `TEXT_BASE = 200_000`, and epic 0046's `SELECTED_EDGE_Z_BOOST` (`Canvas.tsx`) adds `1_000_000` on top for a selected edge — a real ceiling of 1,200,000+, roughly 240× higher than the CSS assumed. Any edge in that range (in practice: any _selected_ edge, which is exactly the state a user is in right after clicking one to add a point or edit its label) painted and hit-tested above the shared portal, silently swallowing every click meant for a label or bend point. Confirmed by reading `@xyflow/react`'s own bundled source (`EdgeLabelRenderer` portals to a plain, unstyled `<div className="react-flow__edgelabel-renderer">` with no z-index of its own) and cross-referencing the actual current constants, not by guessing.

**Resolution:** raised the CSS z-index to `2_000_000` — comfortably above the real current ceiling, with real headroom rather than an exact-fit value (the same mistake that let this go stale once already). The rule's own comment now names the actual source constants (`TEXT_BASE`, `SELECTED_EDGE_Z_BOOST`) instead of a plain number, and flags itself as a manually-maintained ceiling nothing re-checks automatically — the first thing to re-verify if this class of bug ever resurfaces.

**References:** `src/renderer/src/assets/main.css`'s `.react-flow__edgelabel-renderer`, `src/renderer/src/layers/zIndexOrdering.ts`, `src/renderer/src/Canvas.tsx`'s `SELECTED_EDGE_Z_BOOST`, [epic 0032](planning/epics/completed/0032-edge-routing-and-waypoints.md), [ADR 0030](decisions/0030-edge-label-z-index-override.md) (the original epic 0042 fix this value came from).

---

## `serializeDiagram` silently dropped `locked`, `gravityPresets`, and a line's `points` on every save

**Status:** Solved
**Found:** 2026-08-23, while reading `src/shared/diagram.ts` in preparation for epic 0032's edge/line unification (unrelated task — noticed by chance while re-reading the save path to see what shape it currently writes)

**Symptom:** none reported by the user before this was found by code inspection — the actual user-visible symptom, confirmed by tracing the code rather than reproduced live, would be: lock a shape, save, reopen the file — the shape comes back unlocked. Set custom gravity presets (`GravityPresetsPanel`), save, reopen — back to this app's built-in four. Draw a freeform line (epic 0064) with any bend points, save, reopen — the line comes back with `data.points` missing entirely, i.e. invisible (`LineNode` renders nothing for an empty point list).

**Root cause:** `src/main/diagram.ts`'s `diagram:save` IPC handler — the one real `.chd` write path (confirmed: `links.ts`/`requiredTags.ts` are the only other callers of `serializeDiagram`, and `recovery.ts`'s crash-recovery envelopes are a separate, unrelated JSON format) — calls `serializeDiagram`, which rebuilds a fresh, deliberately-key-ordered object from the in-memory `DiagramFile` rather than passing it through directly (see that function's own comment: fixed key order makes `JSON.stringify` output deterministic for git diffs). That rebuild is a manual field-by-field picklist, and three fields added by later epics were never added to it: `DiagramFile.gravityPresets` (epic 0064) and, per node, `locked` (epic 0043) and `data.points` (epic 0064). `parseDiagram`/`fromDiagramFile` (the read side) never had an equivalent gap — `toDiagramFile` (`Canvas.tsx`, the in-memory → `DiagramFile` step that runs _before_ `serializeDiagram`) already builds these fields correctly; `serializeDiagram`'s own re-pick on top of that correct object is what silently discards them again on the way to disk.

**Why epic 0064's own live-testing didn't catch this:** both live-testing passes (see epic 0064's Notes) covered hit-testing and the Layers panel within a single running session — a save/reload round-trip specifically wasn't part of either pass.

**Resolution:** added the three missing fields to `serializeDiagram`'s picklist, same "omit only when empty" convention already used for every sibling field in that function (`gravityPresets: ... .length > 0 ? ... : undefined`, `locked: n.locked`, `data.points: ... .length > 0 ? ... : undefined`).

**2026-08-31 — a fourth instance of the same gap, found the same way:** `DiagramFile.maxConnectionPointsPerSide` (epic 0073's per-diagram override) was also missing from `serializeDiagram`'s picklist, so a diagram-level max-connection-points override never survived a save/reload — it was written into the in-memory `DiagramFile` by `toDiagramFile` and then dropped again on serialize, exactly like the three above. Found while adding `edgeDirectionSets` fields to the same function for epic 0089. Fixed with the same one-liner (`maxConnectionPointsPerSide: diagram.maxConnectionPointsPerSide`), folded into epic 0089's first commit since it's the same lines. This strongly suggests the picklist should be replaced with an explicit-omit approach (spread the object, delete/skip only the keys that need conditional omission) so the next added field can't silently regress — logged as a cleanup thought, not done here.

**2026-09-01 — a fifth instance:** `DiagramNode.data.references` (epic 0090's reference images) was never in `serializeDiagram`'s per-node `data` picklist — so a shape's reference-image paths were written by `toDiagramFile` and then dropped on serialize, meaning **reference images never survived a save/reload** since epic 0090 shipped (never caught because it needs Electron + a saved diagram + a reload to observe, and epic 0090 wasn't live-tested). Found while adding `data.security` to the same picklist for epic 0079. Both added together (`references` + `security`). The explicit-omit refactor above is now overdue — this is the 5th silent regression from the same root cause — but it's deferred out of epic 0079 because reordering the emitted keys would churn every existing `.chd` file's git diff on its next save, which needs its own careful pass.

**References:** `src/shared/diagram.ts`'s `serializeDiagram`, `src/main/diagram.ts`'s `diagram:save` handler.

---

## A menu bar's hover-switch races its own click handler

**Status:** Solved
**Found:** 2026-08-22, epic 0049, while building the custom top menu bar

**Symptom:** clicking a different top-level menu label (e.g. "View") while a sibling menu ("File") was already open closed the whole menu bar instead of switching to the clicked one. Only reproduced with a real click landing on a different label than whatever was already open — a bare click from a fully-closed state, or a repeat click on the same already-open label, both worked fine on their own.

**Root cause:** the menu bar supports the conventional "hover a sibling to switch while one is open" behavior via `onMouseEnter`. A mouse click gesture always fires `mouseenter` on the target element _before_ `click` (the cursor has to arrive before it can press) — so by the time the click handler ran, `onMouseEnter` had already switched `openIndex` to the clicked menu. The click handler's own toggle logic (`current === index ? close : open`) then saw "you clicked the menu that's already open" and closed it, even though that "already open" state was only a few milliseconds old and produced by the same physical gesture, not a genuinely separate prior interaction.

**Resolution:** a ref (`hoverSwitchedToRef`) records the index `onMouseEnter` just switched _to_, but only when it represents a genuine switch (arriving from a different index — re-entering the same already-open menu, or hovering while nothing is open, don't touch it). The click handler checks this first: if the click is landing on the menu hover just switched to as part of the same gesture, it keeps the menu open instead of toggling it closed.

**Investigation note:** this was hard to pin down via the Browser pane's automated clicks — repeated attempts at the identical test sequence gave inconsistent results (sometimes the switch worked, sometimes it didn't), most likely because the automation tool's cursor-positioning between separate tool calls doesn't reliably match real continuous mouse movement (whether `mouseenter` fires at all, and exactly when, depended on exactly how the pointer "arrived"). Ground truth came from temporarily instrumenting the component with `console.log` on every `mouseenter`/`click` and reading the actual event sequence back via the console, not from trusting the automation's click results directly — worth reaching for that technique earlier next time a hover-timing-sensitive interaction needs debugging in this environment.

**References:** [epic 0049](planning/epics/completed/0049-top-menu-bar.md), [ADR 0039](decisions/0039-top-menu-bar.md), `src/renderer/src/components/MenuBar.tsx`

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

**Root cause:** `nextZIndex` (the helper behind `addShapeNode`/`addTextNode`/`addContainerNode`) only scoped _containers_ correctly (to other existing containers). Shapes and text both scoped to _every_ node regardless of type, with no tier floor at all — so in a small or empty diagram, "current max across everything, plus one gap" landed far below the intended tier. The load-time backfill (`backfillZIndex`, used for old files) had always done this correctly; only the new-node-creation path had the bug, so it went unnoticed until enough manual node creation happened in one session for the user to notice the numbers directly (visible in the layer panel).

**Resolution:** `nextZIndex` now always scopes to the node's own type and passes that type's own base floor into `nextZIndexAbove`, so a brand new node of any type lands solidly within its tier even when nothing of that type exists yet. Also added a third tier: text now seeds above shapes (`TEXT_BASE`, higher than `SHAPE_BASE`), a small enhancement bundled into the same fix at the user's request, since annotations reasonably belong on top of the shapes they label.

**References:** `docs/planning/epics/0043-layer-order-control.md`'s Notes, `src/renderer/src/layers/zIndexOrdering.ts`, `src/renderer/src/Canvas.tsx`

---

## React Flow requires `updateNodeInternals()` after dynamically adding a handle

**Status:** Solved
**Found:** 2026-08-20, epic 0022 gallery testing (originally shipped as part of epic 0013)

**Symptom:** a connection point added via "Add connection point here" rendered fine and looked clickable, but silently refused to accept an edge being dragged onto it — specifically as an edge's _target_ (an edge originating elsewhere and terminating on the new point). The point had gone untested in that specific direction for months because gallery-scale diagrams hadn't exercised it until epic 0022.

**Root cause:** React Flow caches each node's handle bounds for connection validation at mount time. A `Handle` added to an already-rendered node afterward exists in the DOM and looks correct, but React Flow's internal cache doesn't know about it until `updateNodeInternals(nodeId)` is called explicitly. This codebase never called it.

**Resolution:** both the add and remove paths in `connectionPoints.ts` call `updateNodeInternals(id)` after mutating a node's connection points. Generalized into the standing pattern for any future dynamically-added handle, not just this one call site — see the pattern repeated (correctly) throughout epic 0039's later work on the same file. **If a future feature adds any other kind of dynamically-created handle to a node, check for this same requirement before assuming "it renders, so it works."**

**References:** [epic 0013](planning/epics/completed/0013-configurable-connection-points.md), `src/renderer/src/nodes/connectionPoints.ts`

---

## Connection point count/spacing model — five-round bug chain

**Status:** Solved
**Found:** 2026-08-21/22, epic 0039

The single richest bug chain so far — worth reading in full via [ADR 0036](decisions/0036-connection-point-count-and-transfer.md) (five dated revisions) and [epic 0039](planning/epics/completed/0039-connection-point-counts.md)'s Verification section, but the short version:

1. **Spacing overlap/clustering**: computing evenly-spaced offsets for only the _custom_ points (ignoring that a side's always-present default point sat at a fixed 0.5) made every even total count overlap a point exactly onto the default, and every odd total visually cluster around it.
2. **Root cause of #1, and independently, wrong-neighbor edge transfers on reconnect**: the default point was a real, separate, hardcoded concept (4 unconditional `<Handle>` elements, fixed id, fixed offset) living entirely outside the array the app's own clockwise-ordering/transfer logic reasoned about. **General lesson: a "keep this one element fixed to avoid a bigger rework" scoping compromise, applied to something meant to look/behave uniformly with the rest of a set, tends to be a false economy — the exception becomes exactly where bugs hide.** Fixed by unifying the default into the same per-side array as everything else (synthesized on demand only for an untouched side, materialized as an ordinary point the moment the side is touched).
3. **Manual add/remove not re-spacing**: a deliberate "precision tool, don't touch anything but the one point you're editing" design choice — looked broken in practice rather than precise. Every structural operation (bulk count field, manual add, manual remove) now re-spaces the whole side afterward; only _which_ point moves differs.
4. **Bottom/left mirrored**: the shared re-spacing helper always zipped ascending offset values onto a clockwise-sorted array by plain index — correct on top/right (clockwise = ascending raw offset there) but backwards on bottom/left (clockwise = descending). Fixed by reversing the offset assignment on those two sides.
5. **Max-per-side setting bypassed**: the setting was only ever wired into the property panel's number field; the separate manual right-click "add" code path had no knowledge of it at all. **General lesson: when a limit/setting needs enforcing, check every entry point that can trigger the guarded action, not just the one you're focused on** — threaded the setting through `DiagramContext` (shared by every node component) instead of just the one UI surface.

**References:** [ADR 0036](decisions/0036-connection-point-count-and-transfer.md), [epic 0039](planning/epics/completed/0039-connection-point-counts.md), `src/renderer/src/nodes/connectionPoints.ts`

---

## A dragged edge endpoint snapped to the wrong side's point after a count change

**Status:** Open, not reproduced
**Found:** 2026-08-22, live testing by the user on the Meridian Rail landscape

**Symptom:** changed a shape's LEFT side from 1 to 2 connection points (property panel count field), then tried dragging an edge's endpoint onto the new left-side point — it snapped onto the _last point on the BOTTOM side_ instead. The user's own hypothesis, worth taking seriously: an off-by-one across sides, since bottom immediately precedes left in this app's canonical clockwise order. Not reproduced on a repeat attempt.

**Investigation so far, no fix attempted (matches the user's own "log it, don't chase it blind" framing given it's unreproducible):**

- The side-ordering hunch checks out structurally: `SIDES = ['top', 'right', 'bottom', 'left']` in `connectionPoints.ts` — bottom really is index 2, left index 3, immediately adjacent.
- Traced the actual data path for a 1→2 count change (`setSideCustomPointCount` → `Canvas.tsx`'s `setConnectionPointCount`) by hand and it produces correct, distinctly-ID'd points on the _right_ side (`left` keeps its original id at the new offset, a fresh `cp-N` id gets the other) — no off-by-one visible in the data itself for this specific case.
- Given it didn't reproduce on a second attempt, a **timing race is a more likely culprit than a logic bug**: `setConnectionPointCount` calls `updateNodeInternals(nodeId)` synchronously, in the same callback as the `setNodes(...)` call that adds the new handle to the node's data — before React necessarily commits the re-render that actually mounts the new `<Handle>` DOM element. If `updateNodeInternals` measures handle bounds before the new one exists in the DOM, React Flow's own hit-testing would have to fall back to whatever's currently registered, and picking the geometrically-nearest _stale_ handle instead of the new one is a plausible way to land on an unrelated side. This would be the same underlying bug class as "[React Flow requires updateNodeInternals() after dynamically adding a handle](#react-flow-requires-updatenodeinternals-after-dynamically-adding-a-handle)" above, but a timing variant (the call exists, but may run too early) rather than a missing call.

**If revisited**: try wrapping the `updateNodeInternals` call in a `requestAnimationFrame` or a `useEffect` keyed on the node's point count, so it runs after React has actually committed the new handle, and see if that's enough to close the race. Reproducing it at all first (maybe by changing a count and immediately, rapidly starting a drag, rather than pausing between the two) would help confirm the timing theory before touching anything.

**References:** [epic 0039](planning/epics/completed/0039-connection-point-counts.md), [epic 0022](planning/epics/0022-example-diagram-gallery.md) (where it was found), `src/renderer/src/nodes/connectionPoints.ts`, `src/renderer/src/Canvas.tsx`'s `setConnectionPointCount`

---

## Layer panel drag-and-drop: ambiguous drop target, then a dead zone

**Status:** Solved
**Found:** 2026-08-21, epic 0043, live testing by the user

**Symptom:** two separate issues found back to back while testing the new layer-reorder panel: (1) dropping directly onto a row didn't make clear which side of that row the dragged item would land on; (2) after adding a visible insertion-line indicator to fix that, dropping _between_ rows (on the indicator itself, or in the gaps) produced a "not allowed" cursor and the drop silently failed.

**Root cause:** (1) was a UX gap, not a bug — no visual feedback for an inherently ambiguous gesture. (2) was a real bug: only the row elements had drag-over/drop listeners, so the space between them (where the insertion line rendered) had no drop handler at all.

**Resolution:** (1) replaced ambiguous drop-onto-a-row with a visible insertion line computed from cursor position. (2) moved drag-over/drop listening to the whole list container and computed the target slot geometrically from cursor position, rather than relying on which specific child element the pointer happened to be over.

**References:** [epic 0043](planning/epics/completed/0043-layer-order-control.md), [ADR 0035](decisions/0035-layer-order-control.md), `src/renderer/src/components/LayerPanel.tsx`

---

## Edge reconnect-handle "ownership" at a shared connection point isn't decided by z-index

**Status:** Solved — see the 2026-08-22 revision below; the original epic 0046 fix (DOM order) turned out not to be the real mechanism at all
**Found:** 2026-08-21, epic 0046; recurred and properly root-caused 2026-08-22, epic 0022 (Meridian Rail landscape testing)

**Symptom:** with several edges converging on the same connection point, the reconnect-drag handle (the small circle used to move an edge's endpoint) belonged to the wrong edge, regardless of which edge was actually selected — a user couldn't reliably grab a specific edge at a busy convergence point.

**Original (2026-08-21) investigation — later found incomplete.** The working theory at the time was that React Flow's `elevateEdgesOnSelect` (assumed on by default) should already bump a selected edge's z-index by 1000, winning any hit-test "for free," but didn't. Live testing on a shape with three converging edges seemed to show DOM/creation order was the actual deciding mechanism instead, so the fix built then (`Canvas.tsx`'s `orderedEdges`, moving selected edges last in the array passed to `<ReactFlow edges={...}>`) targeted that. It happened to resolve that one test case, but not because the theory was right.

**2026-08-22: recurred, and actually root-caused this time**, live-debugged with temporary `console.log` instrumentation in `onReconnectStart`/`onReconnect` (same technique as the menu-bar hover-switch bug above) rather than re-guessing. The logged data showed a _selected_ edge (`edge-16`) losing a reconnect-handle grab to a completely different, unselected edge — which `orderedEdges` should have prevented if DOM order were really the mechanism. Reading React Flow's actual source (`node_modules/@xyflow/react`, `node_modules/@xyflow/system`) settled it: **each edge renders inside its own separate `<svg style={{ zIndex }}>` wrapper** — a real, independent CSS z-index per edge, not shared DOM/paint order at all. That z-index comes from `getElevatedEdgeZIndex`, which only adds a selection bump when `elevateEdgesOnSelect` is true — and it **defaults to `false`** in this installed React Flow version, and was never explicitly turned on in this codebase. So the 2026-08-21 theory had it backwards: selection had _zero_ effect on any edge's real z-index the whole time. What actually governed it was `zIndexedEdges`' own pre-existing computation (`Canvas.tsx`, epic 0043/ADR 0035) — the midpoint of the edge's two endpoint nodes' z-index — entirely unrelated to which edge a user had clicked.

**Actual resolution**: `zIndexedEdges` now adds a large explicit boost (`SELECTED_EDGE_Z_BOOST = 1_000_000`) on top of the midpoint z-index when `e.selected` is true, so a selected edge's real CSS z-index reliably wins regardless of its endpoints' own z-index. `orderedEdges` (the original DOM-reordering fix) is kept as a harmless tie-breaker for edges that land on the exact same computed z-index, but is no longer what does the actual work.

**Lesson**: the original fix "worked" in its one test case by coincidence — always verify a fix against the actual mechanism (here, reading the library's own source once real data contradicted the working theory), not just against the one scenario that happened to pass.

**References:** [epic 0046](planning/epics/completed/0046-edge-selection-highlight-and-priority.md), [epic 0022](planning/epics/0022-example-diagram-gallery.md), `src/renderer/src/Canvas.tsx`'s `zIndexedEdges`, `node_modules/@xyflow/react`'s `EdgeWrapper`/`getElevatedEdgeZIndex`

---

## Theme flip reads as "negative image" on toggle

**Status:** Open, not urgent
**Found:** 2026-08-21, epic 0040

**Symptom:** even after the Oklab-based fix for the color-mirroring mechanism (see below), the user reports a lingering feeling of "looking at a negative image of my diagram" when toggling between light and dark theme.

**Root cause:** not a bug — this is the expected visual signature of the _blanket_ mirroring approach epic 0040 deliberately chose: every explicitly-colored element's lightness flips uniformly around the same midpoint on every theme change, which reads as a whole-diagram inversion. A targeted, contrast-driven approach (only adjust colors that actually have a legibility problem against the new background, leave everything else alone) would avoid this feeling, but was rejected in [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md) as more complexity than wanted for v1.

**Current state:** flagged by the user as something to get used to, not currently a real complaint — deliberately not fixed. **If it resurfaces as an actual complaint**, the contrast-driven alternative is the documented direction to revisit — see ADR 0034's Alternatives section for the tradeoffs already considered.

**References:** [ADR 0034](decisions/0034-theme-adaptive-color-value-flip.md), [epic 0040](planning/epics/completed/0040-theme-adaptive-color-value-flip.md)

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

**Root cause:** `windows.ts` tracks which `BrowserWindow` shows which path (`windowsByPath`) so opening an already-open file focuses the existing window instead of duplicating it. That registration is normally kept in sync by `loadPathIntoWindow`, called on every real page navigation (initial open, File → Open reuse, link navigation). File → Close (epic 0049) deliberately resets the window's content _in place_ — `loadDiagramIntoCanvas(null, ...)` in the renderer, no page navigation at all — so `windowsByPath` never learned the window stopped showing that path. Reopening the same file found the (stale) registration, and just focused the now-blank window instead of loading anything into it.

**Resolution:** new `windows:clearPath` IPC call, invoked from `handleClose` right after the in-place reset, which removes this window's entry from `windowsByPath` (reusing the existing `unregisterWindow` matches-by-window-reference helper, already used on real window close).

**References:** [epic 0020](planning/epics/completed/0020-autosave-and-crash-recovery.md), [ADR 0039](decisions/0039-top-menu-bar.md) (File → Close's original design), `src/main/windows.ts`, `src/renderer/src/Canvas.tsx`

---

## React Flow's post-load auto-measurement was misclassified as a real edit

**Status:** Solved
**Found:** 2026-08-22, epic 0020, live testing by the user

**Symptom:** File → Close and File → Reload's confirm prompt ("changes since the last save will be lost") appeared every time, identically, whether or not the user had actually made any edits since opening the file.

**Root cause:** `onNodesChange`'s existing change-classifier (predates epic 0020) treats a `dimensions` NodeChange with `resizing === undefined` as a discrete, snapshot-worthy edit — meant to catch a scripted/programmatic resize. React Flow's own `ResizeObserver`-driven post-mount measurement of every freshly-loaded node fires that exact same shape of change (a `dimensions` change with `resizing` left undefined, since it isn't part of any user drag gesture). Before this epic, that misclassification was invisible — it just added a harmless extra no-op entry to the undo stack. Once `pushSnapshot()` also started marking the diagram dirty (this epic's whole point), every load falsely dirtied the diagram immediately, defeating the new dirty-aware prompts entirely.

**Resolution:** a short (500ms) grace window after any `loadDiagramIntoCanvas`, tracked via a ref, during which a `dimensions`-with-`resizing`-undefined change no longer counts as discrete. Every other discrete-change condition (remove/add/replace, a real position change) is untouched — deliberately the narrowest fix that addresses the specific ambiguous case rather than broadening the suppression window to cover more change types than necessary.

**References:** [epic 0020](planning/epics/completed/0020-autosave-and-crash-recovery.md), [ADR 0040](decisions/0040-dirty-tracking-and-autosave-design.md), `src/renderer/src/Canvas.tsx`'s `onNodesChange`/`loadDiagramIntoCanvas`

---

## Unparented native dialog can open behind the app window

**Status:** Solved
**Found:** 2026-08-22, epic 0020, live testing by the user

**Symptom:** the startup orphan-recovery dialog (Recover/Discard for a diagram that crashed before ever being saved) opened _behind_ the main Electron window instead of on top of it.

**Root cause:** `dialog.showMessageBox()` was called with no owning `BrowserWindow` — at the point the startup scan runs, no window created specifically _for_ the recovered content exists yet (that window is only created if the user chooses Recover). An unparented native dialog has no guaranteed z-order relative to the app's own windows, and lost the race against the initial blank window claiming focus after its own `ready-to-show`.

**Resolution:** the app's already-created initial window (from `createWindow()`, called just before the scan starts) is passed as the dialog's owner, giving it a defined z-order/parent relationship instead of none.

**References:** [epic 0020](planning/epics/completed/0020-autosave-and-crash-recovery.md), [ADR 0040](decisions/0040-dirty-tracking-and-autosave-design.md), `src/main/recovery.ts`'s `runStartupOrphanScan`, `src/main/index.ts`

---

## `registerWindowPath` never cleared a window's own previous entry

**Status:** Solved
**Found:** 2026-08-22, epic 0038, live testing by the user

**Symptom:** drop file1 onto a window (opens correctly), drop file2 onto the same window and choose "Open Here" (opens correctly), then drop file1 again — silently ignored.

**Root cause:** `windowsByPath` is keyed by path, not by window, and `registerWindowPath` only ever _added_ a new entry — it never removed whatever entry previously pointed at the same window. Before epic 0038, a single window's path only ever changed once in its lifetime (at creation, or via File → Open's reuse-if-empty, itself only usable once on a window that then stops being empty), so this gap never got exercised. Epic 0038 navigates the same non-empty window to a new path repeatedly across several drops — after dropping file2 "Open Here" onto a window already showing file1, the map held _both_ `file1 → win` and `file2 → win`. Dropping file1 again found the stale entry and just focused the (already-focused) window instead of loading it. The same underlying class of bug as "[File → Close leaves a stale window-path registration](#file--close-leaves-a-stale-this-window-shows-path-x-registration)" above, but a different code path: that one was a registration never _created_ by an in-place reset; this one was a registration never _replaced_ by a real navigation.

**Resolution:** `registerWindowPath` now calls the existing `unregisterWindow` (matches-by-window-reference) on its own target window before adding the new entry — a window can only ever be associated with one path key at a time, enforced at the one place entries get added rather than requiring every caller to remember to clear the old one first.

**References:** [epic 0038](planning/epics/completed/0038-drag-file-to-open.md), `src/main/windows.ts`

---

## Drop-onto-a-dirty-window prompt was misleading and inconsistent with the close-prompt

**Status:** Solved
**Found:** 2026-08-22, epic 0038, live testing by the user (same session as the bug above)

**Symptom:** the user reported "Open Here" opened a dropped file with no save prompt at all, and that there was no Cancel option — while testing what they believed was a drop onto a _dirty_ window. Diagnosis: the button label "Open Here" was identical between the clean (2-button) and dirty (3-button) branches, and the clean branch had no Cancel button at all (dismissing it mapped to "New Window" instead) — so there was no way to tell from the dialog itself which branch had actually fired, or to safely back out of either.

**Root cause:** not a logic bug — both branches were working exactly as originally designed (back when epic 0038 was first scoped, before its dirty-tracking blocker). But that original design had two real gaps: button labels didn't state their own consequence ("Open Here" meant "discard and open" in the dirty branch, with nothing in the label saying so), and the dirty branch's discard-only shape was inconsistent with the close-prompt (epic 0020), which does offer a genuine Save option for the same kind of "unsaved changes" situation.

**Resolution:** redesigned both branches. Every button now names its own consequence ("Save changes, Open Here" / "Discard changes, Open Here" / "New Window" / "Cancel" for dirty — wording refined once more the same day per the user's request, so both options read as parallel phrases sharing the same "changes" wording; "Open Here" / "New Window" / "Cancel" for clean, where "Open Here" is now genuinely safe since there's nothing to lose). Both branches have a real Cancel. The dialog message states the window's dirty state outright rather than leaving it to be inferred. The new Save option reuses `performSaveNow`, a helper extracted from the close-prompt's own save logic — not a duplicate implementation — round-tripping through the renderer via a new `window:performSaveThenOpenDropped` event since main can't perform a save itself (path-picking and detail-draft flushing live in `Canvas.tsx`).

**References:** [epic 0038](planning/epics/completed/0038-drag-file-to-open.md), [epic 0020](planning/epics/completed/0020-autosave-and-crash-recovery.md) (the close-prompt this was brought into consistency with), `src/main/windows.ts`'s `openDroppedFileForWindow`, `src/renderer/src/Canvas.tsx`'s `performSaveNow`

---

## Highlights panel couldn't grow past a flat 320px cap

**Status:** Solved
**Found:** 2026-08-22, epic 0022, live testing by the user reviewing the new Meridian Rail landscape gallery entry (37 highlights across 5 groups)

**Symptom:** the highlights panel needed to grow taller and scroll once a diagram had enough highlights to matter, and didn't seem to.

**Root cause:** `.highlights-panel` (`main.css`) had a flat `max-height: 320px`, unrelated to how much room was actually available on screen. The scrolling CSS itself (`.highlights-panel-body`'s `flex: 1; min-height: 0; overflow-y: auto`) was already correct — it just almost never got exercised before, since no diagram had come close to 320px of highlight content until this one.

**Resolution:** `HighlightsPanel.tsx` now computes `maxHeight` inline from the actual space available above the panel's anchor (`window.innerHeight - bottom - 16`, where `bottom` is the same anchor-relative offset already used to position the panel), rather than using a fixed guess. The now-redundant static `max-height: 320px` was removed from `main.css` (inline style always wins over it anyway).

**References:** [epic 0022](planning/epics/0022-example-diagram-gallery.md), `src/renderer/src/components/HighlightsPanel.tsx`, `src/renderer/src/assets/main.css`

---

## A native confirm() dialog left `<select>` elements unresponsive afterward

**Status:** Worked around
**Found:** 2026-08-22, epic 0055, live testing by the user on the Meridian Rail landscape's `owningTeam` tag

**Symptom:** after `AllowedValuesEditor`'s in-use warning (`window.confirm(...)`, added by epic 0055's allowed-values list editor) appeared and was dismissed — confirmed _or_ cancelled, either way — every `<select>` dropdown in the Required Tags panel stopped opening on click. No console error. Reported first as "the dropdowns just don't work anymore" before the user pinned it down to this specific trigger (removing the `owningTeam` tag's `"None"` allowed value while it was also that tag's current default, a real value on the Meridian Rail landscape from epic 0022's 13th round).

**Root cause:** not fully understood at the Electron/Chromium level — no exception, no error, purely a focus/interaction state left broken by the native dialog closing. Matches a known general class of native-dialog-vs-focus quirk in Electron (see "[Unparented native dialog can open behind the app window](#unparented-native-dialog-can-open-behind-the-app-window)" above for a different symptom in the same general family: native dialogs not integrating cleanly with this app's window/focus model). This app already uses `confirm()`/`alert()` successfully elsewhere (Close, Reload, copy-to-children) — none of those are immediately followed by trying to open a native `<select>` in the same still-open panel, which may be exactly what this specific interaction needed to actually surface the quirk.

**Resolution:** replaced the native `confirm()` in `AllowedValuesEditor` with an in-panel confirmation — the row being removed/renamed is swapped for a small inline message + Confirm/Cancel buttons (`.required-tag-value-confirm`), no native dialog involved at all. Not a fix for the underlying Electron quirk itself (still not understood), just an avoidance — **any future feature that shows a native `confirm()`/`alert()` and then expects the user to keep interacting with `<select>` elements in the same view should watch for this same symptom**, and prefer an in-app confirmation the way this one now does.

**References:** [epic 0055](planning/epics/completed/0055-required-tags-allowed-values-list-editor.md), [ADR 0047](decisions/0047-allowed-values-list-editor.md), `src/renderer/src/components/RequiredTagsPanel.tsx`

---

## Setting `style={{ backgroundColor }}` on `<ReactFlow>` does nothing

**Status:** Solved
**Found:** 2026-08-22, epic 0030, live testing by the user immediately after the canvas-background-color feature shipped

**Symptom:** picking a canvas background color in the new Style Palette panel had no visible effect at all — the canvas kept showing React Flow's own default light/dark background regardless of what was picked.

**Root cause:** `<ReactFlow>`'s `style` prop does land on the actual `.react-flow` root element (confirmed by reading `node_modules/@xyflow/react/dist/esm/index.mjs` — `style: { ...style, ...wrapperStyle }` on the same div that carries the `react-flow` className), so a plain `backgroundColor` _does_ change that element's own paint. But it's never visible: `<Background>` renders a separate, absolutely-positioned SVG on top (`.react-flow__background`, covering the whole pane) whose own CSS rule is `background-color: var(--xy-background-color-props, var(--xy-background-color, var(--xy-background-color-default)))` (`node_modules/@xyflow/react/dist/style.css`) — it reads a **CSS custom property**, not the literal `background-color`, and that custom property isn't set by passing a plain `backgroundColor` in the style object at all.

**Resolution:** set the custom property directly instead: `style={{ '--xy-background-color': value } as React.CSSProperties}` (the cast is needed since custom properties aren't part of the standard `CSSProperties` type). Custom properties inherit down the DOM tree, so setting it on the outer `.react-flow` element correctly reaches the child `<Background>` SVG that actually paints. **General lesson for anything touching React Flow's visual defaults**: check whether the library exposes a CSS custom property before assuming a plain style/CSS property will reach the actual paint layer — several of React Flow's own defaults (edge stroke, node background, handle color, etc.) follow this same `var(--xy-*-props, var(--xy-*, var(--xy-*-default)))` fallback chain, not a plain property.

**References:** [epic 0030](planning/epics/completed/0030-custom-style-palettes-and-defaults.md), [ADR 0048](decisions/0048-style-palette-and-defaults.md), `src/renderer/src/Canvas.tsx`, `node_modules/@xyflow/react/dist/style.css`

---

## A concave line's bounding box was clickable everywhere inside it, not just on the curve

**Status:** Solved
**Found:** 2026-08-22, epic 0064, live testing by the user immediately after the freeform line's first pass shipped

**Symptom:** a line bent into a U-shape (or any concave curve) could be selected — and dragged as a whole — by clicking anywhere inside its own empty interior, not just on the stroke. Reported as "it will end up blocking too much," with the user's own comparison: an edge only responds to a click fairly close to or on top of its path, a line didn't.

**Root cause:** React Flow's default node hit-testing is the node's _rectangular_ `position`/`size` box — fine for Shape/Container/Text, which are always filled boxes anyway, but a line (epic 0064/ADR 0050 modeled it as a `DiagramNode`, specifically to reuse that box-based selection/drag/lock machinery) can be sparse and concave, so its tightest bounding rectangle routinely includes large stretches of genuinely empty space. `LineNode.tsx` already had a purpose-built wide invisible hit-stroke (for right-click "add point"), but nothing stopped React Flow's own wrapper `<div>` from independently claiming every click inside the whole box first.

**Resolution:** React Flow applies a node's `style` field (a real, normally-unused-in-this-codebase `Node` field, distinct from this app's own `data.style` convention) directly onto its own wrapper element — so setting `pointerEvents: 'none'` there (`Canvas.tsx`'s `zIndexedNodes`, `line`-typed nodes only) makes the _whole box_ click/drag-through by default. `pointer-events` is inherited but overridable per descendant, so `LineNode.tsx`'s existing invisible hit-stroke path (`pointerEvents: 'stroke'`) and its point handles (`pointer-events: auto` in CSS) each explicitly opt back in — only the curve itself, within the hit-stroke's tolerance, and its points stay interactive. **General lesson for any future node type whose visual shape doesn't fill its own rectangular bounding box**: React Flow's default click/drag hit-testing is the box, not the rendered content — the `Node.style` field is the documented escape hatch, not `data.style` or anything rendered inside the component.

**References:** [epic 0064](planning/epics/completed/0064-simple-curved-freeform-line.md), [ADR 0050](decisions/0050-freeform-line-as-node-type.md), `src/renderer/src/Canvas.tsx`, `src/renderer/src/nodes/LineNode.tsx`

---

## `npm run lint` reports ~10,000 CRLF warnings repo-wide

**Status:** Open, not this machine's normal experience, cause not confirmed
**Found:** 2026-08-23, epic 0010, running `npm run lint` after adding the PNG export feature

**Symptom:** a routine `npm run lint` run reported ~10,200 `prettier/prettier` "Delete `␍`" warnings spread across dozens of pre-existing files never touched this session (confirmed via `git status` — only this session's own 10 changed/new files showed up there), alongside the same 4 real errors [epic 0028](planning/epics/completed/0028-remaining-lint-cleanup.md) already tracks as this project's pre-existing baseline. `file` on an untouched file (`AboutDialog.tsx`) confirmed it has actual CRLF line terminators on disk; `git config --get core.autocrlf` returned `true` and there's no `.gitattributes` pinning line endings, so a normal Windows checkout on this machine legitimately produces CRLF files while ESLint's Prettier config expects LF.

**Not yet explained:** why this hadn't surfaced before now, given PROGRESS.md's repeated "same pre-existing lint-error count as master, no new ones" checks presumably ran on this same Windows machine. `.eslintcache` (gitignored) was rewritten by this run — plausible this run was the first with a cold/invalidated cache and prior checks were unknowingly reading a stale cache that skipped re-reporting already-warned, unchanged files. Not confirmed; worth checking on the next fresh clone or `rm .eslintcache` run whether it reproduces from a clean state.

**Not fixed here** — deliberately out of scope for epic 0010's small PNG-export change; this is really [epic 0028](planning/epics/completed/0028-remaining-lint-cleanup.md)'s territory (either pin `.gitattributes`/`core.autocrlf` for this repo, or set ESLint/Prettier's `endOfLine` to `auto`), and a repo-wide line-ending rewrite is exactly the kind of drastic, unrelated change CLAUDE.md says to pause and ask about rather than fold into an unrelated epic.

**References:** [epic 0028](planning/epics/completed/0028-remaining-lint-cleanup.md), [epic 0010](planning/epics/completed/0010-export.md)

---

## Exported PNGs had no visible arrowheads on any edge

**Status:** Solved
**Found:** 2026-08-23, epic 0010, live testing by the user immediately after PNG export's first pass shipped

**Symptom:** every edge exported to PNG with no arrowhead at all — reported as arrows "not visible," confirmed not just a size/contrast issue since making the marker much thicker and a different color still didn't make it appear.

**Root cause:** `EdgeMarkerDefs` (`src/renderer/src/edges/edgeMarkers.tsx`) renders every `<marker>` definition inside a separate, zero-size `<svg>` that's a _sibling_ of `<ReactFlow>` in the DOM — deliberately, per that file's own existing comment, so marker ids stay resolvable from any edge in the document regardless of which `<svg>` the edge itself renders inside. PNG export (`captureDiagramPng`, `src/renderer/src/export/exportPng.ts`) only clones `.react-flow__viewport` — the subtree containing nodes/edges — to keep Background/Controls/MiniMap chrome out of the exported image (see [ADR 0051](decisions/0051-png-export.md)). That subtree never included the marker defs at all, so every edge's `marker-end="url(#...)"` attribute referenced an id that simply didn't exist in the captured content — not a rendering glitch, the referenced element was never there.

**Resolution:** give the marker-defs `<svg>` a stable `data-export-role="edge-marker-defs"` attribute, then in `captureDiagramPng`, clone that element (`cloneNode(true)`, not moving the live node — moving it could confuse React's own reconciliation for an element it still manages) and temporarily insert the clone as the viewport's first child for the duration of the `toPng()` call, removing it in a `finally` immediately after. **General lesson**: this app renders more than one kind of "global, id-referenced, zero-visual-footprint" definition outside the node/edge tree (this marker-defs pattern specifically) — anything that captures/serializes only a subtree of the canvas (export, and potentially any future feature doing the same) needs to check whether it's implicitly relying on DOM state that lives outside that subtree.

**References:** [epic 0010](planning/epics/completed/0010-export.md), [ADR 0051](decisions/0051-png-export.md), `src/renderer/src/edges/edgeMarkers.tsx`, `src/renderer/src/export/exportPng.ts`

---

## "Use canvas color" PNG export always exported plain white

**Status:** Solved
**Found:** 2026-08-23, epic 0010, live testing by the user right after the previous two PNG export fixes landed

**Symptom:** exporting with "Use canvas color" (no background override, no transparency) produced a plain white background, regardless of the diagram's actual on-screen canvas color — reported directly as "ended up as just white, not the actually active canvas colours."

**Root cause:** the first fix read `getComputedStyle(viewportEl).getPropertyValue('--xy-background-color')` directly, expecting it to already hold the resolved color. But `.react-flow`'s own CSS (`node_modules/@xyflow/react/dist/style.css`) only ever _uses_ that custom property inside a `var()` fallback chain — `background-color: var(--xy-background-color, var(--xy-background-color-default))` — it never assigns the literal `--xy-background-color` property a value unless a custom `canvasBackgroundColor` is set. Reading the property name directly, rather than reading through a `var()` reference, returns an empty string in the common no-override case, silently hitting this function's own hardcoded `'#ffffff'` fallback every time. Compounding it: even the _correctly_ resolved `.react-flow` background in light mode with no override is `--xy-background-color-default: transparent` — the real color the user sees painted behind the canvas in that case comes from this app's own `body { background: var(--color-background) }` (`assets/base.css`), several DOM ancestors above `.react-flow` itself, not from React Flow's own background mechanism at all.

**Resolution:** `resolveEffectiveBackgroundColor()` walks up from the viewport element through `.parentElement`, reading each ancestor's real, already-resolved `getComputedStyle(...).backgroundColor` (the actual CSS property, not a custom-property name) until it finds one that isn't `transparent`/`rgba(0, 0, 0, 0)` — the same compositing a browser (and a viewer's eyes) already does to decide what color is "really" behind an element, regardless of which specific ancestor happens to own it or how many `var()` fallback levels are involved. **General lesson**: a custom CSS property (`--foo`) and the standard property that consumes it via `var(--foo, fallback)` are not interchangeable to read back — querying the custom property directly skips the entire fallback chain and returns empty unless something explicitly assigned it a value.

**References:** [epic 0010](planning/epics/completed/0010-export.md), [ADR 0051](decisions/0051-png-export.md), `src/renderer/src/export/exportPng.ts`

---

## Adding a new required tag immediately stamps its placeholder key onto every element, then demotes it to a stray free tag on rename

**Status:** Open, root cause understood from code reading, not fixed
**Found:** 2026-08-24, reported by the user from live use, logged rather than fixed immediately

**Symptom:** click "Add required tag" in the Required Tags panel, then rename the new tag's key to something real (e.g. "sensitivity") — every Shape/Container/Edge in the diagram ends up with a stray, no-longer-required free tag named `key` (or `key (demoted)` if `key` was already taken) sitting alongside the real, correctly-named required tag. The user's framing: a new tag "starts out with the name key, and gets added on change."

**Root cause (read from code, not yet live-debugged):** `RequiredTagsPanel.tsx`'s `addTag()` calls `onChange([...requiredTags, { key: 'key', lock: 'lockedEditable' }])` **synchronously and immediately** on click — unlike every other field in this panel, which drafts locally and only commits on blur/Enter (see `useFieldDraft`'s own comment, added specifically to fix a related but distinct bug: per-keystroke commits while typing a key). That immediate `onChange` flows straight to `Canvas.tsx`'s `updateRequiredTags` → `syncElementMetadata`, which runs its full backfill pass against every element right then — seeding literal key `"key"` onto all of them (`Canvas.tsx:590`, `next[def.key] = templateEntry`), before the user has typed anything. When the key field is then blurred with its real name, `useFieldDraft`'s blur-commit correctly does this as one clean rename in the panel's own state, but from `syncElementMetadata`'s point of view it's just "`key` is no longer required" (the renamed tag is a different `key` now) + "a new key is required" — so the sync's demote-not-delete rule (`Canvas.tsx:593-598`, ADR 0022's "don't destroy data") faithfully preserves the orphaned `"key"` entry as a free tag on every element, exactly as it's designed to for a genuine rename-away-from-a-required-key. The mechanism is working as designed; the bug is that a brand-new, not-yet-named tag is treated as "real" and synced onto every element before the user ever chose its name.

**Not yet fixed** — user asked to log this for later rather than fix now. Two directions worth considering when revisited (both roughly matching the user's own suggestion — "maybe ask, or [a] done trigger when making a new tag"):

1. Don't call `onChange` from `addTag()` at all until the new tag's key is first committed away from the placeholder — e.g. local "pending new tag" state in the panel (similar shape to `AllowedValuesEditor`'s existing always-blank trailing row pattern in the same file), only appended to `requiredTags` once it has a real, user-chosen key.
2. Keep the immediate add but seed it with a genuinely unique, obviously-placeholder key that can never collide with something the user will actually type (unlikely to fully solve it — the demotion would still happen, just with a differently-named orphan).
   Option 1 seems more consistent with how the rest of this panel already avoids syncing on incomplete input.

**References:** `src/renderer/src/components/RequiredTagsPanel.tsx`'s `addTag`/`useFieldDraft`, `src/renderer/src/Canvas.tsx`'s `syncElementMetadata`/`updateRequiredTags`, [epic 0034](planning/epics/completed/0034-unified-tag-and-metadata-system.md), [ADR 0022](decisions/0022-unified-tag-and-metadata-system.md)

---

## Pasting a copied child-of-a-container node can land it far off screen

**Status:** Solved (ADR 0075 / epic 0103, 2026-08-30) — pending the user's live test
**Found:** 2026-08-24, reported by the user from live use, logged rather than fixed immediately

**2026-08-30 fix (ADR 0075):** `remapForPaste` now branches on `parentId`. If the node's parent container is also in the payload, `parentId` is remapped through the same `idMap` as node ids and the child's relative `position` is kept untouched (no centroid recenter). If the parent isn't in the payload — an orphaned child, or a cross-diagram paste — `parentId` is stripped and the node pastes as a normal top-level node. The paste centroid is computed over top-level-in-payload nodes only, so a container's small parent-relative child coordinates no longer skew it. `pasteFromClipboard` wraps the merged array in `sortNodesForHierarchy`. Also folded into the same epic: a load-time `healHierarchy` pass that drops a dangling `parentId` from files already saved in this broken state.

**2026-08-29 confirmation:** the "suspected" mechanism below is exactly right, confirmed against a real user diagram ("Project Overview") where ~18 pasted nodes carried `"parentId": "container-1a2b3c4d-…"` for a container that isn't in the file at all. `remapForPaste` (`clipboard.ts`) spreads `...n` and **never remaps, strips, or inspects `parentId`** — so a child pasted without its container keeps a dangling reference, and (if the container _was_ copied too) still points at the _old_ id because `idMap` is only applied to `id`/`source`/`target`, never `parentId`. Now folded into epic 0103 alongside two sibling container-hierarchy bugs (the two entries just below).

**Symptom:** pasting a copied element sometimes lands it way outside the visible viewport, instead of centered on-screen the way `remapForPaste`'s own logic (`clipboard.ts`) intends.

**Suspected root cause (read from code, not yet live-debugged):** `position.x`/`position.y` on a node with `parentId` set is **relative to its parent container**, not the canvas — an explicit, deliberate rule from ADR 0012, also documented in `docs/file-format.md`'s `position` field. `remapForPaste` (`src/renderer/src/clipboard.ts`) computes each pasted node's new position as `center + (n.position - centroid)`, where `center` is an absolute canvas/flow coordinate (`rfInstance.screenToFlowPosition` of the screen's center, `Canvas.tsx`'s `pasteFromClipboard`) — correct _only_ if `n.position` was itself an absolute coordinate to begin with. For a copied node that's a child of a container, `n.position` is actually parent-relative (typically small numbers, e.g. `{x: 20, y: 20}`), so this computation produces a small, roughly-centroid-relative absolute value — but the pasted node also keeps its **original `parentId`**, unchanged: neither `remapForPaste` nor `buildClipboardPayload` remaps, clears, or even inspects `parentId` at all. React Flow will then render the new node at _the original container's own absolute position_ **plus** this newly-computed (already-meant-to-be-absolute) offset — a double displacement that could plausibly land arbitrarily far from both the container and the paste target, matching "way off screen."

**Not yet fixed** — logged per the user's "for later" framing rather than chased down immediately; the above is a plausible mechanism from reading the code, not something reproduced and confirmed step-by-step yet.

**If revisited:** first confirm by copying a node that's actually inside a container (not a top-level shape) and pasting, ideally with the container positioned far from the canvas origin — the theory predicts the further the container sits from `(0,0)`, the further off screen the paste lands. If confirmed, the fix is likely one of: (a) clear `parentId` on paste (pasted content always becomes top-level, simplest but loses containment), or (b) if the node's original parent container was _also_ copied and pasted alongside it, remap `parentId` through the same `idMap` already built for node ids and keep the position parent-relative as-is (untouched, no `center` offset applied to it at all — only top-level pasted nodes should get the `center`-based repositioning); if the parent _wasn't_ copied along with it, fall back to (a). Either way, `remapForPaste`'s position math needs to branch on whether a given node has a `parentId`, which it currently doesn't.

**References:** `src/renderer/src/clipboard.ts`'s `remapForPaste`/`buildClipboardPayload`, `src/renderer/src/Canvas.tsx`'s `pasteFromClipboard`, [epic 0025](planning/epics/completed/0025-copy-paste.md), [ADR 0049](decisions/0049-clipboard-copy-paste.md), [ADR 0012](decisions/0012-container-node-design.md) (parent-relative `position` for a contained child — also restated in `docs/file-format.md`'s `position` field), [epic 0103](planning/epics/completed/0103-container-hierarchy-integrity.md)

---

## Clicking a container selects a different container that visually encloses it

**Status:** Worked around (ADR 0075 / epic 0103, 2026-08-30) — pending the user's live test. The z-inversion itself is a React Flow invariant and can't be fixed; it's now surfaced instead of silent.
**Found:** 2026-08-29, live use by the user on a "Project Overview" diagram

**Symptom:** two containers, "Container A" and "Container B". The Layers panel shows Container A above Container B. Clicking on the visible area of Container A selects Container B instead.

**Root cause:** in the file, Container B is a **child** of Container A (`parentId` points at it), but it's the geometrically _larger_ box that fully encloses Container A — the data hierarchy is inverted relative to the visual nesting (most likely: the user resized/moved Container B to be bigger than its parent after it was first parented; resizing a container past its parent's bounds doesn't un-parent it). React Flow **forces a child's effective z-index to at least `parentZ + 1`**, regardless of the explicit `zIndex` — confirmed by reading `@xyflow/system`'s `calculateChildXYZ`: `z: parentZ >= childZ ? parentZ + 1 : childZ`. Container A has `zIndex: 55`, Container B `zIndex: 40`, so this app's Layers panel (which reads raw `data.zIndex`) correctly shows Container A on top — but React Flow renders Container B at `z = 56` because it's the child, so it wins the hit-test in the overlap region. This app's own z-index model (ADR 0035) assumes it fully controls stacking; React Flow's parent-above-child rule silently overrides it, and nothing reconciles the two or tells the user.

**If revisited / fix direction (epic 0103):** "a child always renders above its parent" is a React Flow invariant this app can't override (even `zIndexMode: 'manual'` keeps the `parentZ + 1` in `calculateChildXYZ`). So the fixes are: (1) a Diagnostics warning when a child extends outside its parent's bounds; (2) the Layers panel should show the _effective_ order (and the nesting) rather than raw `data.zIndex`, so it stops contradicting what's clickable; (3) load-time / quick-fix option to un-parent a child that has outgrown its parent.

**2026-08-30 (ADR 0075):** shipped (1) as a standing Diagnostics advisory (`hierarchyAnalysis` in `Canvas.tsx`) naming both containers. For (2), the user's call was to keep the Layers panel sorted on **raw** `data.zIndex` (that's the value drag-to-restack edits — showing a different order there would be a worse kind of lying) and instead mark the rows where raw and effective order disagree: a nested row shows an `in: <parent>` badge with a ⚠ when React Flow renders it above its parent. (3) — auto/quick-fix un-parenting — was explicitly declined: warn only, the user may have a deliberately-overflowing child. Load-time healing covers only genuinely broken (dangling / cyclic) `parentId`, not a merely-outgrown one. A manual **"Detach from parent"** right-click item (shown on any node with a `parentId`) was added instead, so the user always has a one-click way out once the warning points them at it.

**References:** `node_modules/@xyflow/system`'s `calculateChildXYZ`/`updateChildNode`, `src/renderer/src/layers/zIndexOrdering.ts`, `src/renderer/src/components/LayerPanel.tsx`, [ADR 0035](decisions/0035-layer-order-control.md), [epic 0103](planning/epics/completed/0103-container-hierarchy-integrity.md)

---

## "Attach contained shapes" can fling a node to the canvas origin

**Status:** Solved (ADR 0075 / epic 0103, 2026-08-30) — pending the user's live test
**Found:** 2026-08-29, live use by the user (same "Project Overview" diagram as the entry above)

**Symptom:** selecting the container "Container B", right-click → "Attach contained shapes", and a node jumps to the top corner of the canvas.

**Root cause:** `attachContainedNodes` (`Canvas.tsx`) builds its candidate set as `getIntersectingNodes(container, false).filter((n) => n.id !== containerId && !n.parentId)`. In this diagram the only match is **Container A** — it's top-level (passes `!n.parentId`) and fully inside Container B's rect (passes `getIntersectingNodes(..., false)`, whose `partially: false` branch also matches a node that fully covers _or_ is fully covered by the target). But Container A is Container B's own **parent** (see the entry above), so attaching it makes a parent cycle Container A → Container B → Container A. `absolutePosition` (`geometry/nodePosition.ts`) has a `seen`-set cycle break, but React Flow's own `updateChildNode`/`calculateChildXYZ` reads `parentNode.internals.positionAbsolute` for a parent that isn't positioned yet under a cycle → `{x: 0, y: 0}` → the node collapses toward the canvas origin. The drag-to-reparent path (`onNodeDragStop`) already guards this with an `isDescendantOf(candidateId, draggedId)` ancestry check; `attachContainedNodes` was never given the equivalent.

**If revisited / fix direction (epic 0103):** add the ancestor check to `attachContainedNodes`' candidate filter (reuse `isDescendantOf` from `onNodeDragStop`), and also skip a candidate whose bounds _enclose_ the container — a box bigger than its would-be parent shouldn't become its child.

**2026-08-30 (ADR 0075):** done exactly as above — `attachContainedNodes`' candidate filter now also rejects a node that is an ancestor of the container (a local `containerIsDescendantOf` walk, same shape as `onNodeDragStop`'s `isDescendantOf`) and any candidate whose absolute bounds enclose the container.

**References:** `src/renderer/src/Canvas.tsx`'s `attachContainedNodes` and `onNodeDragStop`'s `isDescendantOf`, `src/renderer/src/geometry/nodePosition.ts`, `node_modules/@xyflow/react`'s `getIntersectingNodes` (the `partially` branch), [epic 0103](planning/epics/completed/0103-container-hierarchy-integrity.md)

---

## Icon picker's grid overflowed horizontally, not just missing a vertical scrollbar gutter

**Status:** Solved
**Found:** 2026-08-25, epic 0086, live use by the user — a first fix attempt was reported still broken

**Symptom:** the icon picker's rightmost column of icons looked partially covered/overlapped, and a horizontal scrollbar appeared along the bottom of the icon grid.

**First fix attempt, and why it didn't work:** the symptom looked like a classic "content box doesn't reserve space for its own scrollbar" issue, so `scrollbar-gutter: stable` was added to `.icon-picker-scroll` (the `overflow-y: auto` wrapper). Reported by the user as still broken. That diagnosis was real but incomplete — it addressed a plausible cause, not the actual one, and the fix landed without ever being visually verified (this Electron app's renderer can't be checked by opening the Vite dev server standalone in a browser).

**Actual root cause, confirmed by reproducing it, not just re-reading the CSS**: `.icon-picker-grid button` never had `min-width: 0`. A CSS Grid item's default `min-width` is `auto`, which factors in the item's own content's intrinsic size — each button holds a raw `<svg>` (Tabler icon markup with its own baked-in width/height), so the grid's 6 `1fr` columns refused to shrink below that intrinsic size, regardless of the existing `width: 100%` on the svg/img (that CSS only affects the _rendered_ size once a track width is chosen, not the track-sizing algorithm's own minimum). This forced genuine horizontal overflow inside the icon picker's fixed 220px width (`IconPicker.tsx`'s `PICKER_WIDTH`). Because only `overflow-y` was ever set on the container, the CSS Overflow spec's own rule ("if one axis is non-`visible` and the other is `visible`, the `visible` one computes to `auto` instead") silently turned `overflow-x` into `auto` too — which is what actually produced the unwanted horizontal scrollbar. The "overlap" was never really the vertical scrollbar covering content; it was the rightmost column genuinely being cut off/scrolled out of view by real horizontal overflow.

**How this was actually confirmed, not just reasoned about**: a standalone HTML reproduction of the exact markup/CSS was built and served through the running Vite dev server (`http://localhost:5173`, not opened directly as a `file://` URL, which gets sandboxed with a script-blocking CSP and can't run any JS to measure anything) — then measured `scrollWidth`/`clientWidth`/each button's bounding rect directly via the browser's own JS console. Confirmed the original CSS produces real overflow (the 6th button's right edge lands 3px past the scroll container's own right edge) and that adding the fix below removes it (comfortably inside, `scrollWidth === clientWidth`).

**Resolution**: `.icon-picker-grid button` gets `min-width: 0` (lets a column actually shrink to fit), and `.icon-picker-scroll` gets an explicit `overflow-x: hidden` (removes the now-unneeded horizontal scrollbar outright, rather than leaving it to the CSS spec's auto-compute rule). The original `scrollbar-gutter: stable` fix is kept — still correct for the vertical scrollbar itself, it just wasn't what was actually broken.

**General lesson**: a grid/flex item containing an image, SVG, or anything else with its own intrinsic size will resist shrinking below that size unless `min-width: 0` (or `min-width: 0; min-height: 0` for a flex column) is set explicitly — one of the most common real-world CSS Grid/Flexbox surprises, worth checking first whenever a grid/flex item "won't shrink" or overflows its container despite percentage sizing on its contents. Also: when a fix can't be visually verified in this app (Electron-only rendering), a targeted static HTML reproduction served through the existing dev server — not opened as a bare `file://` URL — is a real way to get actual browser measurements instead of shipping an untested guess.

**References:** `src/renderer/src/assets/main.css`'s `.icon-picker-grid button`/`.icon-picker-scroll`, `src/renderer/src/components/IconPicker.tsx`'s `PICKER_WIDTH`, [epic 0086](planning/epics/completed/0086-minor-ui-improvements.md)

---

## Deleting / cutting a container + its selected children removes only the container, keeps the children

**Status:** Open — deliberately not fixed yet; the user wants the current "container goes, contents survive" behaviour kept for now and a decision made later (see below)
**Found:** 2026-08-30, reported by the user from live use, logged for later

**Symptom:** first reported as "Ctrl+X only cuts one item." On a closer look the user pinned it down: with a container **and** shapes inside it all selected, Delete (and Cut, which deletes after copying) removes the container first, then the shapes are *not* removed — they survive, promoted to top-level. So a multi-selection that spans a container and its own children ends up only partly deleted. The user's note: the "container first, then shapes" ordering "might be a good feature" — do **not** fix it right now, just record it.

**Almost certainly the ADR 0012 child-promotion cascade, working as designed for the lone-container case but surprising here.** `deleteElements` emits a batch of `remove` changes; `onNodesChange` (`Canvas.tsx`) filters out the `remove` for any node that is a descendant of a container also being removed (`isDescendantOfRemovedContainer`) — because deleting a container is supposed to *promote* its children, not delete them (ADR 0012). That rule doesn't distinguish "the child just happened to be inside a deleted container" from "the child was explicitly selected for deletion too" — so an explicitly-selected child of an explicitly-selected container has its own deletion silently suppressed. Cut inherits this directly (`cutSelection` = `copySelection()` then `deleteElements`); the clipboard side is probably fine (`buildClipboardPayload` copies all selected nodes), so a subsequent paste would bring back everything even though the delete only removed the container.

**Open decision when this is picked up:** when a container and one or more of its own children are deleted together, should the children (a) be promoted, as now — the container "dissolves," contents stay; or (b) be deleted too, since they were explicitly selected? Option (b) is closer to what most editors do for a spanning multi-select; option (a) is a genuinely useful "unwrap this container" gesture the user wants to keep *some* way to trigger. Possible resolution: keep (a) as the behaviour when only the container is selected, switch to (b) when children are also in the selection.

**References:** `src/renderer/src/Canvas.tsx`'s `cutSelection` / `copySelection` / `onNodesChange`'s `isDescendantOfRemovedContainer`, `src/renderer/src/clipboard.ts`'s `buildClipboardPayload`, [ADR 0012](decisions/0012-container-node-design.md) (child promotion on container delete), [ADR 0049](decisions/0049-clipboard-copy-paste.md)

---

## Copy/paste doesn't preserve container relationships

**Status:** Open — ADR 0075 / epic 0103 reworked `remapForPaste` for exactly this and is **unmerged**; retest after merge before investigating further
**Found:** 2026-08-30, reported by the user from live use, logged for later

**Symptom:** copying elements that are inside a container and pasting them (via Ctrl+C / Ctrl+V — distinct from the in-place Ctrl+D _duplicate_, which is a separate, simpler path) does not keep the container nesting, and the pasted elements land "all over the place" rather than as a coherent group.

**Very likely already addressed, unmerged.** [ADR 0075](decisions/0075-container-hierarchy-integrity.md) / [epic 0103](planning/epics/completed/0103-container-hierarchy-integrity.md) rewrote `remapForPaste` (`clipboard.ts`) precisely for this: before it, the function spread `...n` and never touched `parentId`, so a pasted child kept a stale/dangling parent reference _and_ had this app's centroid-recenter math applied to what was actually a parent-relative coordinate — a double displacement that matches "all over the place." The reworked version remaps `parentId` through `idMap` when the container is in the payload (keeping the child's relative position), strips it otherwise, and computes the paste centroid over top-level nodes only. **First step when revisited: confirm whether this still reproduces on `epic/0103-container-hierarchy-integrity` (or after it merges).**

**One angle epic 0103 does _not_ cover:** `buildClipboardPayload` only copies the nodes that are actually `.selected`. Clicking a container does not auto-select its children in React Flow, so "select a container, copy, paste" copies the container alone and pastes an empty box. If the intended behaviour is "copying a container brings its contents," that's a separate `buildClipboardPayload` change (pull in descendants of any selected container), not a `remapForPaste` one — worth deciding on when this is picked up.

**References:** `src/renderer/src/clipboard.ts`'s `remapForPaste` / `buildClipboardPayload`, `src/renderer/src/Canvas.tsx`'s `pasteFromClipboard`, [ADR 0049](decisions/0049-clipboard-copy-paste.md), [ADR 0075](decisions/0075-container-hierarchy-integrity.md), [epic 0103](planning/epics/completed/0103-container-hierarchy-integrity.md)
