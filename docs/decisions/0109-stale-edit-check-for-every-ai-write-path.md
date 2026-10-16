# 0109: Every AI write path checks for a stale edit

## Status
Accepted (2026-10-16). A standing rule: it applies to every feature that exists
today and to any added later.

## Context
An AI assistant works from a snapshot. It reads a diagram, spends a while
reasoning, then writes the file back. In between, the file may have changed: the
user saved from the app, another tool or another agent wrote to it, or a version
control operation swapped it. Writing back from the old snapshot silently
destroys that change, and nothing in the file format notices.

The ways an AI can write a diagram are already several and are growing: an agent
with a terminal following the bundled skill, the `chd` command-line tool, the
Claude Desktop extension the project is adding, and whatever comes next. The app
itself already guards the same hazard for a human: it detects an external change
to an open file and warns before a save would overwrite it. The AI paths need the
equivalent, and it should not be reinvented per feature.

The project's position on other safeguards is deliberate: people who let an
assistant modify their diagrams are the ones already using agents with file
access, `.chd` files are plain text that diff well in version control, and the
ability to write at all is opt-in. So no backups or confirmation steps are added.
The stale-edit check is the one safeguard kept, because it costs almost nothing
and prevents the one loss that version control cannot always recover: work done
in the gap between a read and a write.

## Decision
**A write to an existing diagram is conditional on the file being unchanged
since the version the writer worked from. A write that creates a diagram is
conditional on the file not existing.** If the condition fails, the write is
refused and the writer must re-read and redo its change on the fresh content.

- **The fingerprint is a SHA-256 of the file's raw bytes, as lowercase hex.**
  One definition, used everywhere, so any two components agree on whether a file
  changed. It is computed over bytes, not parsed JSON, so a reformat counts as a
  change.
- **Tool surfaces (MCP extension, any future API):** reading returns the
  fingerprint; every operation that modifies a file requires the fingerprint it
  was based on and returns the new one on success, so a chain of edits needs no
  extra read. Creating a file uses an exclusive create, which fails if the name
  now exists and has no check-then-write race.
- **Command line:** `chd hash <file>` prints the fingerprint, so a script or an
  agent can record it at read time and compare just before writing.
- **Instruction-driven paths (the skill, `AGENTS.md`, the "Copy AI instructions"
  text):** an agent writes with its own generic file tools, so nothing can
  enforce the check. The instructions tell it to re-read (or hash) the file
  immediately before writing back, to compare with what it based the edit on, and
  to redo the edit on the fresh content if they differ. For a chat session that
  only sees pasted text, the rule is to work from the newest version the user
  pasted. This is a best-effort convention, and is documented as such.
- **Scope:** diagram files, the files a diagram owns when a feature writes them
  (notes, assets), and any other file in a user's folder that an AI feature is
  allowed to write (for example supporting documents). Files the app generates only for its own setup (the
  `AGENTS.md` and skill copy written by "Enable AI assistance") keep their
  existing never-overwrite-what-we-didn't-write marker rule.
- **A known gap:** a fingerprint of the file on disk cannot see unsaved edits in
  an open window. The app's existing external-change warning is what covers that
  case, and it triggers when an AI write lands.

## Alternatives considered
- **Modification time instead of a hash.** Cheaper, but coarse timestamps, clock
  differences and tools that preserve times make it unreliable, and it cannot say
  whether the content actually differs. Rejected.
- **File locking while an AI works.** Locks are advisory and invisible to the
  other tools that touch the file, and a crashed writer leaves a stale lock.
  Rejected.
- **Backups or confirmation prompts before every write.** Rejected as a matter
  of policy for the reasons in the Context; opt-in plus this check is the whole
  safeguard.
- **Applying the check only to the MCP extension.** Rejected: the same gap exists
  on every path, and a rule that is written down once is the cheapest way to keep
  future features from forgetting it.

## Consequences
- Every new writer of diagram files, in this repository or a bundled tool, must
  implement or document the check, and a review of such a feature should ask
  where the fingerprint comes from.
- The CLI gains one small command, `chd hash`, and the skill, `AGENTS.md`
  template and copy-paste instructions gain a short "re-read before writing back"
  step.
- A refused write costs the assistant one extra read. The refusal message must
  say what to do, so it recovers without the user having to intervene.
- Because the fingerprint is over raw bytes, a harmless re-save by the app also
  invalidates an assistant's snapshot. That is the safe direction to be wrong in.
