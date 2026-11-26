# 0132: Reviewing a change: one engine decides what counts, a read-only window shows it, and the command line gives the same answer

## Status
Accepted. Merges 0132 (the compare window), 0133 (what counts as a change), 0134 (baselines), 0135 (revert), 0136 (id matching), 0137 (`chd diff`) and 0153 (a look that carries meaning) into one decision, reworded 2026-11-26. It keeps the lowest number of the group. It builds on [0112](0112-electron-hardening-sandbox-and-navigation.md), [0115](0115-paths-stored-in-diagrams-are-untrusted.md) and [0109](0109-stale-edit-check-for-every-ai-write-path.md).

## Context
After an AI assistant edited a diagram, the person needs the picture, not only a JSON diff: the later version on the real canvas, the changed elements marked, the rest dimmed. An AI edit mostly changes what a diagram says (a label, a tag, a connection, a link), and a review that also marked every moved box would bury that. The tool keeps no history, so the earlier version has to come from somewhere. The editor's bridge to the main process has dozens of methods, many of which write to disk, so a window that only looks must not inherit it.

## Decision
**A review shows what changed in what a diagram says, tells it in words, and cannot change anything itself.**

- **One engine decides what counts,** in `src/shared/compare/` with no I/O, and the compare window, the changes-since-last-save panel and `chd diff` all use it, so they cannot drift apart. Each element is classed, strongest first: added, removed, links or notes, content (type, label, tags, security cells, parent, connection points, an edge's ends), and restyled. Position, size, rotation, layer order, lock and most style are not changes. A **look that carries meaning** is: fill, border, line style, markers, animation and icons, from a fixed list, since a dotted line against a solid one often says "planned" against "live". An element with both a stronger and a look change keeps the stronger class. A new stored field has to be put on one side of that line, or it is silently not a change. The review order is security, links, content, restyled, removed, added.
- **A change is told in words, old and new,** from one module, with the connections that went with an element listed under it. Diagram-level changes (legend, highlights, required tags and so on) are listed in a strip. A link is compared by its stored string only.
- **The review is a separate window that never mounts the editor,** so there is no save, autosave or recovery path to guard. It draws the later version plus a dashed ghost of each removed element, and every edge, from a copy. Its two versions are held by the main process, checked with `parseDiagram`. It has its own narrow bridge of five methods, and a guard test keeps it exactly equal to what the window's code can reach, with no write-style names.
- **There are two baselines.** The window's own copy: when the file changes on disk, Review changes compares this window's version with the file, exact even when there was uncommitted work. And a git revision: the file on disk against the file at a revision, compared by id over two whole files and never by parsing a unified diff. Git is the one place the app starts another program, so it runs only `git show` with fixed options, an argument array and no shell, a validated revision, a timeout and an output limit, and never a command that refreshes the index.
- **Matching replaced ids is a guess, offered on request.** A cheap check notices when many elements look replaced and offers Match them up; only the button runs the pairing, within a bound, and says that it is a guess. It can be undone and is never saved. `chd diff --match` does the same.
- **A revert is made in the editor window.** One whole element at a time is put back as the earlier version has it, through the editor's normal edit path, so it is one undoable step. The review window asks, the main process checks the request against its own copy and forwards it to the editor window of that file, and the window itself writes nothing. Restoring a node restores the connections it lost whose other end exists; a note's text is a file and is not restored.
- **`chd diff` gives the same review without the app:** two files, or a file against a git revision, as plain text in review order or JSON, with `--exit-code` to exit 1 when anything changed. It only reads, so the stale-edit rule has nothing to guard, and an assistant is told to run it after an edit and report what changed.

## Where a review is deliberately not symmetric
The pieces of a review do not mirror each other, on purpose, and a change here has to keep that in mind.
- **What the editor shows and the review does not.** Moves, resizes, rotation, layer order, lock and cosmetic style are not changes. A faint paint-brush marker (a legend toggle, on by default) flags a cosmetic restyle, because it is visible in the editor but would not be in the review; moves stay unmarked. The review also draws what the editor does not: an edge whose end names a connection point its node lacks is drawn at the nearest point the node has (and counted), since a review that loses edges loses the overview, while an edge whose end node does not exist cannot be drawn and is only counted.
- **The two baselines do not see the same.** The window's own copy cannot say that a note's content changed, because the window holds only the notes it has opened; it still flags a changed note link. Git compares the note text and shows the changed lines (line endings alone are not a change), reading a few notes at a time, never a path that leaves the diagram's folder.
- **A link is compared by its stored string only.** Whether the linked diagram itself changed is found when it is opened.
- **A revert is not the mirror of a change.** Its verb follows the class: Revert (modified), Restore (removed), Remove (added). Restoring a node also restores the connections it lost whose other end exists, and a connection whose end node is gone says which node to restore first. A node whose earlier container is gone, or would now enclose it, goes to the top level where it was drawn. An added container's contents stay. A note's text is a file and is never restored; git is the way back for it. From the changes-since-last-save panel the earlier version is the saved file, read again at click time.
- **Matching is a one-way guess.** A wrong pair reads as a modification and not as a removal plus an addition, so it can hide a real replacement.
- **`chd diff --exit-code` says that something changed, not that something is wrong.**

## Alternatives considered
- **Mount the editor with a read-only flag.** One missed write path would write from a window meant only to look. Not mounting it removes the paths.
- **A picture diff, or the raw `git diff`.** Noisy, and says nothing about which element changed.
- **Track moves and resizes, or count every style field.** Noise in an AI edit, which buries the change that matters.
- **Always match replaced ids.** Costs time on every comparison, and a wrong pair would pass as an edit without anyone choosing it.
- **The review window edits the file for a revert.** It would break "never writes" and bypass the editor's undo.

## Consequences
- **Security:** a compromised review window can do much less than a compromised editor window. It can read preferences, one icon file and its own comparison, and request a revert, which the main process accepts only for a comparison it holds. The git reader is the feature's main exposure, and `chd diff` in CI uses the same reader on a branch that may be untrusted.
- A review is an aid, not proof that nothing else changed: a move, a font change, the contents of a linked diagram and, on the window's own baseline, the text of a note are not shown.
- The list of look fields is a judgement and lives in one place.
- A revert needs the diagram open in an editor window, the price of keeping the review read-only. A wrong match shows as a modification and can hide a real replacement, which a reviewer sees only on hover.
- The review needs `git` installed for one baseline, and `chd diff` needs a build step like `chd export`.
