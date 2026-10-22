# 0153: Hook and component tests

## Status
Not Started. Follows [0152](../completed-epics.md#0152-split-the-large-files-helpers-css-property-panel); must land before [0154](0154-canvas-feature-hooks.md).

## Goal
Automated tests for the renderer's core behaviour, so the `Canvas.tsx` hook extraction is checked by more than a manual run. The renderer has almost no tests today; `node --test` cannot load `.tsx` or the `@shared` / `@renderer` aliases.

## Tasks
- [ ] Add Vitest, jsdom and Testing Library as dev dependencies (reusing the Vite config's aliases); run `npm run notices`; write the ADR
- [ ] Wire it into `npm test` and CI beside the existing `node --test` suite
- [ ] Core behaviour tests: undo/redo, dirty tracking (toggling the legend and then a highlight must not mark the diagram dirty or open the save dialog), search, add/connect/delete nodes, load and save round trip
- [ ] Tests for the modules `node --test` cannot load (alias or extensionless runtime imports): `nodeFields`, `hierarchy`, `screenGeometry`, `endpointPosition`, `noteShadows`, and the `toDiagramFile` / `fromDiagramFile` round trip in `diagramConversion`

## Notes
The legend-then-highlight dialog seen on 2026-10-21 (see `PROGRESS.md`) is the first test to write: reproduce it before fixing anything.
