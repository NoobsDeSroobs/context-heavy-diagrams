# 0115: Paths stored in diagrams are untrusted

## Status
Accepted

## Context
A `.chd` stores paths to other files: a note's `details` file, custom icons, reference images and linked diagrams. They are relative to the diagram's folder by design, but nothing stops a file from holding `../../anything` or an absolute path. Until diagrams are shared through repositories and e-mail, the only author of those paths is the user; once the project is public, a diagram can come from anyone.

A security review found that the multi-file save joined those stored paths onto the diagram's folder without checking where they ended up. A note whose `details` pointed outside the folder made Save copy that file into the notes folder and delete the original (the "rename the note to follow its label" step). See `docs/known-issues.md`.

## Decision
- **Containment rule for anything with a side effect.** Where the app writes, copies from or deletes a path that came out of a diagram file, the path must resolve to somewhere inside the diagram's folder (`containedPath`, `src/main/containedPath.ts`). Absolute paths, a `..` that climbs out, and on Windows drive-relative or stream paths (`C:x`, `file:stream`) are refused.
- **What happens on refusal** (in `executeSave`): an outside *source* is treated as having no source, so nothing is copied or deleted and the note simply keeps its old path; an outside *destination* fails the save. Neither can lose data.
- **Reads stay as they are.** Showing a note, an icon, a reference image or opening a linked diagram still follows absolute and outside paths, because older diagrams legitimately use them (a link to a diagram on another drive) and a read has no side effect on disk. With no network access ([ADR 0113](0113-enforced-offline-behaviour.md)) a hostile path can show the user something of their own, not send it anywhere.
- **Dependency injection for testability.** The executor keeps its rule of importing nothing from the project; the containment function is passed in, and the tests run against a real temporary directory.

## Alternatives considered
- **Contain reads too.** Rejected for now: it would break legitimate absolute and cross-folder links, and a read does not change anything.
- **Resolve symbolic links and compare real paths.** More thorough, but it adds file-system calls to a pure check; a symlink has to be created inside the user's own folder first. Recorded as a known limit rather than implemented.
- **Reject a diagram that contains an outside path at load time.** Rejected: legacy diagrams would stop opening, which [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md) forbids.

## Consequences
- Opening a hostile diagram and saving it can no longer move, copy or delete a file outside its folder.
- A legacy diagram whose note lives outside its folder still opens and displays; saving does not move that note (it keeps its old path) and writes new content only to a path inside the folder.
- Still allowed on purpose: the required-tag propagation rewrites linked child diagrams, but only files that parse as diagrams, and only when the user triggers it.
- Any new feature that writes or deletes a stored path must go through `containedPath` and add a test with a path that escapes.
