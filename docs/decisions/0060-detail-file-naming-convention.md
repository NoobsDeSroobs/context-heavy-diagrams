# 0060: Detail file naming convention

## Status
Accepted

## Context
Detail files (free-form Markdown notes attached to a Shape/Container) were named `<node-id>.md`, e.g. `shape-3f9a1b2c-....md` — the node's own id, which is always `<type-prefix>-<uuid>`. Reported live by the user: with enough elements, it's very hard to tell which file on disk belongs to which element in the diagram, since the filename carries the element's *type* (not useful — you can already see the type from the folder structure/context) and a raw UUID (meaningless to a human), but never the element's actual label, which is the one thing a person would recognize it by.

## Decision
Detail filenames are now built from the element's own label plus its id's UUID suffix — `<label>-<uuid>.md` (e.g. `Web App-1a2b3c4d-....md`) — dropping the type prefix entirely. The UUID is kept (not dropped) specifically to guarantee uniqueness even between two elements with the same or blank label; the label alone is not a safe unique key.

Two follow-on questions, both asked of and decided by the user directly:

**Should renaming an element also rename its existing detail file?** Yes — a file that drifts out of sync with its element's current label defeats the entire point of this change. Implemented as a sync-on-save step (`Canvas.tsx`'s `flushDetailsDrafts`, the one existing choke point every save already goes through): for every node with a `data.details` reference, not just ones whose draft was opened this session, the current label is compared against what the filename would be if computed fresh right now; a mismatch triggers an actual file rename on disk (`details:syncName`, `src/main/details.ts`) and a `data.details` update to match. Deliberately *not* wired to fire on every keystroke while editing a label (matches this app's established rule for the details/required-tags panels — see `RequiredTagsPanel.tsx`'s `useFieldDraft` comment — renaming mid-typing would otherwise mean one rename-on-disk per keystroke).

**Should existing (pre-this-change) detail files, already named `<type>-<uuid>.md`, be migrated?** Yes, but not via separate, temporary "migration code" written now and deleted later. The sync-on-save step above needs no help distinguishing an old-convention name from a stale new-convention one — it just compares "what's the current filename" against "what would the current label produce," and renames on any mismatch, for any reason. A legacy `shape-<uuid>.md` file simply fails that comparison the same way a genuinely-relabeled file would, and gets renamed to the new convention the first time its diagram is saved again, with zero special-cased "if this looks like the old format" logic anywhere. The real, permanent rename-on-relabel feature *is* the migration path — there's no separate code to delete in a later version, because none was written.

## Filename sanitization
Labels aren't filesystem-safe by default (a label can contain `/`, `:`, `"`, etc., or be blank). `detailFileName` (`src/main/details.ts`) strips characters disallowed on Windows (`< > : " / \ | ? *` plus control characters — the more restrictive of this app's two target platforms), collapses whitespace, strips a trailing dot/space (also Windows-specific), truncates to 60 characters, and falls back to `untitled` if nothing sanitizable remains. Windows' reserved device names (`CON`, `PRN`, `NUL`, `COM1`-`9`, `LPT1`-`9`) are checked case-insensitively against the sanitized label and get an underscore prefix if matched. The UUID is extracted from the node's own id by slicing off everything up to and including its first hyphen (`newNodeId`'s `<prefix>-<uuid>` format, `Canvas.tsx`) — reliable regardless of prefix length, since a UUID's own hyphens all come after that first one.

## Alternatives considered
- **Keep the type prefix, just add the label** (`shape-Web App-<uuid>.md`): rejected per the user's explicit "not the type" — the type is already visible from context (which panel/node you clicked "See details" from) and just adds visual noise to a filename meant to be scanned quickly.
- **Rename on every label keystroke**: rejected for the same reason `RequiredTagsPanel`'s fields already learned to avoid this — see that file's `useFieldDraft` comment for the concrete "11 leftover files from typing one word" failure mode this would reproduce, here as spurious renames instead of leftover tags.
- **A separate one-shot migration script/IPC call, run once and then deleted**: considered per the user's own framing of the question, but dropped once it became clear the permanent sync-on-save logic already needed to handle "any name that doesn't match the current label," which is a strict superset of "specifically an old-convention name" — writing a second, narrower migration path alongside it would have been pure duplication with nothing to actually delete later.

## References
`src/main/details.ts`, `src/renderer/src/Canvas.tsx`'s `flushDetailsDrafts`, [ADR 0006](0006-icon-storage-model.md) (the sibling-folder convention this reuses), [docs/file-format.md](../file-format.md)'s `data.details` field.
