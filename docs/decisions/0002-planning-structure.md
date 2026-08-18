# 0002: Epic/task tracking structure

## Status
Accepted

## Context
Need a way to track planned work (epics) and concrete steps within them (tasks) that satisfies the persistence rule in [CLAUDE.md](../../CLAUDE.md): fully recoverable from repo contents alone, no external service dependency.

## Decision
Plain markdown files under `docs/planning/`:
- One file per **epic** (`docs/planning/epics/NNNN-title.md`), numbered sequentially. Each has a status, a short goal statement, and a task checklist.
- **Tasks live as checklist items inside their epic's file**, not as separate files. A task gets promoted to its own file only if it grows complex enough to need its own extended notes/discussion (mirrors how ADRs are reserved for genuinely significant decisions, not every small choice).

Epic status values: `Not Started`, `In Progress`, `Done`, `Blocked`.

`PROGRESS.md` at repo root stays a short pointer (current epic/task, last updated) rather than duplicating the full backlog, to avoid two sources of truth drifting apart.

## Alternatives considered
- **GitHub Issues**: good tooling (labels, assignees, linking to PRs), but ties recoverability to an external service and a configured remote, which the persistence rule is explicitly trying to avoid. Also not yet decided whether/when this repo gets a GitHub remote.
- **One file per task**: better for tasks that need extended individual history/discussion, but too heavy for the common case of a short, self-contained task — would produce a lot of near-empty files. Rejected as the default; kept as an escape hatch for tasks that outgrow a checklist line.
- **External tracker (Jira, Linear, etc.)**: rejected outright — same self-containment problem as GitHub Issues, worse.

## Consequences
- Epics and their tasks are greppable, diffable, and readable in any editor or on GitHub's web UI without any app.
- Checkbox checklists are a slight loss of structure vs. a real issue tracker (no assignee/label metadata) — acceptable for a single-developer-plus-Claude project; revisit if that changes.
