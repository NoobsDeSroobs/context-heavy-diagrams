# 0153: A look that carries meaning is a change in a review

## Status
Accepted (2026-11-07). Replaces the part of [ADR 0133](0133-what-counts-as-a-change-in-a-review.md) that says style and icons are not changes; the rest of 0133 stands.

## Context
A dotted line against a solid one, red against green, a thicker border, another arrowhead, an animation or an icon often says something: planned against live, risky against safe. A review that dims a restyled element like an unchanged one hides that, and an assistant asked to "make the planned ones dotted" would be reviewed on nothing.

## Decision
- **A fixed list of look fields counts.** Node: fill, fill opacity, border colour, border opacity, border width, and for a line its line style and markers. Edge: colour, opacity, width, line style, both markers, animation, its speed and direction, pulse distance, dash length and gap. An element's icons, by corner. Anything else in a style bag (font, text alignment, label position, routing) is cosmetic.
- **A new class, Restyled** (fuchsia, badge ◐), for an element whose only counted changes are of this kind. It has its own count in the legend and its own heading in `chd diff`, and ranks after Modified and before Removed: a weaker signal than a changed meaning, but a decision for the reviewer all the same.
- **Mixed changes keep the stronger class.** An element renamed and recoloured is Modified; both changes are listed, the stronger first.
- **Told in words, old and new:** "line style: solid → dotted", "icon, top left: "server" → "database"". Colours are compared and shown as stored, in the dark theme's form ([ADR 0034](0034-theme-adaptive-color-value-flip.md)), so the light theme's flip never reads as a change. `chd diff --json` carries each field's `category` and, for a look, its `before` and `after`.
- **A restyled edge keeps its own look in the compare window** and gets a glow in the review colour, because recolouring it would hide the change.
- **The cosmetic rest keeps the paint-brush marker** and its legend toggle, as before; moves, resizes, rotation, layer order and lock are still not changes. In `chd diff --json` the count of those is `cosmeticLook` (it was `restyled`).
- **Revert** puts the whole element back as it was, as for any modified element.
- **Diagram-level looks** (legend entries, edge direction sets) were already listed as changed in the strip, whatever differs in them, and stay that way.
- `chd diff --exit-code` exits 1 for a restyle alone.

## Alternatives considered
- **Every style field counts.** A font-size tweak or a rerouted edge from an edit would bury what the list exists to show.
- **Every field counts, with a legend toggle for the cosmetic ones.** A second state to keep equal between the window and `chd diff`.
- **Restyle as part of Modified.** Forty dotted edges would sit among the label and tag changes with nothing to tell them apart.

## Consequences
- **Better:** a change in what the look says shows up in the window, the list and `chd diff`, for a person and for an assistant's edit.
- **Worse:** the list of look fields is a judgement. A new style field must be put on one side in `src/shared/compare/fields.ts`; one left out is cosmetic and is only marked, not listed.
- A font colour that carries meaning is not counted.
