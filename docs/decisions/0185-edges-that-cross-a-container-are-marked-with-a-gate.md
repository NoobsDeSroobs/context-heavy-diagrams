# 0185. Edges that cross a container are marked with a gate

## Context
A container can be a swim lane, a deployment zone or a trust boundary. An edge that goes from one container to another is where a flow changes hands, a call leaves a zone or data crosses a boundary, and it is the thing a reader of such a diagram looks for. Most diagrams do not care, so the marking cannot be on by default.

## Decision
- **A crossing is derived, never stored.** The lane of an element is the container it has as its parent (dropped into it, or attached with "Attach contained elements"), however it sits on the screen: an element beside a container but not in it is outside. An edge crosses a border when one end is inside that container and the other is not. An edge between a container and an element inside it crosses nothing.
- **Nested containers count one border each.** An edge out of a group in a lane and into another lane crosses three. That is information, so each border gets its own mark.
- **The mark is a gate:** a short bar lying along the border where the edge goes through, flat on a horizontal border and upright on a vertical one, never angled with the edge. The edge keeps its own look. A highlight of the whole edge, alone or with the gate, was considered and may come later as another mode of the switch.
- **A session switch, off by default** (View, Display, Mark crossings), because it adds to the canvas and most diagrams have no use for it. Nothing about it is in the file; a file setting can be added if the need shows. The SVG export draws gates when the switch is on, so what is seen is what is exported.
- **Holding Ctrl (Cmd) over a marked edge** shows the containers it goes between, as the note peek shows an element's note: "Billing › Sales → Finance", innermost first on the way out and outermost first on the way in, and the number of borders.
- **Every edge counts.** Whether the ends are behaviours or entities does not matter, since the same detection finds a trust boundary as well as a hand-off. A filter can be added if the noise proves real.
- Not covered: a list of the crossings with counts per pair of containers, a rule that forbids some crossings (that is a check of a diagram metamodel), and the gates in the PNG export beyond what the canvas shows.

## Consequences
No file format change. The three display switches of the View menu (Animate edges, Minimap, Mark crossings) are grouped in a Display submenu.
