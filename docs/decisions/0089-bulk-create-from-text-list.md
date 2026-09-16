# 0089: Bulk-create shapes/containers from a pasted text list

## Status
Decided and implemented (2026-09-15).

## Context

Adding several shapes or containers one at a time — click the palette button, rename, repeat — is slow when the user already has a list of names in mind (or pasted from somewhere else: a spreadsheet column, a bullet list). The user asked for a right-click action on the dock's "Add to diagram" palette (`ItemPalette.tsx`) that opens a small text window; each non-blank line becomes the label of one new node.

Scoped to **Shape and Container only** for v1 — Text and Line are left for a later epic if the pattern proves useful there too.

## Decision

**Entry point**: right-click directly on the Shape or Container button in `ItemPalette.tsx` opens the bulk-create dialog immediately — no intermediate context menu, since right-click has exactly one meaning here (`onClick` keeps its existing single-add behavior; `onContextMenu` is the new path). If a second right-click action is ever needed on these buttons, that's the point to introduce a real `ContextMenu`.

**Dialog**: new `BulkCreateDialog.tsx`, styled after `ExportPngDialog.tsx`'s centered-overlay shell (`about-dialog-*` classes) rather than the click-anchored popups (`ColorPickerPopup`/`IconPicker`) — a multi-line paste target reads better centered than pinned to a small button's corner. A single `<textarea>`, live "N shape(s)/container(s) will be created" count, Cancel/Create buttons, Escape or outside-click to cancel, Ctrl/Cmd+Enter to confirm.

**Parsing**: split on newlines, trim each line, drop blank lines. No line-count cap — matches the "no speculative defensive-everywhere guards" project default; a user pasting an unreasonable number of lines gets exactly that many nodes, same as if they'd clicked "Add shape" that many times.

**Layout**: a grid centered on the current viewport (`columns = ceil(sqrt(n))`), same per-type default width/height as the single-add buttons (`SHAPE_MIN_WIDTH * 2` / `CONTAINER_MIN_WIDTH * 2` etc.), fixed 40px gaps. Not a single row (unreadable past ~10 items) and not stacked with `spawnPosition`'s small jitter (that jitter exists so repeated single clicks are visibly separate, not to lay out a deliberate batch).

**Node data**: identical per-node defaults to `addShapeNode`/`addContainerNode` (`preferences.defaultStyles.*`, `seedMetadata(requiredTags)`), `zIndex` assigned via `nextZIndex` recomputed against the array as it grows within the same batch so stacking order among the new nodes is stable and deterministic (first line = lowest zIndex).

**Undo**: one `pushSnapshot()` before the batch, one `setNodes` call — the whole paste is a single undo step, matching `reverseEdges`' established batch pattern (see [ADR 0087](0087-reverse-edge-direction-on-selection.md)).

**No auto-parenting**: new nodes always land top-level at the viewport center, same as the existing single-click `addShapeNode`/`addContainerNode` (not the drag-drop variant, which reparents into whatever container the drop point lands in). Dropping a batch into a specific container is left as a manual follow-up drag (multi-select supports dragging a group together) rather than new logic in v1.

## Alternatives considered

- **Right-click the empty canvas pane** ("Add multiple shapes here") — rejected: no pane context menu exists yet, and it conflates "what type" with "where," which the palette buttons already separate cleanly (type from which button, position always viewport-center like every other add action).
- **One container holding N shapes**, for the Container case specifically — rejected as inconsistent: "create multiple" on a button should always mean N siblings of that button's own type, not two different behaviors depending on which button was right-clicked.
- **Empty lines become empty-labeled nodes** — rejected; almost always accidental (trailing newline from a paste), and an empty label is easy to add by hand afterward if genuinely wanted.
- **A generic `ContextMenu` with a single "Create multiple…" item** — rejected for now as one extra click with no real payoff while it's the only action; noted above as the natural next step if a second right-click action is ever added to these buttons.

## Consequences

- No `.chd` schema change — the created nodes are ordinary shapes/containers, indistinguishable on disk from ones added individually.
- `ItemPalette.tsx` gains two new required props (`onCreateMultipleShapes`, `onCreateMultipleContainers`), threaded through `DiagramDock.tsx` from `Canvas.tsx`, matching the existing `onAddShape`/`onAddContainer` plumbing.
- `Canvas.tsx` gains `addMultipleNodes(type, labels)`, sharing the same style/metadata defaults as the single-add callbacks — a future default-style or required-tag change only needs updating in one place if these are later refactored to share a helper (not done in v1 to keep this change minimal).
