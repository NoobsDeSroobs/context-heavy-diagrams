# Planning: epics & tasks

See [docs/decisions/0002-planning-structure.md](../decisions/0002-planning-structure.md) for why this structure was chosen.

## Epics

One file per epic, named `NNNN-short-title.md`, numbered sequentially in the order they were defined (not necessarily execution order — check status). New epics are created in `epics/`.

- **`epics/`** — the live backlog: `Not Started`, `In Progress`, `Blocked`, and `Done`-but-not-yet-confirmed epics.
- **`epics/completed/`** — epics that are `Done` **and** confirmed working (live-tested, or merged to `master` since the user tests before merging), plus `Retired` / `Superseded` / `Cancelled` epics. Moved here with `git mv` on completion — see [ADR 0076](../decisions/0076-completed-epics-subfolder.md) (which supersedes [ADR 0061](../decisions/0061-completed-epic-filename-marker.md)'s `x`-prefix mechanism). The epic keeps its filename and number; only its path changes. The number namespace is flat across both folders.

```markdown
# NNNN: Title

## Status
Not Started | In Progress | Done | Blocked

## Goal
One or two sentences: what this epic delivers and why.

## Tasks
- [ ] A concrete, checkable step
- [ ] Another one
- [x] A completed one

## Notes
(optional — only if there's context worth keeping: decisions made mid-epic, things deferred, gotchas hit)
```

## Tasks

Tasks are checklist items inside their epic's file, not separate files. If a task turns out to need its own extended notes or discussion, promote it: give it a `## Task: <name>` subsection in the epic file (or its own file if it's substantial enough), and note the promotion in the epic's `## Notes`.

## Current status

See [PROGRESS.md](../../PROGRESS.md) at the repo root for the current at-a-glance pointer (active epic/task). This folder is the full backlog; `PROGRESS.md` is just "where are we right now."
