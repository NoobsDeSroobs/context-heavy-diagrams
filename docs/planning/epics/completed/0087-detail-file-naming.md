# 0087: Detail file naming reflects label, not type

## Status
Done, on `epic/0087-detail-file-naming`, typecheck/lint clean this session — pending live test/PR/merge (interactive/live checks are the user's to do)

## Goal
Detail files (epic 0008) were named `<node-id>.md` — effectively `<type>-<uuid>.md` (e.g. `shape-3f9a1b2c-....md`) — which made it very hard to tell which file on disk belonged to which element in the diagram. Rename the convention to `<label>-<uuid>.md`, keep it in sync when an element is relabeled, and transparently migrate existing files to the new convention. See [ADR 0060](../../../decisions/0060-detail-file-naming-convention.md) for the full design reasoning and the two design questions decided with the user before implementation.

## Tasks
- [x] `detailFileName` helper (`src/main/details.ts`) — builds `<sanitized-label>-<uuid>.md`, dropping the type prefix, with Windows-safe sanitization (disallowed chars, trailing dot/space, reserved device names, 60-char cap, `untitled` fallback for a blank label)
- [x] `details:write` IPC now takes the element's label, not just its node id, and uses `detailFileName` to compute the path
- [x] New `details:syncName` IPC — renames an existing detail file on disk (and returns the new relative path) if its current name doesn't match what the current label would produce; a no-op if nothing's on disk at the old path yet
- [x] `Canvas.tsx`'s `flushDetailsDrafts` (the one existing choke point every save already goes through) now also calls `syncDetailFileName` for every node with an existing `data.details` reference, not just ones whose draft was opened this session — this is what makes a relabel eventually rename its file, and doubles as the migration path for pre-0087 filenames with no separate migration code (see ADR 0060's Alternatives)
- [x] `preload/index.ts`/`index.d.ts` updated for the new `writeDetails` signature and new `syncDetailFileName` call
- [x] `docs/file-format.md`'s `data.details` field and example updated to reflect the new (still-opaque-to-a-reader) filename convention
- [x] `npm run typecheck`/`npm run lint` clean (lint back to the same 4 pre-existing epic-0028 baseline errors, no new ones — the sanitizer's first draft used a `\x00-\x1f` regex class that tripped `no-control-regex`, fixed by filtering control characters by code point instead, `stripControlChars` in `details.ts`)
- [ ] Live test: create a shape, add details content, save, confirm the file is named from its label; rename the shape, save again, confirm the old file is gone and a new correctly-named one exists with the same content; open an existing diagram with an old-convention detail file, save it, confirm it gets migrated

## Notes
Requested 2026-08-24, originally logged as a possible fourth item for the [0086](../0086-minor-ui-improvements.md) grab-bag epic, but split into its own epic once scoped — this needed real design decisions (rename-on-relabel behavior, migration strategy) rather than being a same-sized drop-in fix, so it got its own ADR (0060) the way epic 0086's other, genuinely-minor items didn't.
