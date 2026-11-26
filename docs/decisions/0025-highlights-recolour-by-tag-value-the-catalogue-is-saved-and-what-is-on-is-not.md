# 0025: Highlights recolour a diagram by tag value: the catalogue is saved, what is switched on is not

## Status
Accepted. Merges 0025 (highlight rendering, persistence and UI shape) and 0026 (grouped highlights, with its two addenda) into one decision, reworded 2026-11-26. It keeps the lowest number of the group. It builds on [0022](0022-unified-tag-and-metadata-system.md): tags are `data.metadata` entries.

## Context
Tags describe the architecture, and a person wants to see the same diagram coloured by one of them at a time: by GDPR scope, by owning team, by state. That needs a decision on how a highlight renders, especially when more than one matches an element, whether the panel is part of the app or a second window, and what is saved in the file.

## Decision
**A highlight recolours; it never hides or moves anything.** A highlight is `{ key, value, color }`, and the picture you drew stays the picture everyone discusses.

- **Rendering depends on the number of matches.** An element that matches exactly one switched-on highlight takes its colour on the border, drawn slightly thicker, as a live override that never touches the element's stored style. An element that matches two or more shows one small colour chip per match; there is no blending and no single winning colour. Non-matching elements are not dimmed (isolate does that, separately).
- **The panel is part of the app,** in the same dock as the other panels, not a second window: it controls how the diagram in front of you renders, so it belongs beside the canvas.
- **The catalogue is saved; what is switched on is not.** `DiagramFile.highlights` holds the definitions, so anyone who opens the file sees the same highlights available, and has no `enabled` field. Which are on is session state that starts at off on every load, so opening a diagram never shows someone else's overlays. The same split is used for visibility sets ([0194](0194-one-diagram-several-views-visibility-sets-and-stories.md)).
- **Grouping is display, not schema.** Highlights that share a key appear under a collapsible group header with a tri-state checkbox (all on, none, mixed); a key with one highlight is a plain row. "Add group" takes a key and creates one highlight per value. For a required tag with allowed values it takes the full list plus the tag's implicit "None", so every legal value has a slot whether used or not; for a free tag, or a required tag with free text, it takes the values actually in use. A new highlight is white, not a rotating palette, so it can never collide with a colour already used; a colour is never inferred from the order of values, since the app sees no ranking in them.
- **A group follows its source automatically.** Once a key has a group, adding an allowed value, or a new value appearing for a free tag, updates the group's rows; a row for a value that nothing carries and that is not allowed is removed, since a leftover row for a retired value is misleading. An existing row keeps its colour and state. A key with no group is never given one automatically: "Add group" stays deliberate.
- **A group can be removed.** The header has a cross that removes every highlight of its key, after a confirmation naming the key and the count; removing rows one at a time cannot work, since the automatic update would bring them back. With no highlight left the key is no longer a group and stays gone until "Add group" makes it again. The enabled state goes with the highlights.

## Alternatives considered
- **One fixed rendering style,** always an override or always chips. The first loses which colour wins once two match; the second is needlessly subtle for the common single match.
- **Dimming non-matching elements, or persisting what is switched on.** Dimming adds a second rendering mode before there is a UI to judge it; persisting would open a file with someone else's overlays already active.
- **A second window for the panel.** It is a control surface for the diagram in front of you, and a window would need syncing with the focused one.
- **A key-level highlight type** (one entity with a value-to-colour map). It would need a schema change, a new rendering path and its own answer to overlap with an ordinary highlight; a group is just existing highlights.
- **Explicit-only resync, or only ever adding rows.** Both were tried or proposed: explicit resync left every group stale until someone clicked, and keeping rows for retired values was actively confusing.

## Consequences
- No schema beyond `highlights`: grouping and resync are entirely panel-side, and the group source (allowed values or values in use) is decided in one place.
- Each element's render computes how many switched-on highlights match it, a small derived value that is never stored. The border override reuses the precedent of other live visual overrides (selection, alignment guides).
- A group's rows can change under a person's feet when values stop being used or are added, which is why a colour set by hand is kept as long as its value stays.
- Chip placement on a node, and how an edge carries a chip, are left to the running app to judge.
