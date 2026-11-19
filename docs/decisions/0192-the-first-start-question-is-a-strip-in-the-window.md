# 0192: The first-start icon pack question is a strip in the window

## Status
Accepted (2026-11-19)
Amends: [0188](0188-icons-come-from-installed-packs-drawn-as-cleaned-inline-svg.md) (how the first-start question about the default icon pack is asked), and widens the editor's bridge by one call ([0112](0112-electron-hardening-sandbox-and-navigation.md)).
Superseded by: none

## Context
The question "Install the default icon pack?" was a native message box over the first window, a moment after the page loaded. A program that starts the app on an empty profile and takes a picture of it, as the AppImage catalog's test does, got a picture of the question and none of the app; a person on a first start also sees a box in front of an empty canvas, and has to answer before looking at anything.

## Decision
- **The main process sends one `iconPacks:offer` message to the first window, with the same timing and the same conditions as before** (once per run, not when Tabler is installed, not when either answer was recorded, not for an automated launch). The window shows a strip over the bottom edge of the canvas: the question, a line on what the pack is and where it can be installed later, **Install** and **Not now**.
- **The window answers with `iconPacks:answerOffer(true | false)`.** Main takes the answer only from the window it asked, once; it records the answer in the same `.offered` file and, on yes, opens the manager and installs the pack that comes with the app, as before.
- **The editor's bridge gains this one call, and it can install nothing but that pack,** and only after main has asked. It carries no path or name, so the widening is the same kind as the one that lets the editor add a single icon to the `Misc icons` pack.
- Closing the window without answering records nothing, so the question comes back on the next start.

## Alternatives considered
- **Keep the box and skip it when the launch looks automated.** There is no reliable sign: the catalog's test passes no flag, and guessing from the environment would also hide the question from a person on a remote desktop.
- **Leave the question out and rely on the menu.** A person who never opens View, Icon packs, would see diagrams with missing icons and no hint why.
- **A strip in the toolbar beside the file name,** where the outside-change notice sits. The toolbar is crowded and the text does not fit.

## Consequences
- The window is visible on a first start whatever happens to the question.
- A person who does not notice the strip is asked again on every start until they answer or install the pack.
