# 0181: File names from labels are cut by bytes and compared ignoring case

## Status
Accepted (2026-11-16)
Supersedes: none (amends the length rule of [0074](0074-multi-line-labels.md))
Superseded by: none

## Context
A new linked diagram or note is named after its element's label ([0074](0074-multi-line-labels.md)). Two things made that name unsafe on some systems. The stem was cut at 60 UTF-16 units, but Linux and macOS limit a file name to 255 bytes: 60 four-byte characters plus a note's `-<uuid>.md` is about 280 bytes, and the cut could split an emoji in half. And "is this name taken" compared exactly, while macOS and Windows treat `Foo.chd` and `foo.chd` as one file, so a second diagram could overwrite the first.

## Decision
- **Stems are cut on whole characters at 60 characters or 200 UTF-8 bytes, whichever comes first.** The 60 keeps names readable; the 200 leaves room for a note's 40-byte suffix under 255. Norwegian letters (two bytes) never reach the byte limit in practice.
- **Taken names are compared ignoring case**, on every system, so a folder that moves between systems does not collide. The new name gets the first free `-1`, `-2`, ... suffix. This holds in the app and in the assistant tools (a link to a diagram another element already links to, or one on disk).
- **Leading dots are left alone.** A label such as `.NET` keeps its name; on Linux and macOS a file starting with a dot is hidden, which a person who types one expects. Replacing it would change the label's identity.
- **Unchanged:** characters other systems allow stay as they are, including spaces and non-ASCII letters; only the characters Windows forbids become `-`.

## Alternatives considered
- **Cut by bytes only (60 bytes):** cuts Norwegian and CJK labels short for no safety gain.
- **Cut by characters only:** does not protect the 255-byte limit.
- **Case-insensitive only where the file system is:** the answer would depend on the machine, and the same folder could work on one and collide on another.
- **Replace or strip leading dots:** protects against an unlikely surprise at the price of mangling labels.
- **Normalize Unicode (NFC) in names and comparisons:** not done; the case that matters, a folder synced from a Mac, is not seen yet.

## Consequences
- Names made before this change keep working; only new names are affected, and only for long or multi-byte labels or a case-only clash.
