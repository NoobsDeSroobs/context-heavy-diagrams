# 0172: Drag to adjust number fields

## Status
Built (2026-11-07), awaiting a look in the app. Logged 2026-11-04. ADR: [0152](../../decisions/0152-drag-a-number-fields-label-to-change-it.md).

## Goal
Click a number box in the properties panel and drag to raise or lower its value, as well as typing a number or using the spinner arrows. It helps most on fields tuned by eye: stroke width, font size, opacity, the label position, animation speed.

## Tasks
- [x] Decide the gesture: drag the field's label (the pattern in Figma and Blender), or drag inside the box itself; a plain click must still focus the box for typing, so a small movement threshold decides between click and drag
- [x] Pointer capture (pointer lock instead of wrap-around) with a hidden cursor and wrap-around at the window edge, so a long drag does not run out of screen
- [x] A step per pixel per field (the field's `step`), a modifier for fine (Shift) and coarse (Ctrl) steps, respecting `min` and `max`
- [x] One undo step per drag, through the same continuous-edit session the typed value uses
- [x] Mixed multi-selection: dragging sets every selected element to the one value, like typing does
- [x] Apply to every `NumberField` and `SliderField`, including the Preferences panel's
- [x] Tests for the value maths, and for the gesture on a field (threshold, step, clamping)
- [ ] Look at it in the app: pointer lock hiding the cursor and carrying past the window edge (Windows and Linux), Escape ending a drag, both themes
- [ ] Not covered: the zoom limits, the connection-point maximum in Diagram settings and the gravity preset values, which are bare inputs outside `NumberField`; move them onto it if wanted

## Notes
The fields currently take typed values and the browser's spinner arrows, with the step set per field. Keyboard users keep the arrow keys; the drag is an addition, not a replacement.
