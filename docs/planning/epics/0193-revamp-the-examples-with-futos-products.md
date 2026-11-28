# 0193: Revamp the examples, with FUTO's products as real examples

## Status
Not Started. Logged 2026-11-17, rewritten 2026-11-27. FUTO replied to the maintainer (received 2026-11-13) that they have no objection: Immich is AGPL, which allows it, and Grayjay is under FUTO's own licence, which allows non-commercial research, so analysing the code and publishing the analysis is within the licence as long as their software is not resold. The work starts once the branch holding 0124 is merged.

## Goal
Examples that are good and current: a few strong diagrams that show what the tool can do and what a medium-sized project looks like when it is readable, and a way for a new person to get going. The current ones are bloated, outdated and uneven.

## Principles (the maintainer, 2026-11-27)
- **Examples show the tool, not the architecture.** A wrong detail in a drawing of a real product is fine: the point is what the tool can do and what an assistant can generate, and a real product changes anyway. Each set says it is our reading, drawn on a date from a version, not the product's documentation. That one line is also what keeps the Grayjay set inside its licence; no verification pass.
- **Real products, not made-up ones.** A synthetic example hides simplifications and assumptions; a real product brings real complexity and is more believable. Read each product's licence first; names only, no logos, no suggestion that FUTO endorses the tool. No code, text or images of a product go into the repository.
- **Several features in one diagram is fine**, as long as it stays clear to the reader. A feature does not need a diagram of its own ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md) says an example is extended, not duplicated).
- **Revamp, not wipe.** Delete what is better replaced or has no use, create what is missing, update what is outdated. Some files stay because something reads them (below).
- **A size budget**, so the new ones do not bloat: about 30 to 60 elements per diagram, drill-down links for anything bigger, one stated purpose per file in the README.
- **Built with the assistant tools** where it is sensible, and said so in the README. What got in the way is a finding for the tools' epics, not a workaround in the diagram.

## The tutorial
A `welcome.chd` with a story. It opens on a huge text box that says to open a new window (File → New, Ctrl+N) and set it aside, then click Stories and press F5; F5 starts the guide, and the blank window beside it is where the person repeats each step (drag an Entity onto the canvas, write a label, drag an edge out to make a new entity). A file always opens with everything shown (which sets are hidden is not stored), so it is laid out as areas, one for each stage, and the story reveals the instructions through visibility sets. The stages follow how a diagram is made: a few boxes and edges; then tags, notes and the peek card; then highlights and a legend. It is also the example for stories. It ends on a small part of a real product, at most ten elements, that the person makes by pasting a table with right-click bulk create, so copying is cheap; the last step links to the full set. `docs/getting-started.md` stays the written version.

## Step 1: the feature list (tiers final)
Tiers: **L** low impact or basic; **C** core, what every user needs and expects; **G** good, empowers the user; **D** defining, the main sales pitch. "Stands out" marks what the maintainer believes other tools lack, unchecked against them; it is not a tier, and whether it earns a place in the pitch is decided later. "Shows" is whether a diagram can show it (a way of working, a principle or a file property cannot, and goes in the README instead). Drawn from the README, the getting-started page and the changelog; the tiers are my proposal. Sorted from defining to low, in the order I found them within a tier.

