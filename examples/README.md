# Examples

Real, working diagram files. Open any of them with **File → Open** (or drop it onto the window). Each is a single `.chd` file, which is plain JSON (see [`docs/file-format.md`](../docs/file-format.md)). A diagram that uses a feature needing extra files (notes, linked diagrams, images) keeps them in a sibling folder named after it (`<name>/notes/`, `<name>/assets/`).

Every example also exports to draw.io, from **File → Export → draw.io…** or `chd export <file.chd> -o <file>.drawio`. `gallery/landscape/.../aws-deployment.chd` (nested containers, icons, tags) and `gallery/data/star-schema-powerbi.chd` (crow's-foot ends, tags) show the most of what comes across; a test exports every example.

`paste-a-table.csv` is not a diagram but a table to paste: copy its contents, right-click the Entity button and paste. It has a Name, a Description, a Domain and three tag columns, one repeated row that merges, and a description with a comma in it.

## Start here

| File | What it shows |
|---|---|
| [`hello-world.chd`](hello-world.chd) | The smallest diagram: two entities and one edge. |
| [`with-icons.chd`](with-icons.chd) | Two entities with built-in corner icons. Hold Ctrl (Cmd on a Mac) over one to read the icons' names. |
| [`with-metadata.chd`](with-metadata.chd) | A diagram-level required-tag template, one required tag and one free tag on an entity. |
| [`automatic-attachment.chd`](automatic-attachment.chd) | Edges that attach by themselves: five edges with no connection point named, round one element with extra points on its bottom, and one edge fixed to a point. Drag any element round Core and the automatic ends change side and point; the fixed edge stays. Right-click an edge for Attach automatically and Fix to current points. |
| [`crossings.chd`](crossings.chd) | Edges that cross a container: Sales holding a Billing group, Warehouse and Finance, with an edge that crosses one border, two, and three (out of Billing and Sales, into Finance). Choose View, Display, Mark crossings to see a gate on each border; hold Ctrl (Cmd) over an edge to see which containers it goes between. |
| [`label-positions.chd`](label-positions.chd) | Where the label of a small shape goes: below (the default), above, left, right, and free with a dotted line, and a decision with an edge on every side whose free label stays clear of all four. Drag a free label while its shape is selected. |
| [`process-flow-all-behaviours.chd`](process-flow-all-behaviours.chd) | Handling a refund request in two lanes, using 13 of the 14 kinds of behaviour (all but the human action): a start, a parallel split and join, an automatic and a human step, a decision, a step that expands into a sub-flow (`process-flow-all-behaviours/verify-the-purchase.chd`), an inclusive choice with a replace and a refund branch, a repeated step, an event, a timer, a message and two ends. Open the legend to see the kinds. |
| [`stencil-kinds.chd`](stencil-kinds.chd) | Every kind of behaviour (14 of them: the steps, the choices, the events), each named and with a line on what it is for, and the ways an end can finish: with warnings, failed, aborted, and stopping the whole flow. Open the legend to see the same names beside their shapes. |
| [`process-flow-order-to-delivery.chd`](process-flow-order-to-delivery.chd) | A webshop order from the click to the doorstep, with 14 kinds of behaviour and all the ways an end can finish: a parallel split of payment, address confirmation (a human action) and picking (a repeated step into a sub-flow); a declined payment that stops every path at once, a customer cancellation that aborts the flow, and a delivery that ends on time, late or lost. Switch between the light and dark theme to see the colours. |
| [`process-flow-stencils.chd`](process-flow-stencils.chd) | Behaviour: an order flow in two lanes (containers) with a start, steps, a decision with yes and no, a parallel split and join and two ends, one step linked to a drill-down diagram (`process-flow-stencils/pick-and-pack.chd`) and one ERP system as an entity tied to a step. Open the legend to see what each kind means. |
| [`edge-points-follow.chd`](edge-points-follow.chd) | Edge points that go with the elements: a Checkout container with Cart and Payment and a step edge looped under them, and an Audit log outside. Drag the container: the loop moves with the two elements, and the edge to Audit log keeps following its end. Below, Billing and Ledger with a curve under them: Ctrl+drag Billing and only the points nearer Billing come along. |
| [`new-edge-line.chd`](new-edge-line.chd) | A legend with two lines, *Data flow* and *Event*, and *Data flow* marked as the line new edges are drawn with: the two edges made without a style of their own look like it, and the event edge says so itself. Click the edge-style button at the top to see the diagram's lines listed first, and pick *Event* to draw the next edges with that ([ADR 0196](../docs/decisions/0196-new-edges-follow-a-line-of-the-diagrams-legend.md)). |
| [`right-angled-edges.chd`](right-angled-edges.chd) | Smooth step edges between two elements that face away from each other, so the line runs straight through both. One is plain: select it and drag the handle in the middle, and it goes round both elements in one drag. The other has one point above it and goes round both without a spike. Right-click either for Reset route. |
| [`springy-points.chd`](springy-points.chd) | Connection points sliding to straighten edges: one wide element with three evenly spaced points above three others out of line by 6, 14 and 40 px (the first two run straight, the third bends), and two elements 6 px apart. Drag one element and watch the ends slide. |
| [`stories.chd`](stories.chd) | Visibility sets and stories: a webshop, an ERP and a warehouse system, the three point-to-point connections between them, and a proposed integration hub, in three sets (Today, Connections today, Proposed). The story *Integration problem* tells it in three steps: what we have today, how it is connected, and the fix, with the old connections giving way to the hub. Choose **View, Present story** (F5, or the Stories button in the toolbar) and press the right arrow or space for the next step, the left arrow to go back, Esc to leave. The second story, *Systems only*, shows how one diagram holds more than one, opens on the systems because its start state shows the Today set, and ends with *Show All sets*, which shows every set whatever else the diagram has. A story starts with every set hidden, so everything is in a set: elements in no set would always be shown. |
| [`highlight-not-applicable.chd`](highlight-not-applicable.chd) | A data-classification highlight with a transparent colour for `N/A`, so the system boundary around the entities is left uncoloured when the highlights are switched on. |

These three also serve as round-trip fixtures: the app must open and re-save them without changing their meaning.

## Reviewing changes

[`review/`](review) has a diagram in two versions, to try the compare window and `chd diff` on:

| File | What it shows |
|---|---|
| `review/shop-before.chd`, `shop-after.chd` | A ten-plus-element shop architecture and the same after an edit: renames, a changed tag and a relabelled connection (Modified); recoloured elements, other icons, connections made dotted, solid or animated (Restyled); a font-size change (only marked with the paint brush); removed and added elements and connections. Try `chd diff examples/review/shop-before.chd examples/review/shop-after.chd`, or open the after file and use **View → Changes → Compare with git revision…** |

## Architecture checks

[`conformance/`](conformance) has a pair of diagrams for each built-in metamodel, one that follows the style and one that breaks it, to try `chd check` on (see [the metamodel format](../docs/metamodel-format.md)):

| File | Check it with |
|---|---|
| `conformance/hexagonal-ok.chd`, `hexagonal-broken.chd` | `chd check <file> --metamodel hexagonal` |
| `conformance/data-flow-ok.chd`, `data-flow-broken.chd` | `chd check <file> --metamodel data-flow-diagram` |

Each diagram has an edge direction set named after what its arrows mean ("Depends On", "Flows To") and a `role` tag on its elements, which is how a metamodel knows what each element is.

## The gallery

[`gallery/`](gallery/README.md) is a broader set built around one fictional rail operator, "Meridian Rail", showing how the tool holds up for different kinds of architecture work:

| Open this | To see |
|---|---|
| [`gallery/landscape/meridian-rail-landscape.chd`](gallery/landscape/meridian-rail-landscape.chd) | A full as-is IT landscape of about 70 services, tagged for GDPR and NIS2 so you can switch highlight overlays on and off. |
| [`gallery/landscape/meridian-rail-landscape-layered.chd`](gallery/landscape/meridian-rail-landscape-layered.chd) | The same estate as a drill-down: Ctrl/Cmd-click the Ticketing & Booking domain to open its services, then one service's AWS deployment. |
| [`gallery/technical/c4-context.chd`](gallery/technical/c4-context.chd) | A C4 drill-down: Context, then Container, then seven Component diagrams, all linked. |
| [`gallery/technical/security-rollup.chd`](gallery/technical/security-rollup/README.md) | A security matrix whose scores roll up through three layers of linked diagrams. |
| [`gallery/business/customer-journey.chd`](gallery/business/customer-journey.chd) | Edges as a sequence rather than a hierarchy. |
| [`gallery/organisation/motivation-goals.chd`](gallery/organisation/motivation-goals.chd) | A motivation view, with substantial Markdown notes on every node. |
| [`gallery/data/star-schema-powerbi.chd`](gallery/data/star-schema-powerbi.chd) | A Power BI star schema using multi-line labels and crow's-foot markers. |

Everything in the gallery is fictional content, written to find where the tool's flexibility holds up and where it breaks down.
