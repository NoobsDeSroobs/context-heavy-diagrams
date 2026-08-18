# 0015: Migrate to single-file diagram format

## Status
Done

## Goal
Rework the already-shipped folder-based persistence (epics 0001/0002/0012, iterated on twice already — see ADR 0003's two corrections) to match the identity/linking model decided in [docs/decisions/0005-diagram-identity-and-linking.md](../../decisions/0005-diagram-identity-and-linking.md): a diagram is a single file, not a mandatory folder. This is real rework of shipped code, not just new code layered on top.

## Tasks
- [x] Decide the file extension — `.chd`, plain JSON content unchanged
- [x] Rework `saveDiagramAs`/`save`/`open` (`src/main/diagram.ts`, `src/preload/index.ts`): single file via `showSaveDialog`, no folder creation, no `mkdir`. Net simplification — the old folder-name-stripping bug-fix code is gone entirely, not just replaced.
- [x] Assets/details sibling-folder convention: restated, not newly designed — asset/detail references were already explicit relative-path strings in the diagram's own JSON (unchanged since the original brief), so a stale sibling folder after a rename is the same graceful "reference not found" failure mode as a broken linked-diagram path, not a new risk category. Actual folder creation for assets/details is epics 0007/0008's concern, once they exist.
- [x] `examples/hello-world/diagram.json` → `examples/hello-world.chd` (folder removed entirely, nothing needed it)
- [x] ADR 0003 already marked superseded/historical, pointing at ADR 0005 (done as part of epic 0012's correction #3)
- [x] Manual test: save a new diagram, reopen it, confirm round-trip works with the new dialog flow — confirmed
- [x] Standalone file-format documentation (`docs/file-format.md`) — added after the fact, per user request: less lock-in for anyone wanting to write a third-party importer/exporter means the format can't only be knowable from reading `src/shared/diagram.ts` or piecing together ADRs. Also fixed `README.md`, which was still the unedited electron-vite scaffold boilerplate and didn't point anywhere useful.

## Notes
This blocks or at least precedes epic 0009 in practice — linked-diagram navigation needs the single-file model to actually mean what ADR 0005 says it means.
