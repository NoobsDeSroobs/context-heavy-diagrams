# Examples

Real, working diagram files. Open any of them with **File → Open** (or drop it onto the window). Each is a single `.chd` file, which is plain JSON (see [`docs/file-format.md`](../docs/file-format.md)). A diagram that uses a feature needing extra files (notes, linked diagrams, images) keeps them in a sibling folder named after it (`<name>/details/`, `<name>/assets/`).

## Start here

| File | What it shows |
|---|---|
| [`hello-world.chd`](hello-world.chd) | The smallest diagram: two entities and one edge. |
| [`with-icons.chd`](with-icons.chd) | Two entities with built-in corner icons. |
| [`with-metadata.chd`](with-metadata.chd) | A diagram-level required-tag template, one required tag and one free tag on an entity. |

These three also serve as round-trip fixtures: the app must open and re-save them without changing their meaning.

## The gallery

[`gallery/`](gallery/README.md) is a broader set built around one fictional rail operator, "Meridian Rail", showing how the tool holds up for different kinds of architecture work:

| Open this | To see |
|---|---|
| [`gallery/landscape/meridian-rail-landscape.chd`](gallery/landscape/meridian-rail-landscape.chd) | A full as-is IT landscape of about 70 services, tagged for GDPR and NIS2 so you can switch highlight overlays on and off. |
| [`gallery/landscape/meridian-rail-landscape-layered.chd`](gallery/landscape/meridian-rail-landscape-layered.chd) | A prototype of the same estate as a drill-down: Ctrl/Cmd-click the Ticketing & Booking domain to open its services, then one service's AWS deployment. |
| [`gallery/technical/c4-context.chd`](gallery/technical/c4-context.chd) | A C4 drill-down: Context, then Container, then seven Component diagrams, all linked. |
| [`gallery/technical/security-rollup.chd`](gallery/technical/security-rollup/README.md) | A security matrix whose scores roll up through three layers of linked diagrams. |
| [`gallery/business/customer-journey.chd`](gallery/business/customer-journey.chd) | Edges as a sequence rather than a hierarchy. |
| [`gallery/organisation/motivation-goals.chd`](gallery/organisation/motivation-goals.chd) | A motivation view, with substantial Markdown notes on every node. |
| [`gallery/data/star-schema-powerbi.chd`](gallery/data/star-schema-powerbi.chd) | A Power BI star schema using multi-line labels and crow's-foot markers. |

Everything in the gallery is fictional content, written to find where the tool's flexibility holds up and where it breaks down.
