# 0120: Completed epics collapse into one index

## Status
Accepted. Supersedes the `completed/` folder part of [ADR 0076](0076-completed-epics-subfolder.md) (its definition of "completed" stands).

## Context
After 100+ epics the `epics/completed/` folder held about 550 KB of task checklists, live-test notes and mid-work narration. The lasting knowledge in them is already in the ADRs (the decision and its reasons), `docs/known-issues.md` (the hard bugs) and the code. For someone arriving at the repository the folder was mostly noise, and for an assistant it was a lot of text to skim past.

## Decision
- **A finished epic leaves the tree.** Its entry goes into [`docs/planning/completed-epics.md`](../planning/completed-epics.md): the number and title, how it ended (done, retired, superseded or cancelled), a sentence or two on what it delivered, and links to the ADRs it produced. The epic's file is then deleted. Its full text stays in git history.
- **"Completed" keeps ADR 0076's meaning:** done **and** confirmed working (live-tested, or merged), plus retired, superseded and cancelled.
- **Numbers are never reused.** The index is ordered by number and each entry is a heading, so other documents can link to `completed-epics.md#NNNN-title`.
- **Open epics are unchanged.** `docs/planning/epics/` holds the near backlog and `epics/later/` the parked ideas, both with their task lists.

## Alternatives considered
- **Keep the folder.** Nothing lost, but the noise stays and grows with every epic.
- **Delete without an index.** Smallest, but a reader can no longer see what has shipped without digging through history.
- **Shorten each file in place.** Keeps every link but leaves a hundred small files to maintain and still reads as a pile.

## Consequences
- The existing links to completed epics were rewritten to point at the index entries.
- The index entries were generated from each epic's goal text. They are accurate but terse, and some read like what the epic set out to do rather than what finally shipped; the ADRs are the authority on that.
- Finding a task list or live-test checklist from a finished epic now needs `git log` / `git show` on the old path.
