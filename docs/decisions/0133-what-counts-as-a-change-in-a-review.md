# 0133: What counts as a change in a review

## Status
Accepted (2026-10-27)
Supersedes: none
Superseded by: none

## Context
A review is only useful if what it marks is what a reviewer must look at. A diagram has two kinds of change: what it says (a label, a tag, a connection, a link) and how it looks (where a box sits, its colour). An AI edit mostly changes the first; the second would bury it.

## Decision
**One engine classifies every element** (`src/shared/compare/classify.ts`, no I/O), strongest first, and the compare window, `chd diff` ([ADR 0137](0137-chd-diff-the-same-review-without-the-app.md)) and the changes-since-last-save panel ([ADR 0102](0102-changes-since-last-save-scope.md)) all use it. A test checks that its field list matches the panel's.

| Class | Colour | Fields |
|---|---|---|
| Added | green | the element is new |
| Removed | red | the element is gone (a dashed ghost at its old place) |
| Links or Details | orange | `details` link, `linkedDiagram`, reference images, and the content of a Details file |
| Content | yellow | type, label, tags, security cells, parent container, connection points, direction sets, an edge's ends and its connection points |

**Position, size, rotation, layer order, lock, style, icons and line points are not changes.** An element that only moved or was restyled is dimmed like an unchanged one. A faint paint-brush marker for restyled elements (a legend toggle, on by default) exists because a restyle is visible in the editor but would not be in the review; moves stay untracked.

**Each coloured element also gets a badge** (+, −, ~, a link glyph) and the window has a legend with counts, because red and green, and yellow and orange, are easy to confuse. Counts give elements and connections apart.

**The review order is security first, then links, content, removed, added.** An orange change is easy to miss and often the important one: a changed note or link.

**Connections that came or went with an element are listed under it** ("5 connections removed with it"): ten connections around one deleted element mean the element was not wanted, not that ten connections were. A connection whose ends both survive, or one that only changed, is a row of its own.

**Diagram-level changes** (legend, highlights, required tags, gravity presets, security catalog, direction sets, metadata, maximum connection points) are listed in a strip, coarse: which collection changed and which entries came, went or differ.

**What changed is told in words, with the old and new value**, for elements and connections, in the hover card and the list. The text for both comes from one module (`src/shared/compare/format.ts`) so the window and `chd diff` cannot drift apart. A label whose first line is unchanged shows the changed lines, not "A → A".

**A link is compared by its stored string only.** Whether the linked diagram itself changed is found when it is opened.

## Alternatives considered
- **Track moves and resizes.** Position can carry meaning on a map, but a move is noise in an AI edit, and a review that marks every moved box hides the change that matters.
- **Show the findings a change introduces** (the conformance check on both versions). Not built: in CI the check runs on the checked-out version, not in the change view, and a reviewer can fetch the change and run it. Revisit if it is missed.
- **A text diff of Details notes in the app.** Git does it; the orange mark says where to look. The compare window shows a few changed lines ([ADR 0134](0134-baselines-for-a-review-the-windows-own-copy-or-git.md)).

## Consequences
- **Better:** an assistant's changes to meaning are not buried under layout noise, and one engine means the window, the list and `chd diff` agree.
- **Worse:** a review is an aid, not proof that nothing else changed. A moved box, a restyle (apart from the marker), the contents of a linked diagram and, on the window's own baseline, the text of a note are not shown as changes.
- Whether something is a layout field is decided in one place, `fields.ts`; a new stored field must be classed there or it is silently not a change.
- A reviewer who wants to know about a move or a restyle has to look in the editor; the marker covers restyles only.