| Feature | Tier | Stands out | Shows | Note |
|---|---|---|---|---|
| Notes in Markdown behind an element | D | | yes | The context behind the box |
| Tags and metadata on elements and edges, with required tags (allowed values, propagating to children) | D | | yes | Required tags are a part of this, not a row of their own |
| Peek card: hold Ctrl or Cmd and hover to read an element's note, tags, link and icon names | D | yes | yes | The reading half of notes and tags; the example puts a text element above an entity telling the reader to try it |
| Highlights and the legend: one diagram, several perspectives | D | | yes | |
| Visibility sets | D | | yes | |
| Stories and the presenter view (F5) | D | | yes | |
| Visual review of changes (the change visualizer): since last save, against git, compare window | D | | yes | Needs two versions of a file |
| Assistants: the MCP server, the skill, `chd edit` | D | | partly | The examples can be built with them and say so |
| Plain, deterministic text files that diff in git | D | | no | A property of the file |
| Offline and private: no network, no account | D | | no | A principle |
| Linked diagrams: drill-down through a tree | G | | yes | Needs more than one file; common elsewhere, but here the links are relative paths, downward only, in git |
| Behaviour kinds: steps, decisions, parallel paths, events | G | | yes | 16 kinds in four families; not Defining on its own and not yet tried in real use |
| Search with a query language, isolate mode | G | | partly | A diagram can hold things worth finding |
| An end's outcome and reach; an event's position | G | | yes | |
| Label positions of small shapes (below, above, left, right, free) | G | | yes | |
| Mark crossings: hand-offs between lanes | G | yes | yes | A View switch, off by default and per session |
| Automatic edge attachment (the dashed target), connection points that slide | G | | yes | |
| Multiple connection points per side; edge points that follow | G | yes | yes | |
| Portals: an edge broken across what lies between | G | | yes | |
| Edge direction sets, line gravity presets | G | | yes | |
| New edges that follow a line of the legend | G | | yes | |
| Icons and installed icon packs | G | | yes | Includes search by icon |
| Reference images pinned to an element | G | | no | Never part of the diagram or its exports |
| Security matrix, with scores that roll up through linked diagrams | G | | yes | Defining once the work is complete and it has shown its value |
| `chd diff`, `chd check`, `chd export`, `chd validate` (command line, CI) | G | | no | Shown in the README, not a diagram |
| Architecture checks against a metamodel (hexagonal, data-flow, your own) | G | | yes | Defining once it is tried in real use; a pair of diagrams, one passing, one breaking |
| Export: SVG, PNG with legend, draw.io | G | | no | |
| Bulk create, paste a table | G | | partly | `paste-a-table.csv` is the example |
| Entities, labels, edges between them | C | | yes | The base of every diagram |
| Containers that hold other elements (nesting) | C | | yes | |
| Swim lanes: a container as a lane, label on any side | C | | yes | Expected from any process tool |
| Text elements, free-form curved lines | C | | yes | |
| Move, resize, multi-select, align and distribute, snapping, guides | C | | no | Editing, not a thing to see in a file |
| Styling: fill, border, font, edge line style, markers | C | | yes | |
| Edge routing: straight, step, smooth, curved; bend points | C | | yes | |
| Undo and redo, copy and paste | C | | no | |
| Save, open, autosave, crash recovery | C | | no | |
| Pan, zoom, fit, minimap | C | | no | |
| Light and dark themes | C | | no | |
| Command palette, keyboard shortcuts page | L | | no | |
| A highlight with no colour, to leave an element out | L | | yes | |
| Diagnostics, layers panel | L | | partly | |
| Format painter, alt+drag duplicate | L | | no | |
| Per-element lock | L | | no | |
| Style palettes, a default font, preferences | L | | no | |
| Save As that asks what to copy | L | | no | |
| External change detection, file-version warning | L | | no | |
| Recent diagrams, file association on Windows, one window per diagram | L | | no | |
| Glossary, shortcuts help | L | | no | |

