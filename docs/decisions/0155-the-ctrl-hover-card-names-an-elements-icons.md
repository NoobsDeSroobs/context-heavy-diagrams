# 0155: The Ctrl-hover card names an element's icons

## Status
Accepted (2026-11-08). Extends [ADR 0093](0093-details-peek-card-on-modifier-hold.md).

## Context
An icon on an element has to be recognised by sight. A person who did not draw the diagram, or who meets an unfamiliar icon, has no way to read what it is meant to say.

## Decision
- **The card that shows an element's tags, note and link while Ctrl (Cmd on a Mac) is held also lists its icons,** one per corner as `top left: server`, in the order the element draws them (top left, top right, bottom left, bottom right). An element whose only content is icons now gets a card.
- **A built-in icon is named by its id; a custom icon by its file name,** with the extension, which also tells it from a built-in icon of the same name. The same words are used in a review line ([ADR 0153](0153-a-look-that-carries-meaning-is-a-change-in-a-review.md)), from one function in `src/shared/icons/names.ts`.
- **Not in the compare window's hover card:** a change to an icon is already told there in words, and an unchanged one is not what a reviewer is looking for.

## Alternatives considered
- **A tooltip on the icon itself.** The hover target is a few pixels on a small icon, and a tooltip would have to compete with the element's own hover and drag.
- **The picker's display name.** The picker shows the icon id, so the id is what a person searches by.

## Consequences
- A diagram's icons can be read with the keyboard held and the pointer on the element, with no panel opened.
- A custom icon's name is its file name, so a vague file name gives a vague card.
