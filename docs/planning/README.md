# Planning: epics & tasks

## Epics

One file per epic, named `NNNN-short-title.md`, numbered sequentially in the order they were defined (not necessarily execution order — check status). New epics are created in `epics/`.

- **`epics/`** — the near backlog: `Not Started`, `In Progress`, `Blocked`, and `Done`-but-not-yet-confirmed epics you'd actually pick the next one from.
- **[`completed-epics.md`](completed-epics.md)** — one entry per epic that is `Done` **and** confirmed working (live-tested, or merged), plus `Retired` / `Superseded` / `Cancelled` ones. When an epic reaches that state, add its entry there and delete its file; the full text stays in git history ([ADR 0120](../decisions/0120-completed-epics-collapse-into-an-index.md)).
- **`epics/later/`** — real epics parked far out: "much later" ideas and externally-blocked work.
- **Betas:** a beta feature ([0124](epics/0124-beta-features-and-their-toggles.md)) is not an epic of its own to finish; it has a `reviewBy` date in the registry. When an epic is finished, list the betas still open with their dates and ask the maintainer to delete, postpone or promote each one before the next epic starts.

Move an epic between `epics/` and `epics/later/` with `git mv`; it keeps its filename and number. Epic numbers are never reused, including those of completed epics.

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
