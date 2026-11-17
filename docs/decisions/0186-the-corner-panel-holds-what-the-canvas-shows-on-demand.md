# 0186. The corner panel holds what the canvas shows on demand

## Context
The panel in the bottom left corner of the canvas had the zoom in and zoom out buttons, fit view and a lock, then the buttons for the legend and the highlights. The zoom buttons are used by few: the wheel, a trackpad and the keyboard zoom, and they take room from what the corner is good for, which is switching extra information on the canvas on and off.

## Decision
- **The zoom in and zoom out buttons are hidden by default.** `showZoomControls` is a preference (off by default), set from View, Display, Zoom controls, for someone with no wheel or trackpad. Fit view and the lock stay.
- **The corner panel is where what the canvas can show on demand is collected:** the highlights, then the crossings, then the legend, last. The crossings button switches the gates of [ADR 0185](0185-edges-that-cross-a-container-are-marked-with-a-gate.md) on and off, as View, Display, Mark crossings does; it is where related view choices (a gate with the whole edge highlighted, say) go when they come.
- **A switch in the panel that is on is shown pressed.**
- Neither the preference nor the switches are stored in a diagram.

## Consequences
One new preference, read at every point the others are. The legend button moved from above the highlights to the bottom.
