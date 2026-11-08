# 0156: The Ctrl-hover card's size is a preference

## Status
Accepted (2026-11-08). Extends [ADR 0093](0093-details-peek-card-on-modifier-hold.md) and [ADR 0155](0155-the-ctrl-hover-card-names-an-elements-icons.md).

## Context
The card shown while Ctrl (Cmd on a Mac) is held over an element was a fixed 340 px wide and at most 260 px tall. A long note, or an element with many tags and icons, is cut off, while someone with a large screen has room to spare.

## Decision
- **Two preferences,** the card's width and the height beyond which its content is trimmed, set in the Preferences panel. They default to the old size (340 and 260 px) and are kept between 240 and 800 px wide and 120 and 800 px tall, at every point preferences are read, as the other numeric preferences are.
- **The card is as short as its content,** so a large maximum height costs nothing for an element with little to show.
- **The note is cut to a number of characters before it is rendered, in proportion to the card's area** (1200 at the default size), so a bigger card shows more of a long note and the cost of rendering stays bounded.
- **No drag handle on the card.** It exists only while the key is held and the pointer rests on the element, and it ignores the pointer so it never gets in the way ([ADR 0093](0093-details-peek-card-on-modifier-hold.md)); a handle would need both to change.

## Alternatives considered
- **A size that follows the window.** The card sits beside the element, and a wide window would make very wide cards.
- **A fixed larger size.** Suits some screens and not others.

## Consequences
- The size is per installation, shared by every diagram, like the other display preferences.
- A person who wants the old behaviour does nothing.
