# 0143: Package the code by feature

## Status
In Progress (started 2026-10-21). The layout is decided in [ADR 0125](../../decisions/0125-code-packaged-by-feature-inside-the-process-folders.md). Needs a quiet window: no other branch in flight, since a move touches many files.

## Goal
Group each feature's files in one named folder per electron-vite tree, and split `shared/diagram.ts` into per-feature `schema.ts` files, with no behaviour change and no `.chd` format change.

## Tasks
- [x] Decide the layout; write the ADR
- [ ] Pilot with the legend: move it in every tree, then check it
- [ ] Add the lint rules: `shared` imports neither `main` nor `renderer`; `renderer` never imports `main`
- [ ] Move the remaining features, one commit per feature (`git mv` first, then the import fixes)
- [ ] Move generic widgets to `renderer/src/ui/`; decide where the loose top-level files go
- [ ] Split `shared/diagram.ts` into `shared/<feature>/schema.ts` plus `shared/diagram/`; keep `@shared/diagram` working
- [ ] Update the current docs and config that name moved paths: `CLAUDE.md` (including the `file-format.md` rule, now "any `schema.ts`"), `CONTRIBUTING.md`, `docs/architecture/`, `scripts/`, the tsconfigs, `.vscode/launch.json`
- [ ] After each step: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; at the end a short run of the app (open, linked diagram, panels, save, export) in light and dark

## Notes
- Keep casing exact in every move: Windows ignores it, Linux does not.
- The per-file mapping is a throwaway script, not committed; the resulting tree is the record.
- Not in this epic: splitting `Canvas.tsx` and the other large files ([0152](0152-split-the-large-files.md)), and the style type names ([0151](0151-style-types-as-sister-interfaces.md)).
