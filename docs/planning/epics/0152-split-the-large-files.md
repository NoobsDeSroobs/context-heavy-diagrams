# 0152: Split the large files (helpers, CSS, property panel)

## Status
Not Started. Follows [0143](../completed-epics.md#0143-package-the-code-by-feature). The `Canvas.tsx` hooks are [0154](0154-canvas-feature-hooks.md), after the test foundation in [0153](0153-hook-and-component-tests.md).

## Goal
Take the pure, low-risk pieces out of the big files: `Canvas.tsx`'s module-level helpers (about 850 lines), `main.css` (4,160 lines) and `PropertyPanel.tsx` (949 lines).

## Tasks
- [ ] Move the `Canvas.tsx` helpers into modules next to their feature, verbatim: `toDiagramFile` / `fromDiagramFile`, the hierarchy healing, `syncElementMetadata` and the tag helpers, the z-index helpers, `collectResourceRefs` / `applyMissingFileRemoval`
- [ ] Characterization tests for them, pinning today's behaviour (round trip, hierarchy, metadata sync, z-index). Where a module imports `@shared` at runtime, `node --test` cannot resolve the alias: use relative imports there or wait for Vitest in 0153
- [ ] `main.css`: one stylesheet per feature beside its components; `main.css` becomes a list of `@import`s in the original order so the cascade is unchanged; rules shared by several panels go in one shared file
- [ ] `PropertyPanel.tsx`: one file per component (`NodeStyleFields`, `EdgeFields`, `LineStyleFields`, `ConnectionPointFields`)
- [ ] `typecheck`, `lint`, `test` and `build` after each step; the maintainer checks the app after the helpers and after the CSS (both themes)

## Notes
- Measured 2026-10-22: `Canvas.tsx` 6,913 lines, `main.css` 4,160, `PropertyPanel.tsx` 949, `renderDiagram.ts` 655 (left as is, it is one cohesive renderer), `ThreatMatrixView.tsx` 589 (redesigned in [0156](0156-threat-matrix-design-pass.md), not split).
- One step per commit.
