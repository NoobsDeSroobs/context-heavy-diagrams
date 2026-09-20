# 0093: Details peek card while holding Ctrl/Cmd over a node

## Status
Decided and implemented (2026-09-20). Live-tested on Windows; Linux unverified.

## Context

The only lightweight way to see what's behind a node — its details, tags, link — was the native `title` tooltip from `useDetailsTooltip`, which showed just the first non-empty line of the details file. It couldn't show tags or the link target, and the hook read *every* node's details file at mount, so each node paid a file read on load and the text went stale as soon as the note was edited. The project brief's rule still stands: hover must never open the full Details panel.

Ctrl/Cmd is already the "follow the link" key (Ctrl+click on a node with a `linkedDiagram`; `multiSelectionKeyCode` was pinned to Shift to free it).

## Decision

Holding Ctrl (Cmd on Mac) while the pointer rests on a node shows a small read-only **peek card** next to it: the element's label, its tag chips (`key: value`), the details text (same GFM Markdown renderer and styling as the Details panel, capped to 260px with a fade), and — when a link exists — `Ctrl+click to open <file>`. The card shows if *any* of tags/details/link exist. It replaces the `title` tooltip entirely (removed from `ShapeNode`/`TextNode`; `useDetailsTooltip` deleted).

- **Wiring:** React Flow's `onNodeMouseEnter`/`onNodeMouseLeave` on the canvas (so every node type is covered without touching each node component) feed `useDetailsPeek`, which combines the hovered node with window-level key state into one derived target. `PeekCard` renders through a portal at the node's viewport rect, placed below the node, above it if that doesn't fit, else pinned to the window top.
- **Modifier arrives independently of the pointer:** the key can go down while already hovering (no mouseenter), so key state is tracked on the window and the mouseenter event's own `ctrlKey`/`metaKey` re-seeds it. Window blur clears everything so a missed keyup can't leave the card stuck.
- **Suppression:** the card hides while any pointer button is down (drag, box-select, pan) and, until the modifier is released, after any other key is pressed with the modifier held (Ctrl+A/C/V/Z…) or after a Ctrl+click (link navigation) — it never flashes over those gestures. A wheel event re-measures the node rect (Ctrl+wheel zooms).
- **Content source:** the note's in-memory shadow if it has been opened this session (so unsaved edits show), else the file is read **when the peek starts** — no load-time reads, never stale. The card component is keyed by node id, so its fetch state resets per node.
- **Non-interactive:** `pointer-events: none`; it can never intercept a click.

## Alternatives considered

- **Plain hover (no modifier):** fires constantly during ordinary pan/zoom/edit; the same argument the brief makes against hover-opened panels.
- **A permanent on-shape tag subtitle** instead of tags-on-peek: competes with the label for space; highlights already answer the across-all-shapes tag question.
- **A per-node hook/handler** (as the old tooltip did): would mean editing every node type and mounting N listeners; the canvas-level React Flow callbacks give one hover target for all of them.
- **Delayed plain-hover as a Preference (default off):** deferred — a new `AppPreferences` field (seeded/merged at every receive point, plus panel UI) isn't worth it before the modifier-hold version has been lived with.

## Consequences

- Edges are not peekable in v1: they have tags but no details or link, and a peek on an edge would need its own hit-testing decision. Revisit if wanted.
- No frontmatter fields on the card — that mechanism was retired in favour of the tag system (ADR 0022), which the card already shows.
- Ctrl+wheel zoom and Ctrl-held shortcuts are the two gesture overlaps; both are handled by the suppression rules above, but the interplay is only verifiable in the live app.
- The tooltip's small win — a card even for a node with only a details file — is preserved; the card is a strict superset of what the tooltip showed.
