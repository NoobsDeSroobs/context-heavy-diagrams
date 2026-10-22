# 0126: Canvas features are hooks that own their state

## Status
Accepted.

## Context
`Canvas.tsx` is one component of about 5,000 lines in which the state and handlers of every feature (search, references, the legend, highlights, the threat matrix, ...) sit side by side. Each feature needs only a few things from the rest: the React Flow instance, `pushSnapshot`, `markDirty`, the current path.

## Decision
- **Each feature becomes a custom hook** in its feature folder (`search/useSearch.ts`) that is called once from `Canvas` and **owns its own state**: the `useState` lines and handlers move into the hook, which returns them. There is still exactly one copy of the state, held by `Canvas` as before; only the file it is declared in changes.
- **What a hook needs from the rest of the canvas is passed in as one `CanvasApi` object** (React Flow instance, `pushSnapshot`, `markDirty`, `currentPath`, ...). A hook that changes nodes or edges calls `pushSnapshot` from it ([ADR 0018](0018-undo-redo-explicit-snapshots.md)).
- **Persisted data stays with its feature.** `toDiagramFile` and the load path read and set it through the hook's return value.
- Code moves verbatim, with the same `useCallback` dependencies, so callback identities and the `DiagramContext` re-render behaviour ([ADR 0056](0056-diagram-context-rerender-performance.md)) do not change.

## Alternatives considered
- **`Canvas` keeps all state and hooks only hold handlers.** Leaves the state declarations, the bulk of the clutter, where they are, and splits a feature across two places.
- **A store (Zustand or similar) or state in child components.** Would isolate re-renders, but nothing shows a performance problem today, and it is a much larger change.

## Consequences
- This is organisation, not isolation: state still lives in `Canvas`, so any change still re-renders it, as now. Moving state out would be a separate decision if performance ever calls for it.
- Hooks must be called in the same order on every render, which holds because `Canvas` calls each one unconditionally.
