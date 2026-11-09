# 0164: Alt+drag slides an edge label along its edge

## Status
Accepted (2026-11-09). Builds on [ADR 0045](0045-default-edge-style-setting.md)'s label position and [ADR 0099](0099-modifier-drag-duplicate.md)'s choice of Alt.

## Context
A connection's label sits at `style.labelPosition`, a fraction (0 to 1) of the line's length, set only with a slider in the properties panel. Moving a label to where it fits, clear of another line, is a thing people do by dragging.

## Decision
1. **Hold Alt and drag the label.** The label slides along the line; the file stores the same `labelPosition`, so there is no file-format change.
2. **A plain drag does nothing.** A click on a label starts editing or selects, and a slip of a pixel must not move it. Alt is the modifier that already means "copy" when dragging an element, so the gesture reads as a variation of it.
3. **The point grabbed stays under the pointer.** The pointer is projected onto the line as drawn (curves, bend points and every routing style), minus where on the label it was grabbed, so the label does not jump to the pointer. The fraction is rounded to three decimals and clamped to 0 to 1 by the projection.
4. **One undo step per drag**, opened (`beginContinuousEdit`) by the first move that changes the value, so Alt+click leaves none. The canvas's edge-change handler used to snapshot on every edge-data update; it now skips that while such a step is open, since the gesture already holds its snapshot.
5. **Edges cannot be locked** (`locked` means nothing on an edge, see the file format), so no lock needs checking.
6. **The slider stays**, and so does the label's position in an exported SVG, which reads the same value.

## Alternatives considered
- **Drag without a modifier.** A click on a label would sometimes slide it.
- **A visible handle on the label or the line.** Another thing on a busy canvas for a small adjustment.
- **Free placement off the line.** A different stored shape (an offset) and a file-format change; the label belongs to its line.

## Consequences
- Many Linux window managers take Alt+drag to move the window, so the app may never see it ([known issues](../known-issues.md)). The slider is the fallback, and the modifier for both Alt+drag gestures can change together if it bites.
- An empty label has nothing to grab; use the slider.
