# 0153: Hook and component tests

## Status
Done, awaiting the maintainer's check and merge (2026-10-22). Follows [0152](../completed-epics.md#0152-split-the-large-files-helpers-css-property-panel); must land before [0154](../completed-epics.md#0154-canvas-feature-hooks).

## Goal
Automated tests for the renderer's core behaviour, so the `Canvas.tsx` hook extraction is checked by more than a manual run. [ADR 0127](../../decisions/0127-vitest-for-renderer-tests.md).

## Tasks
- [x] Vitest, jsdom and Testing Library as dev dependencies; `vitest.config.ts` with the renderer's aliases; `npm run notices`; the ADR
- [x] `npm test` runs `node --test` and `vitest run` (`test:node`, `test:renderer`); CI runs `npm test`
- [x] Tests for the helper modules `node --test` could not load: `nodeFields`, `hierarchy`, `screenGeometry`, `endpointPosition`, `noteShadows`, and the `toDiagramFile` / `fromDiagramFile` round trip (a diagram using every feature, plus every example diagram)
- [x] A harness that renders the real `Canvas` with a fake preload bridge (`canvasHarness.tsx`), and tests for closing with and without changes, add, undo and redo, delete, save, and search
- [x] The legend-then-highlight dialog: reproduced, decided (ADR 0128) and fixed (see Notes)

## Notes
- Toggling the legend, the highlights panel or a highlight never marked the diagram changed (tested). The dialog came from opening a diagram the load had to repair: only the highlight resync counted as a change. Decided and fixed here: every repair at load counts, the example diagrams are kept in sync, and a test opens each example ([ADR 0128](../../decisions/0128-a-diagram-repaired-on-load-counts-as-changed.md), [known-issues](../../known-issues.md#opening-a-diagram-with-highlight-groups-asks-to-save-when-it-is-closed)).
- Not covered: dragging a connection between two handles, and anything that depends on layout or CSS (jsdom has neither); that is for [0155](0155-end-to-end-smoke-test.md).
