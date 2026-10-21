# 0152: Split the large files (helpers, CSS, property panel)

## Status
Not Started. Follows [0143](../completed-epics.md#0143-package-the-code-by-feature). The `Canvas.tsx` hooks are [0154](0154-canvas-feature-hooks.md), after the test foundation in [0153](0153-hook-and-component-tests.md).

## Goal
Take the pure, low-risk pieces out of the big files: `Canvas.tsx`'s module-level helpers (about 850 lines), `main.css` (4,160 lines) and `PropertyPanel.tsx` (949 lines).

## Tasks
- [x] Move the `Canvas.tsx` helpers into modules next to their feature, verbatim: `nodeFields`, `hierarchy`, `screenGeometry` (canvas), `diagramConversion`, `noteShadows` (document), `metadataSync` (tagging), `resourceRefs` (diagnostics), `endpointPosition` (edges), `detailsLabels` (details); `Canvas.tsx` 6,914 to 6,096 lines
- [x] Characterization tests for the modules `node --test` can load: `metadataSync`, `resourceRefs`, `detailsLabels`. The rest need Vitest and move to 0153: `nodeFields`, `hierarchy`, `screenGeometry`, `endpointPosition`, `noteShadows` and `diagramConversion` (the `toDiagramFile` / `fromDiagramFile` round trip), which import `@shared` or extensionless paths at runtime
- [x] `main.css` (4,160 lines) split into 34 stylesheets beside their features; `main.css` is now a list of `@import`s. Rules were regrouped by feature only where order cannot matter (same property family, same importance, equal specificity and a class pair that can share an element, read from the JSX); the built bundle has the same 631 rules. Features that could not be fully merged have several files, named after their first rule (`legend-row.css`); rules shared by several panels are in `ui/dock-panels.css`
- [ ] `PropertyPanel.tsx`: one file per component (`NodeStyleFields`, `EdgeFields`, `LineStyleFields`, `ConnectionPointFields`)
- [ ] `typecheck`, `lint`, `test` and `build` after each step; the maintainer checks the app after the helpers and after the CSS (both themes)

## Notes
- Measured 2026-10-22: `Canvas.tsx` 6,913 lines, `main.css` 4,160, `PropertyPanel.tsx` 949, `renderDiagram.ts` 655 (left as is, it is one cohesive renderer), `ThreatMatrixView.tsx` 589 (redesigned in [0156](0156-threat-matrix-design-pass.md), not split).
- One step per commit.
