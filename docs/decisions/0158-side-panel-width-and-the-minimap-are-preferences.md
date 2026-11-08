# 0158: The side dock's width and the minimap are per-person preferences

## Status
Accepted (2026-11-08). Extends [ADR 0013](0013-dock-layout-architecture.md) (the right-hand dock).

## Context
The notes, diagnostics, changes, layers and other side panels all share one right-hand dock, which was a fixed 360 px: too wide on a small window, too narrow for a long finding or a change line. The minimap is always drawn, with no way to clear the corner of the canvas.

## Decision
1. **The dock has one width for every panel, set by dragging its left edge.** A person who widens it for Diagnostics finds it that wide for the next panel too, and the edge does not jump when panels change. The handle also takes the arrow keys (a step, a larger one with Shift) and a double-click for the default.
2. **The width is a preference, written once when the drag ends.** It is kept between 280 and 900 px at every point preferences are read, as the other numeric preferences are, and is never more than the window leaves: the dock stops 400 px short of the window's width, so the canvas cannot be dragged out of sight.
3. **The minimap is shown or hidden by a preference, `showMinimap`,** on by default. Two ways reach it: a small button on the minimap's top-right corner (it stays in the corner when the minimap is hidden, so it can be brought back), and **View → Minimap**, which the command palette lists. The minimap has a fixed size so the button knows where its corner is.
4. Neither is stored in a diagram: both are how one person likes to see the window.

## Alternatives considered
- **A width per panel.** More state to keep, and the edge moves each time the panel changes.
- **Resizing the left-hand properties dock as well.** Not asked for; its content is a narrow column of fields.
- **Only a Preferences checkbox for the minimap.** Buried: the person who finds the minimap in the way is looking at the canvas, not at Preferences.
- **Only a View menu item.** Works, but nothing on the canvas says the minimap can go.

## Consequences
- The button covers a few pixels of the minimap's corner.
- A window narrower than about 680 px holds the dock at its minimum, whatever the stored width.
