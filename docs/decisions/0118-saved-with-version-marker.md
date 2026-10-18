# 0118: A `savedWith` version marker and a newer-file warning

## Status
Accepted

## Context
Fields have only ever been added to the `.chd` format, never removed, so the format `version` is still `1` and an older application can open a file written by a newer one. Such an application does not know the newer fields, and the next save silently drops them. [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md) covers the other direction (a new app opening an old file). Nothing covered this one, and the file did not even record which application wrote it.

## Decision
- **The file records the application version that last wrote it,** in a new optional top-level field `savedWith` (for example `"0.2.1"`), written right after `version`.
- **The application warns when it opens a file whose `savedWith` is newer than itself,** and only then. Equal, older, missing and unreadable values never warn. The warning is advisory and blocks nothing.
- **The comparison uses the whole version.** Major, minor and patch are all compared; there is no rule that only a newer minor matters, because a later patch release can change a file's contents too and nothing guarantees otherwise. A pre-release or build suffix is ignored.
- **The marker is only ever raised.** A save sets `savedWith` to the higher of what is recorded and the saving application's own version. Saving with the same version leaves it as it is, so there is no diff noise on every save, and an older application saving a newer file cannot lower it, since the file may still contain what the newer one wrote.
- **Who stamps it:** the main process, on every write of a diagram it makes: the multi-file save, a newly created linked diagram, and the required-tag propagation into child diagrams. The renderer remembers the loaded marker and sends it back with the save so a save-as does not lose it. Files created by an AI assistant or the command line have no marker, which means "unknown" and never warns.
- **The warning says what to do:** it names both versions, says that saving may lose what this version does not understand, and suggests updating the application (it gives the project address, since the application is offline and cannot look for a release) or using Save As to keep a copy. It appears once per file per window, so reloading the same file does not ask again.

## Alternatives considered
- **A `minAppVersion` written only when a feature needs it.** More precise (no warning for harmless differences) but it depends on every future change remembering to raise it, and the cost of forgetting is silent data loss. `savedWith` needs no discipline.
- **Preserve unknown fields on save.** The strongest protection, but it conflicts with the fixed key order the format guarantees and is a larger change. Not needed for the warning, and the load-and-save round trip of every shipped example is now tested to lose nothing.
- **Block saving or open read-only on a newer file.** Safer, but heavy for an early-release tool and unnecessary: the warning plus Save As lets the author decide.
- **Warn on any difference.** Rejected: it would nag on every file saved by an older version, which is the normal case after an update.

## Consequences
- Files written before this change have no marker and never warn; they get one on their next save.
- Applications built before this change cannot warn (they do not read the field). The first release that carries it is the earliest that protects anyone, so it should ship before the format changes again.
- Each application update that touches a file will change its `savedWith` once, which shows up as a single line in a version-controlled diff.
- `docs/file-format.md` documents the field and the rule for other tools: leave an existing `savedWith` untouched, and do not invent one.
