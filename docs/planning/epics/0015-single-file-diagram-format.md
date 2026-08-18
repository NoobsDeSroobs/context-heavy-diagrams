# 0015: Migrate to single-file diagram format

## Status
Not Started

## Goal
Rework the already-shipped folder-based persistence (epics 0001/0002/0012, iterated on twice already — see ADR 0003's two corrections) to match the identity/linking model decided in [docs/decisions/0005-diagram-identity-and-linking.md](../../decisions/0005-diagram-identity-and-linking.md): a diagram is a single file, not a mandatory folder. This is real rework of shipped code, not just new code layered on top.

## Tasks
- [ ] Decide the file extension (leaning `.chd`, still plain JSON content) — see ADR 0005's Consequences for the tradeoff (OS file-association/icon vs. losing free JSON syntax highlighting in generic editors)
- [ ] Rework `saveDiagramAs`/`saveNew` (`src/main/diagram.ts`, `src/preload/index.ts`): save a single file via `showSaveDialog`, no folder creation, no `mkdir`
- [ ] Decide/implement the assets/details sibling-folder convention: when the app itself needs to write an asset or a detail file (epics 0007/0008), where does it put them relative to the diagram file it doesn't control the name of at save time
- [ ] Update `examples/hello-world/` to the new format
- [ ] Update ADR 0003 (now doubly-amended) to point at ADR 0005 as superseding its file-per-folder assumption, or fold the relevant parts together — avoid two ADRs describing contradictory persistence models

## Notes
This blocks or at least precedes epic 0009 in practice — linked-diagram navigation needs the single-file model to actually mean what ADR 0005 says it means.
