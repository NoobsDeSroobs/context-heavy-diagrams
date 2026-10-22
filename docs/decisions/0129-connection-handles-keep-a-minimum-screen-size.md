# 0129: Connection handles keep a minimum screen size

## Status
Accepted.

## Context
React Flow sizes handles, and the radius within which a dropped edge snaps to one (`connectionRadius`), in flow units. Zoomed far out on a large diagram a 6 px handle is about 1 px on screen and the 20 px snap radius about 4 px, so starting or finishing a connection becomes a pixel hunt.

## Decision
- The handle size is `max(6px, 10px / zoom)` in CSS, so a handle is at least 10 screen px and unchanged when zoomed in. The zoom reaches the CSS as `--canvas-zoom` on the canvas element, written straight to the DOM from the React Flow store, so zooming re-renders nothing.
- `connectionRadius` doubles per halving of the zoom (rounded to a step), which keeps the screen radius between about 14 and 28 px. It is a prop, so it must be state; stepping it keeps the canvas from re-rendering on every zoom tick.

## Alternatives considered
- **Scale the handles with a CSS transform.** The handle position and the hit area React Flow measures would disagree.
- **A continuous `connectionRadius` of `20 / zoom`.** Exact, but re-renders the whole canvas on every wheel tick.
- **A bigger fixed size at every zoom.** Clutters nodes at normal zoom for a problem that only exists zoomed out.

## Consequences
- Zoomed far out, handles look large relative to their node; they only show on hover.
- A drop can snap to a handle up to 28 screen px away, a little more than before when zoomed out, never less.
