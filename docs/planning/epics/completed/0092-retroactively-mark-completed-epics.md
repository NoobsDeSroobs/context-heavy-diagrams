# 0092: Epic subfolders — sweep completed epics into `completed/`, parked ones into `later/`

## Status
Done (2026-08-30), merged to `master` (PR #78; a follow-up parking 3 more epics into
`later/` rode PR #79). This epic file itself moved to `completed/` on 2026-09-01,
alongside 0078/0080/0086/0089/0095.

## Goal
[ADR 0061](../../../decisions/0061-completed-epic-filename-marker.md) established an
`x`-prefix filename convention for completed epics but it was never rolled out.
The user decided (2026-08-30) to use a `docs/planning/epics/completed/` subfolder
instead. This epic wrote the ADR for that and did the retroactive move.

## Tasks
- [x] **[ADR 0076](../../../decisions/0076-completed-epics-subfolder.md)** —
  `completed/` subfolder supersedes ADR 0061's `x` prefix; keeps ADR 0061's
  definition of "completed" (`Done` **and** confirmed working, the practical
  proxy being merged-to-`master`); flat number namespace across both folders;
  new epics born in `epics/`, `git mv`'d on completion. ADR 0061 marked
  Superseded (for its mechanism only).
- [x] Enumerated all 104 epics. **72 in `completed/`** — every `Done` epic whose
  work is merged to `master`, plus `Retired`/`Superseded`/`Cancelled`
  (0021/0023/0048). (0084 was added in pass 2: its code shipped on `master` via
  PR #63, only its epic status line was stale. 0060 moved — prototype closed,
  follow-ups are 0079-0081.)
- [x] **`later/` subfolder** added (ADR 0076 amendment) for parked-far-out
  epics — 12 moved there at the user's direction: 0016, 0017, 0027, 0031, 0052,
  0056, 0065, 0069, 0070, 0077, 0088, 0089.
- [x] **20 stay in `epics/`** (the near backlog): 0019, 0022, 0051, 0053, 0059,
  0068, 0071, 0076, 0078, 0079, 0080, 0081, 0086, 0092, 0093, 0095, 0097, 0098,
  0099, 0104.
- [x] `git mv` each moved epic into `epics/completed/`.
- [x] Fixed every inbound link — within moved files (`../../decisions/` →
  `../../../decisions/`, root-file refs one deeper, sibling-epic links to kept
  epics gain `../`), and from `PROGRESS.md` / `docs/known-issues.md` / ADRs /
  kept epics (gain `completed/`). `docs/architecture/**` had none (epic 0066
  already decoupled those). `examples/**` only reference 0022 (kept).
- [x] Updated `docs/planning/README.md`, [ADR 0002](../../../decisions/0002-planning-structure.md),
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

**Follow-up (2026-08-30, after this epic merged as PR #79):** the user parked
three more epics — **0051** (non-rectangular shapes), **0053** (installable
distribution), **0059** (aggregate tags up) — into `later/`. `epics/` near
backlog is now 17, `later/` is 15. Moves + inbound-link fixes + PROGRESS backlog
split folded into the `epic/0086-step-segment-dragging` branch (per the
don't-branch-per-doc-update habit), not a fresh branch. The task-list counts
above ("20 stay in `epics/`", the 0051/0053/0059 line) reflect this epic's own
state at merge and are left as-is.
