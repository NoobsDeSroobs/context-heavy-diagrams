# 0128: A diagram repaired on load counts as changed

## Status
Accepted. Amends the "self-heals on the next save" wording of [ADR 0075](0075-container-hierarchy-integrity.md).

## Context
Opening a diagram can change it: a dangling container reference is dropped ([ADR 0075](0075-container-hierarchy-integrity.md)), a required tag is added or reset ([ADR 0022](0022-unified-tag-and-metadata-system.md)), a stale security reference is pruned ([ADR 0082](0082-security-data-schema.md)), a highlight group is resynced ([ADR 0026](0026-grouped-highlights.md)). Only the highlight resync marked the diagram as changed, so closing a freshly opened diagram sometimes asked to save and usually did not. A diagram whose in-memory state differs from the file on disk should be treated the same way every time.

## Decision
- After a load, the canvas compares what a save would write with what was read. If they differ, the diagram counts as changed: closing, reloading and dropping another file ask to save, and autosave keeps a recovery snapshot.
- The comparison ignores `savedWith` (the save stamps it) and a `zIndex` the file leaves out. That one is a default ([ADR 0035](0035-layer-order-control.md)) that never changes how the diagram looks, and diagrams written by hand or by an assistant usually omit it.
- The repairs themselves stay silent apart from the Diagnostics notes.
- The example diagrams are kept in the state a save would leave them in; a test opens each one and fails if it would ask to save.

## Alternatives considered
- **Repair silently, never mark as changed** (the hierarchy repair's old behaviour). The file on disk keeps disagreeing with the app until some other edit is saved, and an unsaved repair is lost on close without a word.
- **A flag per repair.** Every new kind of repair has to remember to set it; one comparison covers them all.

## Consequences
- A hand-written or assistant-written diagram that lacks a required tag asks to save once after it is opened, then no more.
- The legacy `shape` to `entity` rename is normalised while the file is parsed, before the canvas sees it, so it is not counted.
- Serialising the diagram twice on every load; negligible next to rendering it.
