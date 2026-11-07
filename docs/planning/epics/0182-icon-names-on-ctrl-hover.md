# 0182: Icon names in the Ctrl-hover card

## Status
Not Started. Logged 2026-11-07; a small fix for the batch with 0172, 0173 and 0175.

## Goal
An icon on an element has to be recognised by sight today. Holding Ctrl (Cmd on a Mac) over an element already shows a card with its tags, note and link ([ADR 0093](../../decisions/0093-details-peek-card-on-modifier-hold.md)); let it name the element's icons too, so a person can read what an icon means instead of knowing it.

## Tasks
- [ ] Pass the element's icons to the peek card and list them by name; the card appears for an element whose only content is icons
- [ ] Name for a built-in icon: the picker's name or the icon id, readable (check what the icon picker already shows); for a custom icon, its file name without the folder and extension
- [ ] Same on an element with several icons: one name per icon, in the order drawn
- [ ] Test the naming; look at it in the app, in both themes

## Notes
Open: whether an element's icons also appear in the compare window's hover card ([`HoverCard.tsx`](../../../src/renderer/src/compare/HoverCard.tsx)), and whether a name belongs on the icon itself as a tooltip (a hover target of a few pixels on a small icon is a poor fit, which is why the card is the first choice).
