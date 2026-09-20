# 0119: Details peek card while holding Ctrl/Cmd over an element

## Status
Implemented 2026-09-20 on `epic/0119-details-peek-on-modifier-hold`;
`typecheck`/`lint` clean, live-tested by the user on Windows (Linux
unverified). Design + open-question answers in
[ADR 0093](../../../decisions/0093-details-peek-card-on-modifier-hold.md). The
optional delayed-hover Preference is deferred (see the ADR).

## Goal
Let the canvas act as a browsing surface for the context already captured in
Details/tags/links: **hold Ctrl (Cmd on Mac) while hovering an element** and a
small read-only card appears next to it showing what's behind it — without
right-click → "See details", and without opening the full panel (the brief's
rule: hover must never open the full detail panel).

## Why this shape (decided)
- **Modifier-held, not plain hover.** A plain-hover card fires constantly
  during normal pan/zoom/edit and is annoying (the same argument the brief
  makes against hover-opened panels). Holding a key makes it deliberate.
- **Same key as "follow the link".** Ctrl/Cmd is already the linked-diagram
  navigation key (`ShapeNode.tsx` click handler; `multiSelectionKeyCode` was
  moved to Shift specifically to free it). So the interaction reads as one
  gesture: hold Ctrl → see what's there and where it leads → click to go.
  The card should say "Ctrl+click to open *<linked diagram>*" when a link exists.
- **Tags on the card cover the "which tags does this have" need** on demand,
  which is why a permanent on-shape tag subtitle was rejected (highlights
  already answer the across-all-shapes question; a subtitle competes with the
  label for space).

## Sketch
- Content: first paragraph / first N lines of the details file rendered with
  the same Markdown renderer as `DetailsPanel` (GFM), truncated with an
  ellipsis; tag chips; link target + the Ctrl+click hint. Show the card if
  *any* of those exist, not only when details exist.
- Replaces the native `title` tooltip from `useDetailsTooltip` (otherwise two
  tooltips stack). That hook also reads every node's details file at mount;
  reading **on peek** instead removes N file reads on load and any staleness.
- Non-interactive card in v1 (`pointer-events: none`), size-capped.
- Key handling: track the hovered element id in a ref plus window
  `keydown`/`keyup`; pressing Ctrl *while already hovering* must work (no
  new mouseenter fires), and window blur must clear the held state.
- Optional Preference (default off): also show after a hover delay (0.5–1 s).

## Open questions (resolved — see ADR 0093)
- Edges: nodes only for v1 (edges have no details/link).
- Frontmatter fields: none — that mechanism was retired ([epic 0021](../completed/0021-detail-frontmatter.md)); tags cover it.
- Gesture conflicts: card hides while a pointer button is down, and after any
  other key / a click while the modifier is held, until it's released.

## Tasks
- [x] Design pass (open questions above) + ADR
- [x] Hover-target + held-modifier tracking hook (`useDetailsPeek`)
- [x] `PeekCard` component; remove `useDetailsTooltip` `title`
- [ ] Optional delayed-hover Preference — deferred
- [x] `docs/architecture/overview.md` mention
- [ ] List in the shortcuts page ([epic 0120](../0120-help-keyboard-shortcuts-page.md)) — when that page exists
- [x] Live test on Windows (Linux still unverified): hold Ctrl over shapes/text/containers; Ctrl+A / Ctrl+click / Ctrl+wheel / drag don't flash the card; unsaved note edits show
