# 0172: Drag to adjust number fields

## Status
Not Started. Logged 2026-11-04; for later.

## Goal
Click a number box in the properties panel and drag to raise or lower its value, as well as typing a number or using the spinner arrows. It helps most on fields tuned by eye: stroke width, font size, opacity, the label position, animation speed.

## Tasks
- [ ] Decide the gesture: drag the field's label (the pattern in Figma and Blender), or drag inside the box itself; a plain click must still focus the box for typing, so a small movement threshold decides between click and drag
- [ ] Pointer capture with a hidden cursor and wrap-around at the window edge, so a long drag does not run out of screen
- [ ] A step per pixel per field (the field's `step`), a modifier for fine (Shift) and coarse (Ctrl) steps, respecting `min` and `max`
- [ ] One undo step per drag, through the same continuous-edit session the typed value uses
- [ ] Mixed multi-selection: dragging sets every selected element to the one value, like typing does
- [ ] Apply to every `NumberField` and `SliderField`, including the Preferences panel's
- [ ] Tests for the value maths (threshold, step, clamping)

## Notes
The fields currently take typed values and the browser's spinner arrows, with the step set per field. Keyboard users keep the arrow keys; the drag is an addition, not a replacement.
