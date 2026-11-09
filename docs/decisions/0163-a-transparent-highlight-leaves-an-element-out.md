# 0163: A transparent highlight leaves an element out

## Status
Accepted (2026-11-09). Builds on [ADR 0025](0025-tagging-and-overlay-visualization.md) and [ADR 0026](0026-grouped-highlights.md).

## Context
A highlight colours every element that carries a tag value, containers included. A system boundary tagged with the same key as its children takes the colour of their group, which hides what the colour means. Setting the container's tag to `N/A` stops it matching a real value, but `N/A` then has to be given a colour, and any colour draws.

## Decision
1. **A highlight whose `color` is `transparent` marks nothing.** An element carrying that value keeps its own border or stroke. This needs no file-format change: `color` is already a CSS colour string, and `transparent` is one. The comparison ignores case and surrounding spaces.
2. **It is dropped before the one-or-several rule.** An element that matches one real highlight and one transparent one has a single match and gets the full border, not the chips shown for two or more.
3. **It has no legend row.** There is no swatch to show; the legend explains colours.
4. **The highlights panel has a "no colour" button** (∅) beside the colour picker. Pressing it again, or picking a colour, brings a colour back. The native colour input cannot hold `transparent`, so the picker shows a struck-through swatch while the highlight has none.
5. **An assistant is told:** the `edit_diagram` help says `set_highlight` with colour `transparent` is the way to leave an element out.

## Alternatives considered
- **A per-highlight "applies to containers" switch.** A file-format change for something a tag value already does.
- **An `enabled: false` or `ignore` field.** The same, and a second way to say "draw nothing" next to a colour that already says it.
- **Skipping every container.** Some containers should be coloured.

## Consequences
- An older version of the app opening such a file paints the element's border with a transparent line three pixels wide, so the border disappears instead of staying as it was. Other readers that parse `color` as `#rrggbb` only may not accept the word.
- Only the exact word `transparent` counts, not `rgba(0,0,0,0)` or an eight-digit hex with zero alpha.
