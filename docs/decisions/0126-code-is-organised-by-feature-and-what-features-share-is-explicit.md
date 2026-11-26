# 0126: Code is organised by feature, and what features share is explicit

## Status
Accepted. Reworded 2026-11-26 to state the structure the original decision (canvas features as hooks) was an instance of. Builds on [0125](0125-code-packaged-by-feature-inside-the-process-folders.md), which sets the folders.

## Context
`Canvas.tsx` was one component of about 5,000 lines in which the state and handlers of every feature (search, references, the legend, highlights, the threat matrix, ...) sat side by side. Each feature needs only a few things from the rest: the React Flow instance, `pushSnapshot`, `markDirty`, the current path.

## Decision
- **The feature is the unit of code.** A feature's code, state and styles live together under its name: a folder in each process tree ([0125](0125-code-packaged-by-feature-inside-the-process-folders.md)), and on the canvas a hook in that folder that **owns the feature's state** and is called once from `Canvas`. There is still one copy of the state, held by `Canvas`; only the file it is declared in changes. A new feature is a new folder and a hook, not more lines in `Canvas`.
- **Sharing is a first-class concept, not an accident.** What several features use has a place meant for it: pure data and rules in `shared/`, generic widgets in `renderer/src/ui/`, and what a hook needs from the canvas in one `CanvasApi` object (React Flow instance, `pushSnapshot`, `markDirty`, `currentPath`, ...). A feature does not reach into another feature's state. A hook that changes nodes or edges calls `pushSnapshot` from `CanvasApi` ([0018](0018-undo-redo-explicit-snapshots.md)).
- **Logical groupings are how code is found,** by what it is for and not by the kind of file it is. Persisted data stays with its feature; `toDiagramFile` and the load path read and set it through the hook's return value.

## Alternatives considered
- **`Canvas` keeps all state and hooks only hold handlers.** Leaves the state declarations, the bulk of the clutter, where they are, and splits a feature across two places.
- **A store (Zustand or similar) or state in child components.** Would isolate re-renders, but nothing shows a performance problem today, and it is a much larger change.

## Consequences
- This is organisation, not isolation: state still lives in `Canvas`, so any change still re-renders it. Moving state out would be a separate decision if performance ever calls for it.
- Hooks must be called in the same order on every render, which holds because `Canvas` calls each one unconditionally.