**For the maintainer to decide:** whether "behaviours and entities in one diagram" is a defining feature of its own (it would need the two to share more than they do: a behaviour has a link but no tags or note; what it should carry is [0210](0210-metadata-and-context-on-behaviours.md); the maintainer's picture is a flow at one level, a technical diagram below it, and a flow below an entity in that); which of the "no" rows in the good and defining tiers still need a line in the README (core and low need none; reference images probably not); which other rows belong in the "stands out" column, after checking [docs/comparison.md](../../comparison.md). Step 2 groups notes, tags and the peek card as "context behind the box".

## Step 2: the groups, and three kinds of example
A group is what one example shows together. There are three kinds of example, and the maintainer wants all three:
- **The tutorial:** do-along, one file, the order in which a person makes a diagram.
- **Deliverables:** what the tool can make, such as a C4 diagram of Immich. These are not feature showcases; the features appear because a good deliverable needs them. Step 3 lists them first and then checks which features they leave uncovered.
- **Reference sheets:** features shown in isolation, each in its own area with a line of text, and **interactive** where that teaches best ("drag A around B and watch which connection points the edge uses"; "turn on View → Display → Animate edges").

Features that a diagram cannot show, and the low tier, need no group and are named at the end.

| # | Group | Features | Where it is shown |
|---|---|---|---|
| 1 | **First diagram** | Entities and edges, containers, text and lines, styling, edge routing | Tutorial: first area, no context at all. Deliverables: every one is made of them |
| 2 | **Context behind the box** | Notes, tags with required tags, the peek card | Tutorial: second area, add tags and a note, then hold Ctrl or Cmd and hover. Deliverables: a note and tags on the elements of the product sets, so the peek card has something to show |
| 3 | **Perspectives** | Highlights and the legend; new edges that follow a legend line; a highlight with no colour | Tutorial: third area. Deliverables: the containers diagram read by technology, by the data held and so on. Reference sheet: the other two |
| 4 | **Zooming in and rolling up** | Linked diagrams (a flow, a technical diagram below it, a flow below an entity there), the security matrix and its rollup | Deliverables: context, containers and components linked down, and the flow linking to the diagram below a step; the security view once proven. Tutorial: its last step links to the full set |
| 5 | **Telling it step by step** | Visibility sets, stories and the presenter view | Tutorial: its own mechanism. Deliverables: the containers diagram with a story that tours it |
| 6 | **Flows** | Behaviour kinds, an end's outcome and reach, an event's position, label positions of small shapes, swim lanes, mark crossings | Deliverables: a user's goal in lanes. Reference sheets: the kinds, crossings |
| 7 | **Tidy at size** | Automatic edge attachment, several connection points per side, portals, edge direction sets and gravity, icons and icon packs | Reference sheet: interactive, a feature to try in each area. Deliverables: wherever a medium diagram would otherwise be a tangle |
| 8 | **Rules that hold** | Architecture checks against a metamodel | Reference pair: one diagram that passes, one that breaks. Deliverables: a check of a product set, once the feature has been tried in real use |
| 9 | **What changed** | Visual review of changes | Reference pair: two versions of a file |
| 10 | **Data in** | Bulk create, paste a table | Tutorial: builds its small product diagram this way. Reference: `paste-a-table.csv` stays |

**Cross-cutting:** the assistants are shown by how the examples are made, and the README says which were built with them. Search rides along in a large diagram and needs no example of its own.

**Needs no group, a README line or nothing:** plain deterministic files, offline and private, the command line and CI, export, reference images (none), and the core and low rows that are editing, saving, viewing and preferences.

**Found in the app (2026-11-27), to fix before the tutorial is built:** the presenter does not show the peek card (it lets no pointer event through to nodes and edges), edges do not animate in it, and a story step does not move or zoom the view. The maintainer wants hovering allowed, since it only reads, and a story action that focuses the view on a set or on everything. The menu path for animation, from the changelog, is View → Display → Animate edges.

## Step 3: the diagrams wanted (a draft, for the maintainer to adjust)
Deliverables first, then the tutorial and the reference sheets that cover what they do not. Sizes follow the budget above. What each product contains is read from the product when it is drawn; the lines below are the shape of a set, not a claim about Immich.

**The tutorial and the starter**

| Diagram | Carries groups | Note |
|---|---|---|
| `welcome.chd` | 1, 2, part of 3, 5, 10 | Huge "press F5" box on open; areas per stage; ends on a slice of at most ten elements of a real product (a candidate: Immich's upload path, picked after looking at the finished set), made by pasting a table; the last step links to the full set |
| `hello-world.chd` | 1 | The smallest file, kept for the first open and as a round-trip fixture the docs link to |

**Deliverables: one set per product, the same shape each.** Immich first (AGPL), Grayjay second, a third later. Each set names the version and date it was drawn from.

| Diagram | Carries groups | Size | Note |
|---|---|---|---|
| Context (C4 level 1) | 2, 4 | 10 to 15 | The people and systems around the product; notes and tags; the top of the set |
| Containers (C4 level 2) | 2, 3, 4, 5 | 20 to 30 | Tags with highlights as perspectives (by technology, by data held, say); a story that tours it; links down |
| Components of one container | 2, 4 | about 30 | Linked from the containers diagram |
| A user's goal as a flow (for Immich, a photo from the phone to a backed-up photo) | 4, 6 | 25 to 40 | Lanes for the phone, the server, background work and storage; the behaviours, an ending with an outcome, crossings; a step links to the technical diagram below it |
| How it runs (deployment) or a data view | 2, 3 | 15 to 20 | A competing view of the same product; optional in the later sets |
| Security view with the matrix rolled up | 4 | | Held until the matrix is complete and proven |

**Reference sheets: features in isolation, interactive where it teaches**

| Diagram | Carries groups | Note |
|---|---|---|
| Edge tidiness (new) | 7, part of 3 | One area per feature with a line of text: spin A around B and watch the connection points it uses; portals; direction sets and gravity; icons; Animate edges; new edges that follow a legend line; a highlight with no colour |
| Behaviour kinds (`stencil-kinds`) | 6 | All sixteen, each named; exists |
| Crossings | 6 | Part of the Immich flow (the old `crossings.chd` goes) |
| Architecture checks pair (`examples/conformance/`) | 8 | Exists; a test reads it by name |
| Review pair (`review/shop-before`, `shop-after`) | 9 | Two versions of a file; exists |
| `paste-a-table.csv` | 10 | Exists; a test reads it |

**Layout of a set:** the editor's own convention, so `immich.chd` links to `immich/Containers.chd` and that file to `Containers/Server.chd`.

**To decide at this step:** whether the Meridian Rail gallery (25 diagrams, made-up) stays as the home of the tag, highlight and security-matrix showcases or is folded into the sets, which would change the layout of the examples folder and needs an ADR (the maintainer's yes first). Steps 4 and 5 look at what exists before it is settled.

## Step 4: every existing file, sorted (a draft, for the maintainer to adjust)
The starting point is that **all of it is deleted** and a file comes back only for a reason. **Noise** has none, or is replaced by something in the step-3 list. **Needed** has a hard reason. **Uncertain** needs a decision in step 5. The new diagrams are built in a separate work folder; what is kept is copied into it at the same relative path, and when the work is done the old `examples/` is deleted and the work folder takes its place. 129 files today: 26 top-level `.chd` (with 2 in sub-folders), 25 in the gallery with 75 notes, one table, two READMEs.

**What the walking tests need.** Five suites read every `.chd` under `examples/`: the round trip (`savedWith.test.mjs`), the draw.io export (`drawio.test.mjs`), the SVG render (`renderDiagram.test.mjs`), "opens without needing to be saved" (`Canvas.test.tsx`) and "stable through the canvas" (`diagramConversion.test.ts`, which also asserts that more than three files exist). They are a corpus test, so the new set has to keep exercising what the old one did: all 16 behaviour kinds, portals, stories and sets, icons, linked diagrams several levels deep, notes, required tags, review pairs. While the work folder is built, nothing runs these against it; `chd validate` does, and pointing the five suites at the work folder (one shared setting) is an option for step 7.

**By-name readers, which fix the path of a kept file:** `conformance/` (4 files: `tools.test.mjs`, `checkCommand.test.mjs`, `parity.test.mjs`), `hello-world.chd` (`Canvas.test.tsx`, [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md) names it the old-format fixture, and the file-format spec, the getting-started page and the README link it), `paste-a-table.csv` (`bulkCreate.test.mjs`). `with-metadata.chd` is linked from `docs/file-format.md`. `life-parallel-selectors.chd` is where [known-issues](../../known-issues.md) found the edge-culling bug (the test names it in a comment only). `with-icons.chd`, which the earlier note said the docs link, is in fact linked by nothing but the examples README.

**Top level**

| File | What it is | Referred to by | Class | Why, or what takes over |
|---|---|---|---|---|
| `hello-world.chd` | 2 nodes, the oldest file | `Canvas.test.tsx`, ADR 0029, the spec, getting-started, README | Needed | Old-format fixture: keep byte for byte, never regenerate |
| `conformance/` (4 files) | Hexagonal and data-flow, each passing and broken | The three test files above | Needed (decided) | Group 8; same paths. Hexagonal is the metamodel check, the data-flow pair is the visual validator |
| `paste-a-table.csv` | A table to paste | `bulkCreate.test.mjs`, getting-started | Needed | Group 10 |
| `stencil-kinds.chd` | All 16 kinds, each named (42 nodes) | README, examples README | Needed | Group 6 reference sheet; keeps the corpus covering all 16 kinds |
| `review/shop-before`, `shop-after` (+1 note) | Two versions of a shop (16 nodes each) | none by code | Needed | Group 9; the only review pair. May later be redrawn on a product |
| `crossings.chd` | 12 nodes, containers with crossings | README, examples README | Noise (decided) | Part of the Immich flow: its lanes show Mark crossings, with the intro text telling the reader to switch it on and Ctrl-hover an edge |
| `process-flow-order-to-delivery.chd` | 31 nodes, 14 kinds, every way an end can finish | README, examples README | Noise (decided) | The Immich flow replaces it. It must show every end outcome and reach, or the kinds sheet does, so the corpus keeps them |
| `life-parallel-selectors.chd` | 62 nodes, 66 edges (42 KB) | known-issues | Noise (decided) | Dropped; Grayjay or the features sheet may become the large-diagram stress case. The known-issues entry stays as history |
| `with-metadata.chd` | Required tags template, a required and a free tag | The spec | Noise (decided) | The tutorial's second area carries required tags; the spec link then points at `welcome.chd` |
| `process-flow-all-behaviours.chd` (+ `verify-the-purchase`) | 13 of 16 kinds in two lanes | README, examples README | Noise | The Immich flow and the kinds sheet |
| `process-flow-stencils.chd` (+ `pick-and-pack`) | An order flow with a drill-down | README, examples README | Noise | The Immich flow, with a step that links down |
| `stories.chd` | 5 nodes, 3 sets, 2 stories | README, PROGRESS, examples README | Noise | `welcome.chd`; the tour story in a product set |
| `with-icons.chd` | 2 nodes with icons | examples README | Noise | The edge-tidiness sheet (icons) |
| `automatic-attachment.chd`, `edge-points-follow.chd`, `springy-points.chd`, `right-angled-edges.chd`, `portals.chd`, `new-edge-line.chd`, `highlight-not-applicable.chd` | One feature each, 4 to 10 nodes | examples README (epics name some) | Noise | The edge-tidiness sheet (group 7, and a highlight with no colour and new edges that follow a legend line from group 3) |
| `label-positions.chd` | Where a small shape's label goes | examples README, epic 0189 | Noise | The kinds sheet |
| `README.md` | The index | many | Rewritten at the end | |

**Gallery (25 diagrams, 75 notes, a made-up railway, "Meridian Rail")**

| Folder | What it is | Referred to by | Class | Why, or what takes over |
|---|---|---|---|---|
| `technical/security-rollup` (9 diagrams) | The security matrix rolling up through three levels | README, getting-started | Noise (decided) | Dropped for now: the matrix has no example until it is complete and proven, and the Immich security view comes then. The README and getting-started links need rewording |
| `technical/c4-context` and `c4-container` (9 diagrams, about 40 notes) | C4 context, containers and seven components | the gallery README | Noise | The Immich set (maintainer's call) |
| `landscape` (4 diagrams, 195 KB) | A layered landscape with a deployment drill-down | The skill's authoring guide names its path in a note | Noise | The Immich set. The note in `authoring-guide.md` (and its copy in `.claude/`) then needs rewording |
| `business/customer-journey`, `data/star-schema-powerbi`, `organisation/motivation-goals` (3 diagrams, 21 notes) | A journey, a data model, goals | README line 42 claims the tool suits these kinds | Kept (decided) | Moved into a `synthetic-cases/` sub-folder (made-up systems, not real products). Other kinds are needed, but not necessarily these three; real-product versions may replace them later |
| `gallery/README.md` | The gallery index | README | Goes with the decision on the rows above | |

**Corrections to step 3:** the review pair exists (done above); `stories.chd` is replaced by `welcome.chd`, so 0211's example task extends `welcome.chd`, not `stories.chd`.

**Decided in step 5:** every Uncertain row, as marked above; the work folder is `examples-next/` at the repo root; the walking tests are pointed at it in step 7.

## Step 6: the survivors mapped onto the list, and the gaps
A first count of 21 diagrams was too many to the maintainer (9 of them the security rollup, 4 the checks, 3 the other kinds), who set the target list below (2026-11-28). A script compared what the kept files use with what only the deleted ones use.

**The list the work aims at (agreed):**

| # | Diagram | Comes from |
|---|---|---|
| 1 | Hello world | `hello-world.chd`, copied byte for byte |
| 2 | The tutorial | New (`welcome.chd`) |
| 3 | Immich C4, context | New |
| 4 | Immich C4, containers | New, with perspectives and a tour story |
| 5 | Immich C4, components of one container | New |
| 6 | All features one by one, interactive and grouped by type | New; absorbs the kinds sheet (`stencil-kinds`, with the end outcomes and reach) and the edge-tidiness sheet. It may be large and doubles as a stress case; problems are solved when they arrive |
| 7 | Paste a table | `paste-a-table.csv`, copied |
| 8 | Review pair | `review/shop-before`, `shop-after`, copied |
| 9 | A process flow | New, Immich, in lanes, with crossings and a step that links down |
| 10 | Architecture checks | `conformance/` (4 files, copied): hexagonal is the metamodel check, the data-flow pair is the visual validator |
| + | Synthetic cases | A `synthetic-cases/` sub-folder for the three made-up "other kinds" diagrams (journey, star schema, goals), kept as they are |

Dropped: the security rollup (the matrix has no example until it is complete and proven; the README and getting-started links are reworded, and [ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md) is the reason to bring one back then), `life-parallel-selectors` (Grayjay or the features sheet is the stress case). A second product (Grayjay) follows the Immich set.

**Gaps in the diagrams** (used only by files that go, so step 7 must bring them back): stories and visibility sets (the tutorial; the Immich containers tour); highlights and required tags (none of the survivors has either: the tutorial and the sets); portals (the edge-tidiness sheet); an event's position (`flowPosition`) and a free label (`labelOffset`), neither of which the kinds sheet shows (add them there or to the Immich flow); tags on edges (only the landscape had them). The survivors already cover icons, linked diagrams, notes, legends, edge animation and direction sets. No test needs any of these, so nothing breaks while they are missing; they are a loss of coverage only.

**Not covered by any survivor or planned diagram:** the edge-tidiness sheet and everything in the product sets are new, as planned. Nothing in the step-3 list was found missing.

**Gaps in the tool** are in the list below. Besides 0211 and 0210 there are none. The tutorial's blank window is not one: File → New (Ctrl+N) always opens a new window and never replaces the open diagram ([ADR 0023](../../decisions/0023-multi-window-diagram-model.md)).

## Needed from the tool (collected as the steps go)
The examples are where a missing feature shows up. They are collected here and built together after step 6, not one at a time.
- [0211](0211-presenter-allows-reading-and-focuses-the-view.md) (built, awaiting merge): hover works in the presenter (the peek card, the Ctrl-hover on an edge) and a story can focus the view. The tutorial needs both.
- [0210](0210-metadata-and-context-on-behaviours.md): what a behaviour carries; drawing the Immich flow with today's tools is its first task, and what the steps lack goes there.
## What reads the examples (do not break)
Tests read `examples/conformance/` by name (`checkCommand`, `parity`), `Canvas.test.tsx` and `diagramConversion.test.ts` read example files, and `drawio.test.mjs` walks every example (a new one is covered by itself). `hello-world` is the round-trip fixture that the docs link to (`with-icons` is named only by the examples README, `with-metadata` by the spec, which moves to `welcome.chd`). `paste-a-table.csv` is named in a bulk-create test. Dropped files are still named in places: `life-parallel-selectors` in `known-issues.md` (history; a test names it in a comment) and `gallery/technical/security-rollup` in the README and the getting-started page, which are reworded. Check each reference before a file goes.

## Tasks, in this order
- [x] **1. The feature list in four tiers:** low impact or basic; core, what every user needs and expects; good, what empowers the user; defining, the main sales pitch. Drafted from the README, the changelog and the getting-started page; the tiers are final, with a "stands out" column kept apart from them.
- [x] **2. Group the features** (dropping the low tier where it needs no example) into logical groups that are shown together. Ten groups, shown by three kinds of example: the tutorial, the deliverables and the reference sheets.
- [x] **3. The list of diagrams wanted:** deliverables first (what the tool can make), then the tutorial and the reference sheets for what they leave out. The Meridian Rail gallery is not the home of the showcases: its C4 and landscape go to the Immich set, its other kinds move to a `synthetic-cases/` sub-folder, its security rollup is dropped until the matrix is proven. The agreed target is ten diagrams (step 6). No ADR so far; one only if the layout of the examples changes, with the maintainer's yes first.
- [x] **4. Sort every existing file** into noise (can go), uncertain and needed, with a column for what refers to it. Done above, starting from "everything is deleted and a file needs a reason".
- [x] **5. Decide each:** delete, rework, update or keep. Decided: the Needed rows are copied, the Noise rows go, and the Uncertain rows are settled in the table (the order-to-delivery flow, `crossings`, `with-metadata`, `life-parallel-selectors` and the security rollup go; the three other-kinds diagrams move to `synthetic-cases/`). The work folder is `examples-next/` at the repo root; nothing is copied or deleted until step 7, when the old `examples/` is replaced by it. The five walking test suites are pointed at the work folder in step 7, with one shared setting.
- [x] **6. Map the survivors onto the list from 3** and find the gaps, in the diagrams and in the tool. Done above: the diagram gaps are the step-7 work, the tool gaps are the list "Needed from the tool". Whatever the tool lacks is built before step 7, all at once.
- [ ] **6b. Build what the tool lacks** (0211 first; 0210's decision) before any diagram is made.
- [ ] **7. Make the diagrams that fill the gaps,** the real-product sets among them (Immich first; two or three products to start; each names the version and date it was drawn from). Each set: a context diagram, a drill-down by container and component through linked diagrams, one flow with behaviour in lanes (for Immich, an upload to a backed-up photo), tags with a highlight, visibility sets and a story, a short note per element.
- [ ] **Record the go-ahead in the repo** (`docs/licensing.md`): the date and what the reply covers (analysis and publication of the analysis, no reselling), paraphrased, with no names or contact details; and how the examples credit the products. Before the first real-product set is published.
- [ ] **Update the indexes:** `examples/README.md`, the gallery README, the root README and [docs/comparison.md](../../comparison.md) where they name examples; every example validates and opens in the app.

## Notes
- The same drawings can serve as the tool's first honest test of drill-down at a realistic size.
- A diagram that has drifted from its product is a known state of an example, not a bug.
- Real systems change; the dated version in each set says when it was drawn.
