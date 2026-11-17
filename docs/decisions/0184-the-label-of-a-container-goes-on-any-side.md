# 0184. The label of a container goes on any side

## Context
A container's label sat at its top left and nowhere else. A swim lane has its name on the left, turned, so a flow reads across the lane; a lane stack without that looks like a pile of boxes.

## Decision
- **A container's label has a side: top (the default), left, right or bottom**, stored as `data.labelPosition` (absent is the top; unknown is read as the top).
- **The top of the text points at the side.** A label on the left is turned a quarter turn left and reads from the bottom up; on the right, a quarter turn right, from the top down; at the top it is upright. The bottom is the exception and stays upright, since upside-down text cannot be read.
- **The container's text alignment lines the label up along the side** (`style.textAlign`: start, centre or end), which until now moved nothing on a container. Start is where the text begins: the left at the top and bottom, the bottom on a left-hand label, the top on a right-hand one. No example in the repository set an alignment on a container, so no existing diagram moves.
- **While a label is edited it is a plain field across the top**, however it is turned.
- **The canvas and the exports place it by the same rules** (`shared/nodes/containerLabel.ts`). Draw.io can turn text a quarter turn left only, so a right-hand label is exported reading upward, with a note; this was not checked in draw.io itself.
- The layout check measures a turned label along the height of the container, not its width.
- Not covered: a header band for a lane (a separate strip with a divider), and labels on the other node types.

## Consequences
The file format gains one optional field on a container. An older version draws the label at the top.
