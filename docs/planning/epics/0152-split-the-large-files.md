# 0152: Split the large files

## Status
Not Started. Follows [0143](../completed-epics.md#0143-package-the-code-by-feature).

## Goal
Break up the files that are too big to navigate, so a feature's logic sits in its own feature folder.

## What is large (2026-10-21)
`Canvas.tsx` 6,909 lines (one component, about 190 hooks), `assets/main.css` 4,160, `PropertyPanel.tsx` 944, `renderDiagram.ts` 655, `ThreatMatrixView.tsx` 589.

## Tasks
- [ ] `Canvas.tsx`: group its state and handlers by feature, mark what is cross-cutting (selection, undo, dirty tracking, save); extract one hook per feature (`useReferences`, `useHighlights`, ...) that `Canvas` composes, starting with the self-contained ones
- [ ] `main.css`: split into a stylesheet beside each feature
- [ ] The rest: split by feature where it helps, leave alone where it does not

## Notes
Any extracted code that changes nodes or edges must still call `pushSnapshot()` ([ADR 0018](../../decisions/0018-undo-redo-explicit-snapshots.md)); `DiagramContext` is shaped for render performance ([ADR 0056](../../decisions/0056-diagram-context-rerender-performance.md)). One feature per commit, checked after each. The "not split further" sentence in `docs/architecture/overview.md` gets updated.
