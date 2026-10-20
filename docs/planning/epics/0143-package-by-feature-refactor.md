# 0143: Look into organising the code by feature

## Status
Not Started. Logged 2026-10-20. This is an investigation first: the outcome may be "do part of it", "do it in steps" or "not worth it", and the decision gets an ADR before any file moves.

This is a parent for research and planning. If it goes ahead it is expected to spawn a series of epics (the decision, the pilot, the `Canvas.tsx` split, each remaining feature group), which replace the task list below.

## Goal
Make the code easier to navigate by grouping what belongs to one feature (legend, highlights, search, references, security matrix, and so on) in one place, instead of spreading it over `components/`, `panels/`, top-level files, `main/` and `shared/`.

## What exists today (measured 2026-10-20)
- **Four top-level areas by process:** `src/main` (26 files, about 2,300 lines), `src/preload` (2 files, about 500), `src/shared` (13 files, about 2,400) and `src/renderer/src` (106 files, about 21,300). Tests sit next to the code as `*.test.mjs`.
- **The renderer is partly by kind, partly by feature.** `components/` holds 37 files of every sort (panels, dialogs, pickers, menus, badges) in one flat folder. `panels/` has 11 files for the property panel and docks. `nodes/`, `edges/`, `geometry/`, `security/`, `export/`, `styles/`, `hooks/`, `icons/` and `layers/` are small and named by topic. 31 files sit loose at the top (`highlights.ts`, `search.ts`, `clipboard.ts`, `alignment.ts`, `styleBrush.ts`, `legendLinePick.ts`, and so on).
- **A feature is scattered.** The legend, for example, is `components/LegendPanel.tsx`, `legendLinePick.ts` (and its test) at the top level, `export/exportLegendItems.ts` and `exportLegendDom.ts`, and the `LegendEntry` type in `shared/diagram.ts`. References: `components/ReferenceImage.tsx`, `ReferenceWindow.tsx`, `ReferencesPanel.tsx`, `panels/ReferencesSection.tsx`, `main/references.ts`, plus preload bindings.
- **The real navigation problem is `Canvas.tsx`:** 6,839 lines, 83 imports, 72 `useState` and 163 callbacks. It holds the state and handlers of nearly every feature, so a feature's code is spread over its own files and a section of `Canvas.tsx`. Grouping files into folders alone would not fix that.
- **Path references:** about 179 `src/...` file paths in the docs across about 70 files, plus the `scripts/` helpers (`sync-ai`, `build-extension`, `generate-notices`) and `electron.vite.config.ts` aliases (`@shared`, `@renderer`).

## Design questions
1. **What "feature" means across processes.** The main, preload and renderer processes are a security boundary (sandboxed renderer, narrow bridge, [ADR 0112](../../decisions/0112-electron-hardening-sandbox-and-navigation.md)) with separate builds. Options:
   - **A. Features inside the renderer only**, keeping `main`, `preload`, `shared` and `renderer` as the top level. Smallest change; the main-side half of a feature (such as `main/references.ts`) stays where it is.
   - **B. Feature-first at the top**, each feature holding its own `main/`, `renderer/` and `shared/` parts. Best locality, but the build config, the sandbox rules and the "renderer never imports main" guarantee all have to be re-expressed and enforced.
   - **C. Leave the folders alone and only split `Canvas.tsx`.**
   - First guess: A, together with the `Canvas.tsx` split; B only if A proves too weak.
2. **The `Canvas.tsx` split is most of the value.** Each feature would own a hook (state and handlers) that `Canvas.tsx` composes, for example `useLegend` and `useHighlights`, next to the feature's components. Needs a look at what `DiagramContext` already shares and what is truly cross-cutting (selection, undo, dirty tracking, save), so those stay central.
3. **Boundaries.** Without a rule, feature folders rot back into one pile. Candidate: an ESLint import-restriction rule, so a feature uses another only through its index file.
4. **Which features, and where the shared pieces go.** A first guess at the grouping: legend, highlights, search, references, details and notes, links and drill-down, security matrix, layers, diagnostics, changes since save, style and palette, export, icons, preferences, AI integration, and the canvas core (nodes, edges, geometry, alignment, clipboard, undo). Generic widgets (dialogs, pickers, menus, editable label) would form a small shared UI folder.
5. **Cost and risk.** The renderer has few automated tests, so a move that breaks a runtime import or a CSS selector might only show in the running app. Pending branches get conflicts on every moved file. ADRs cite old paths; they are history and should not be rewritten, but the current docs (`CLAUDE.md`, `docs/architecture/`) should name the new ones.

## How to do it safely (if it goes ahead)
- **Moves are mechanical commits**, separate from any logic change, using `git mv` so history follows, with no behaviour change and no `.chd` format change.
- **One feature at a time**, starting with a small pilot (the legend is a good candidate: few files, one panel, one export path) to test the pattern before committing to the rest.
- **A quiet window:** no other branch in flight, since a rename touches many files.
- **Checks after every step:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and a short run of the app (open a diagram, a linked diagram, the panels, save, export), light and dark.
- Keep casing exact in every move, since Windows ignores it and Linux does not (see the cross-platform rule in `CLAUDE.md`).

## Tasks
- [ ] Map every file to a feature (a table in this epic or a scratch file) and find the files that belong to several
- [ ] Inspect `Canvas.tsx`: group its state and handlers by feature and mark what is cross-cutting
- [ ] Decide A, B or C, and the folder layout, with the import rule; write the ADR
- [ ] Pilot one feature (move its files, extract its hook from `Canvas.tsx`), check it, and judge whether the pattern is worth continuing
- [ ] Add the import-boundary lint rule
- [ ] Move the remaining features in steps, one commit per feature
- [ ] Update `CLAUDE.md`, `docs/architecture/overview.md` and the other current docs that name moved paths, and the `scripts/` and config references
- [ ] Decide whether the old top-level files (`clipboard.ts`, `search.ts`, and so on) fold into features or form a `core/` folder

## Related
[ADR 0112](../../decisions/0112-electron-hardening-sandbox-and-navigation.md) (the process boundary), [ADR 0056](../../decisions/0056-diagram-context-rerender-performance.md) (why `DiagramContext` is shaped as it is), `docs/architecture/overview.md` (the current component map).
