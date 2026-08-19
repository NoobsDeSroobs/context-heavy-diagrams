# 0018: Undo/redo via explicit pushSnapshot() calls, not a reactive effect

## Status
Accepted

## Context
Epic 0006 needed a single mechanism that reliably captures a snapshot of `{nodes, edges}` before every real mutation, regardless of which code path performed it. That's harder than it sounds: most real edits (`updateNodeData`, used throughout `ShapeNode`/`TextNode`/`ContainerNode` for label/icon/link/connection-point edits, plus direct `setNodes` calls for add/duplicate/save) bypass React Flow's `onNodesChange`/`onEdgesChange` entirely — `updateNodeData` writes straight to React Flow's own internal store, not through the app's change handlers. A mechanism keyed only off `onNodesChange`/`onEdgesChange` would silently miss most of the app's actual mutations.

## Decision
**Explicit `pushSnapshot()` calls at every real mutation site**, immediately before the mutation — `addShapeNode`, `addTextNode`, `duplicateSelected`, `onConnect`, the `onNodesChange`/`onEdgesChange` wrappers (canvas-driven drag/resize/delete), and a `pushSnapshot` exposed through `DiagramContext` for node components' own `updateNodeData` call sites (label commit, remove link, connection-point add/remove). `pushSnapshot()` captures the current `{nodes, edges}` onto a `past` stack and clears `future`; `MAX_HISTORY = 50`.

**Continuous gestures are grouped into one undo step**, not one per tick: `beginContinuousEdit()`/`endContinuousEdit()` bracket a drag/resize/rotate gesture — `beginContinuousEdit` snapshots once and no-ops on every subsequent mid-gesture call (guarded by a ref, not state, so it doesn't trigger its own re-render), `endContinuousEdit` clears the guard on release. React Flow's own `dragging`/`resizing` change flags drive this automatically for node drag/resize; rotation (no such native flag — `TextNode`'s rotate handler is just repeated `updateNodeData` calls in a `mousemove` loop) calls the same begin/end pair itself.

## Alternatives considered
- **A `useEffect` reacting to `nodes`/`edges` changing**, snapshotting the *previous* value whenever either changed: appealing because it would catch every mutation path automatically, without needing to remember a call at each site. Rejected after it broke under React StrictMode's development-mode double-invoke — the effect's only real "output" was a ref mutation (`lastSettledRef`), and an effect whose side effect isn't safe to run twice is exactly the class of bug StrictMode's double-invoke exists to surface. Confirmed by manual testing: one `Ctrl+Z` after two "Add shape" clicks did nothing visible.
- **A cleanup-based fix to the effect approach** (reverse the ref mutation in the effect's own cleanup): fixes the StrictMode double-invoke case specifically, but cleanup also runs before every subsequent genuine effect execution as a normal part of React's lifecycle — which broke real multi-edit sequences, since each new edit's cleanup incorrectly undid the *previous* edit's push.

## Consequences
- Every future mutation site must remember to call `pushSnapshot()` (or wrap a continuous gesture in `beginContinuousEdit`/`endContinuousEdit`) explicitly — there's no compiler or runtime enforcement that a new `setNodes`/`setEdges`/`updateNodeData` call site has done this. This has already required deliberate follow-through at least twice: epic 0013's connection-point add/remove needed the same treatment once its branch merged (noted explicitly in epic 0006's own doc as a known gap at merge time), and epic 0014's `AnchorNode` creation/resolution needed it applied fresh.
- Regular callbacks (unlike effects) aren't double-invoked by React StrictMode, so this approach has no equivalent double-invoke hazard to guard against.
- The undo stack is a full snapshot of `{nodes, edges}`, not per-field diffs — simple and correct by construction, at the cost of holding up to 50 full copies of the diagram in memory. Not a concern at expected diagram sizes; would need revisiting if that assumption stops holding.
