# 0110: A skill/command to reformat a diagram's layout after rough AI-assisted authoring

## Status

Not Started — parked. Logged 2026-09-05 from a user aside: "Maybe we can add
a skill or something that lets a claude user ask Claude to reformat the
diagram after adding a bunch of shapes and edges etc. loosely representing
your system."

## Goal

Let a user (or Claude, mid-conversation) take a `.chd` file where shapes and
edges were added quickly with no real attention to positioning — the
mechanical structure is correct but the layout looks ad hoc — and have
Claude re-run a layout pass over it: re-derive positions/sizes/spacing using
the same conventions as the `chd-diagrams` Claude Code skill's
`references/layout-guide.md` (now in this repo at
`resources/ai/skills/chd-diagrams/`, [ADR 0105](../../../decisions/0105-bundled-ai-material-and-folder-setup.md)
— the app's own default sizes, the 20px/60px gap convention,
archetype recipes) without touching structure (node/edge ids, `parentId`,
metadata, tags, links) or anything the user has clearly arranged on purpose
already.

## Possible directions (not chosen)

- **A skill instruction only** (no new app feature) — teach the existing
  `chd-diagrams` skill to recognize "reformat/tidy up/clean up the layout"
  requests and apply `layout-guide.md`'s conventions to existing nodes in
  place. Cheapest option; entirely a Claude-side behavior, ships independent
  of the app itself.
- **An in-app "Auto-arrange" command** (Edit menu, next to Align/Distribute —
  [ADR 0058](../../completed-epics.md#0058-an-implicit-none-value-for-required-tags)) that
  runs a real layout algorithm (e.g. a dagre/elk-style layered layout) over
  the whole diagram or the current selection. Real app feature, not
  Claude-specific — would help a human-only user too, not just an
  AI-assisted one.
- **Both** — the in-app command as the mechanical engine, the skill
  instructing Claude to invoke it (or approximate its output when
  hand-editing JSON directly) rather than inventing coordinates freehand.

## Notes

Directly motivated by writing `layout-guide.md` itself (2026-09-05) — that
doc gives Claude conventions to *author* a new diagram well; this epic is
the mirror case, *fixing up* one that already exists but looks rough. Worth
revisiting once `layout-guide.md` has been used/verified on a few real
diagrams (see the AWS deployment example built the same day under
[epic 0022](../0022-example-diagram-gallery.md)).
