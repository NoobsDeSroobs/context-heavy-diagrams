# 0092: Move completed epics to a `completed/` subfolder

## Status
Done (2026-08-30), on `epic/0092-completed-epics-folder`, pending merge. This epic
file stays in `epics/` until the branch merges, then moves to `completed/` itself
(one final `git mv`).

## Goal
[ADR 0061](../../decisions/0061-completed-epic-filename-marker.md) established an
`x`-prefix filename convention for completed epics but it was never rolled out.
The user decided (2026-08-30) to use a `docs/planning/epics/completed/` subfolder
instead. This epic wrote the ADR for that and did the retroactive move.

## Tasks
- [x] **[ADR 0076](../../decisions/0076-completed-epics-subfolder.md)** —
  `completed/` subfolder supersedes ADR 0061's `x` prefix; keeps ADR 0061's
  definition of "completed" (`Done` **and** confirmed working, the practical
  proxy being merged-to-`master`); flat number namespace across both folders;
  new epics born in `epics/`, `git mv`'d on completion. ADR 0061 marked
  Superseded (for its mechanism only).
- [x] Enumerated all 104 epics. **71 moved** to `completed/` (every `Done`
  epic whose work is merged to `master`, plus `Retired`/`Superseded`/`Cancelled`
  — 0021/0023/0048). **33 kept** in `epics/`: all `Not Started`, the `In Progress`
  ones (0027/0053/0086), the paused gallery (0022), and the one `Done`-but-truly-
  unmerged epic (0084). 0060 moved (prototype closed, follow-ups are 0079-0081).
- [x] `git mv` each moved epic into `epics/completed/`.
- [x] Fixed every inbound link — within moved files (`../../decisions/` →
  `../../../decisions/`, root-file refs one deeper, sibling-epic links to kept
  epics gain `../`), and from `PROGRESS.md` / `docs/known-issues.md` / ADRs /
  kept epics (gain `completed/`). `docs/architecture/**` had none (epic 0066
  already decoupled those). `examples/**` only reference 0022 (kept).
- [x] Updated `docs/planning/README.md`, [ADR 0002](../../decisions/0002-planning-structure.md),
  `CLAUDE.md`.
- [x] Link-checker pass over every `*.md` in the repo — 0 broken links from the
  move. Also fixed 2 pre-existing broken links found in passing
  (`0057-edge-line-unification.md` → `0057-edge-routing-style.md` in `PROGRESS.md`
  and epic 0032).
- [ ] After merge: `git mv` this file into `completed/` too.

## Notes
Logged 2026-08-25, re-scoped 2026-08-30 (folder move, not `x` prefix), done same
day. The orphaned epic 0103 finalization commit (`2dd9265`, never pushed, missed
its own PR) was cherry-picked onto this branch as the first commit — that's why
the epic 0103 doc / ADR 0075 / PROGRESS finalization rides along here.
