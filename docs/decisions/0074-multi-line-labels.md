# 0074: Multi-line element labels

## Status
Accepted (2026-08-29)

## Context
Labels have always been single-line: `EditableLabel` used an `<input>`, Enter
committed, there was no way to add a newline. Two real needs pushed against that:

- **A qualifier line.** A system's official name does not necessarily match its
  function. The official name often cannot change (every ticket, wiki page and
  CMDB entry uses it — renaming it on the diagram breaks cross-reference), but a
  reader needs to see what the system really is without opening the details
  panel: the official name on line 1, a short qualifier on line 2.
- **Free-text annotations.** `TextNode` is the prose element and restricting it
  to one line was arbitrary.

The details sub-layer ([project brief](../project-brief.md), item 4) remains the
home for real depth — the *why*, owners, data products exposed. This is only
about a line or two visible on the canvas.

## Decision

**1. `EditableLabel` gains an opt-in `multiline` prop.** When set: the editor is
an auto-growing `<textarea>`, **Shift+Enter inserts a newline, Enter commits**,
Escape cancels, blur commits — and an Enter mid-IME-composition is left to the
IME. Height tracks content via `scrollHeight`. Default (`multiline` absent) is
unchanged: single-line `<input>`, Enter commits.

**2. Enabled for shape, container, text-node and edge labels.** Not for metadata
values (`MetadataSection`) — those are structured fields where a newline is just
a mistake.

**3. The display renders `white-space: pre-wrap`** (set inline by `EditableLabel`
when `multiline`, so a stray newline in a single-line label still collapses to a
space).

**4. On-canvas guardrail: the label clips to its own element's box; the node
never grows to fit the label.** A name, or a name + a qualifier line, looks
clean; a pasted paragraph visibly truncates into an ugly box — friction
proportional to the abuse, with no counter to fight. The full string stays in the
data (and in PNG export, search, and any future tooltip). This is CSS on each
label class (`overflow: hidden` / `max-height`), not logic in `EditableLabel`.

**5. No `.chd` / file-format change.** `label` was always a free string; `"a\nb"`
is valid today and rendered as `a b` under the old single-line CSS.

**6. Where a label becomes a filename, only the first non-empty line is used.**
A node's label seeds the filename of a newly-created linked diagram
(`src/main/links.ts`) and of its detail `.md` file (`src/main/details.ts`,
ADR 0060). A multi-line label there should produce `Order Service.chd`, not
`Order Service (order data store).chd` — the first line is the identity, later
lines are context. Both sites already had a near-identical label→filename
sanitizer that had **drifted** (one replaced forbidden characters with `-`, the
other deleted them; only one had a 60-char cap and a Windows reserved-name
guard). Consolidated into one shared `labelToFileStem(label, fallback)`
(`src/shared/labelFileName.ts`): first non-empty line → strip control chars →
forbidden chars to `-` → collapse whitespace → trim → 60-char cap → Windows
reserved-name guard. Detail-file names for labels containing `< > : " / \ | ? *`
change slightly (deleted → `-`); the existing `details:syncName` self-migration
(ADR 0060 / epic 0087) renames them on the next save, no separate migration step.

## Alternatives considered

**A dedicated `altText` / subtitle property** rendered in brackets under the
label. Rejected: it's a *narrow* presentation win for a *permanent* cost — the
property panel is already dense, and every field there is a tax on every user
scanning it. It also wouldn't cover a deliberately two-line layout or TextNode
prose. And the one thing it does better — a *structured*, queryable "what is this
really" — is better served by a **tag** (`actual-type: data-store`), which is
already this project's searchable/highlightable/no-new-panel mechanism, than by
either a label field or a new property.

**A hard character limit on the label** (the "30 chars, or something" idea).
Rejected: real system names blow past any reasonable cap ("Enterprise Data
Integration Platform" is 35), and a hard `maxlength` is user-hostile — people
fight it or route around it. A *soft* diagnostic threshold ("label is 80+ chars —
consider the details panel") could be added later; not now.

**A fixed `-webkit-line-clamp: N`** for the clip. Rejected in favour of
box-relative `overflow: hidden`: a deliberately large shape should show more of
its label, not be clamped to a magic line count.

**Multi-line for `TextNode` only**, leaving shape/container labels single-line.
Rejected: the qualifier-line case on shapes is the main motivator, and it's a
legitimate use, not a bad habit.

## Consequences
- Users *can* now over-fill a shape with text. Mitigations: the clip makes it
  look bad, the details panel stays the documented home for depth, and this ADR
  is on record so the intent is clear. If it becomes a real problem, the soft
  diagnostic threshold is the next lever, not a hard limit.
- `EditableLabel` is the single place multi-line policy lives; a new label-like
  call site opts in explicitly.
- PNG export (clones the label DOM, which carries the inline `pre-wrap`), search
  (matches the raw string), and undo/redo all already operate on the label
  string and need no change — newlines just travel with it.
- `labelToFileStem` (`src/shared/labelFileName.ts`) is now the single home for
  label→filename sanitizing; any future feature that derives a filename from
  user text should reuse it rather than write a third variant.
