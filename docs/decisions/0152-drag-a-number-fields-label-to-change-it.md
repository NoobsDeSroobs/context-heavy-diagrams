# 0152: Drag a number field's label to change it

## Status
Accepted (2026-11-07).

## Context
Stroke width, font size, opacity, a label's position and an animation's speed are tuned by eye, and typing a value or clicking the spinner arrows is slow for that.

## Decision
- **The label is the handle.** Dragging the text beside a number box changes the value; the box keeps typing, the spinner arrows and the arrow keys. A click on the label still focuses the box, because the label forwards it, and a movement under 3 pixels counts as a click.
- **One step per pixel**, using the field's own `step`; Shift makes it a tenth of that, Ctrl (Cmd on a Mac) ten times. Each movement is scaled by the keys held at that moment, so pressing a key part-way does not rescale what was already dragged. The result is rounded to the step's decimals and kept inside `min` and `max`.
- **Pointer lock** hides the cursor and lets a long drag go past the window edge, in place of moving the cursor back by hand. If the browser refuses it the drag still works inside the window.
- **One undo step per drag**, through the same session start and end the typed value uses.
- **A mixed selection** starts from zero (inside `min` and `max`) and sets every selected element to the one value, as typing does.
- **Where:** every `NumberField` and `SliderField`, so the properties panel and the Preferences panel's shared fields; the Isolate opacity preference too. The fields with their own bare inputs (the zoom limits, the connection-point maximum, the gravity presets) are not covered.

## Alternatives considered
- **Drag inside the box.** A drag there selects text, and a click must place the caret; telling the two apart by a threshold makes both feel wrong.
- **Wrap the cursor at the window edge.** A web page cannot move the real cursor; pointer lock achieves the same.
- **A separate drag handle icon per field.** Adds clutter to every row for what the label already offers.

## Consequences
- A label that can be dragged shows a sideways-arrows cursor and a tooltip saying so.
- Keyboard users are unaffected.
