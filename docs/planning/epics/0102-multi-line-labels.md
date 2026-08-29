# 0102: Multi-line element labels

## Status
In Progress — on `epic/0102-multi-line-labels`. Core done by Claude; one
CSS guardrail task left for the user (see below).

## Goal
Let a shape / container / text-node / edge label hold more than one line —
Shift+Enter inserts a newline, Enter still commits. Motivated by the
"real name + a qualifier line" case (a platform officially called "Service
Platform" that's actually a data platform). Depth still belongs in the details
panel; this is just a visible line or two. See [ADR 0074](../../decisions/0074-multi-line-labels.md).

## Tasks
- [x] `EditableLabel` — `multiline` prop: auto-growing `<textarea>`, Shift+Enter
  = newline, Enter = commit, Escape = cancel, IME-safe; display renders
  `white-space: pre-wrap`. Default (no prop) unchanged.
- [x] Enable `multiline` on shape / container / text-node / edge labels. Not on
  metadata values.
- [x] `.editable-label-input-multiline` base style (textarea: `resize: none`,
  `overflow: hidden` for the autosize, `pre-wrap`, line-height).
- [x] **Label → filename: first line only + merge the two sanitizers.** New
  shared `labelToFileStem(label, fallback)` (`src/shared/labelFileName.ts`) —
  first non-empty line, strip control chars, forbidden chars → `-`, collapse
  whitespace, 60-char cap, Windows reserved-name guard. Replaces the drifted
  copies in `src/main/links.ts` (linked-diagram names) and `src/main/details.ts`
  (detail file names). Detail names for labels with `<>:"/\|?*` shift slightly
  (deleted → `-`); `details:syncName` migrates them on next save. `file-format.md`
  stale "detail files named `<node-id>.md`" line corrected.
- [x] `typecheck` + `lint` clean (0 errors; pre-existing `bendPoints` warnings
  in `LabeledEdge` unchanged).
- [ ] **USER TASK — the on-canvas guardrail CSS** (`src/renderer/src/assets/main.css`).
  Right now a multi-line label overflows its shape's visible bounds. Make it
  clip to the box instead, and make sure the shape never grows to fit the label:
  - Add `max-height: 100%; overflow: hidden;` to `.shape-node-label` (line ~322)
    and `.text-node-label` (line ~459). For `.shape-node-label` you may also need
    `max-width: 100%` since its parent `.shape-node` is `display: flex`.
  - `.container-node-label` (line ~340) is `position: absolute` in the top-left —
    give it a `max-width` (e.g. `calc(100% - 16px)`) and `overflow: hidden` so a
    long label doesn't run off the container edge.
  - **Do not** put `overflow: hidden` on `.shape-node` itself — it would clip the
    NodeResizer handles.
  - Test: open a shape, Shift+Enter a couple of paragraphs → the shape must not
    grow, the text clips cleanly. Then a 2-line `Name` / `(qualifier)` → looks
    fine.
  - Optional stretch: `display: -webkit-box; -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;` on the shape label for a `…` ellipsis instead of a
    hard clip.
- [~] User live-test: multi-line editing "seems to work" (user, 2026-08-29).
  Still to confirm: Escape cancels, edge label wraps, PNG export renders the
  newline, reloading a `.chd` with a `\n` label shows multi-line.
- [ ] User live-test: a two-line label → "Create new linked diagram" names the
  file after **line 1 only**; a two-line label → its detail file is named after
  line 1; relabel a node whose detail file exists → it renames on save.
- [ ] Flip Status to Done, update `PROGRESS.md`.

## Notes
- No `.chd` / file-format change — `label` is already a free string.
- `docs/file-format.md` unchanged (it doesn't constrain label content).
- The "structured what-is-this-really" need (if the misnomer pattern repeats
  across a landscape) is a **tag** (`actual-type: …`), not part of this epic —
  the tag system already covers it.
