# 0182: Icon names in the Ctrl-hover card

## Status
Built (2026-11-08), awaiting a look in the app. Logged 2026-11-07. ADR: [0155](../../decisions/0155-the-ctrl-hover-card-names-an-elements-icons.md).

## Goal
An icon on an element has to be recognised by sight today. Holding Ctrl (Cmd on a Mac) over an element already shows a card with its tags, note and link ([ADR 0093](../../decisions/0093-details-peek-card-on-modifier-hold.md)); let it name the element's icons too, so a person can read what an icon means instead of knowing it.

## Tasks
- [x] Pass the element's icons to the peek card and list them by name; the card appears for an element whose only content is icons
- [x] Name for a built-in icon: its id, which is what the picker searches by; for a custom icon, its file name (with the extension, to tell it from a built-in of the same name)
- [x] Same on an element with several icons: one name per icon, in the order drawn
- [x] Test the naming
- [ ] Look at it in the app, in both themes

## Notes
Decided: the compare window's hover card does not list icons (a changed icon is already told there in words), and there is no tooltip on the icon itself (a few pixels is a poor hover target). Both in the ADR.
