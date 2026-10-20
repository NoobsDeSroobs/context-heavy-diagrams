# 0141: How this tool compares with other diagramming tools

## Status
In Progress. Logged 2026-10-20 from a review of the landscape; the research in the notes below is a first pass. `docs/comparison.md` is drafted for general editors, diagram-as-code tools, software architecture models, enterprise architecture platforms, journey and process tools, notes and whiteboards, and wiki embedding, checked against each tool's own documentation on 2026-10-20. Still to do: the closing sections (what is distinctive, the gaps), the README link and the getting-started link.

The page is the deliverable of this epic. The gaps it lists (see the notes) will each become a feature epic of their own once the comparison is written; they are not part of this one.

## Goal
A standalone page, `docs/comparison.md`, that says honestly how this tool compares with each kind of diagramming tool in use today (general editors, diagram-as-code, software architecture models, enterprise architecture platforms, journey and process tools, notes plus canvas), so a reader can tell when to pick this tool and when to pick something else. The README's "Why another diagramming tool?" section stays as it is, apart from one closing line that links to the page.

## Decided
- The comparison is its own file, not a longer README section. The README gets one line at the end of "Why another diagramming tool?", for example: *For a comparison with other diagram tools, see [the comparison](docs/comparison.md).*
- The page says where this tool is the better fit and where it is not, and does not claim to compete with enterprise architecture platforms or model-as-code tools.
- A tool is described by what it does, not ranked. No prices in the page: they change and the sources disagree.
- Not a design decision, so no ADR. The page carries a "checked on" date.

## What the page should contain
1. A short framing: what this tool is (local, git-native, context behind each element) and the job it is for.
2. One section per category, each with the usual tools, what they do better, what this tool does better, and when to choose which.
3. A section on getting diagrams into wikis and documentation (Confluence and similar). Today the only way is an exported PNG, so say how that compares (tools with a wiki plugin, native rendering of diagram-as-code, SVG) and that this is a known weakness.
4. What is distinctive here, and an honest list of what is missing (the gaps below).
5. A "checked on" date and a note that other tools change; corrections welcome through an issue.

## Tasks
- [ ] Check every claim about another tool against its own documentation, not review sites; drop what cannot be confirmed
- [ ] Cover the tools the first pass only knew from memory. Done: Visio, yEd, FigJam, Camunda Modeler, Excalidraw, tldraw. Left: Sparx (its site refused automated fetches on 2026-10-20, so it is left out of the page and has to be read by hand), Cloudcraft, Whimsical, Archi's current state
- [x] Settle the Structurizr wording against its own current pages (the cloud service ended 2026-09-30; `local`, `pull`/`push`/`export` and an open-core `server` remain)
- [ ] Write `docs/comparison.md`, without em dashes and with a "checked on" date
- [ ] Add the closing line to the README's "Why another diagramming tool?" section
- [ ] Link the page from `docs/getting-started.md` "Where next" and from `docs/architecture/overview.md` if it fits
- [ ] Decide whether the gaps the page lists become epics of their own (see Notes)

## Notes: first-pass findings (2026-10-20, unverified)
Sources were vendor pages and review sites; treat all of it as leads.

**Changes in the landscape**
- Structurizr's cloud service ended 2026-09-30; Lite became `local`, the CLI became `pull`/`push`/`export`, on-premises became `server` (open core: source builds free, prebuilt binaries with SAML and RBAC are licensed). Source: archyl.com write-up, itself a competitor.
- Terrastruct (D2) is winding down; its TALA layout engine was open-sourced into D2 v0.9.0 and D2 continues under nonprofit stewardship. Single source (runtimewire.com).
- AI generation and MCP servers are now common: draw.io (official and community MCP servers), Lucidchart, Miro, Eraser. Lucid, Miro and Eraser are cloud services.
- Gartner published a 2026 Magic Quadrant for Enterprise Architecture Tools on 2026-10-13 (Ardoq, Bizzdesign, SAP LeanIX, Sparx and others); placements not seen.

**Closest overlaps with this tool**
- LikeC4 (open source, nested views, MCP) and Structurizr: drill-down and tags, but code-first models with views.
- IcePanel: browser-based C4 model with drill-down, tags and overlays, per-editor pricing.
- Obsidian Canvas and JSON Canvas (open format): local files with notes, but a board without containers or edges that follow nodes.
- draw.io: files can live in a repository and it has a VS Code extension, but per-element notes and drill-down are not its model (from memory, to verify).
- Archi: local and free, but enforces ArchiMate.

**Where this tool is distinctive:** notes, tags, images and a link to a deeper diagram on an ordinary canvas; drill-down across plain files with no model or server; enforced offline operation; a standalone spec with deterministic, diff-friendly files; AI writes guarded by a stale-edit check; free and without lock-in.

**Where it is behind** (candidates for their own epics, in order of leverage): **getting diagrams into wikis and docs (Confluence and similar)**, where only PNG export exists, so SVG export first and, since the PNG is rendered in the app window, a command-line export that can regenerate images from `.chd` files in CI (the `chd` tool only does `spec`, `validate` and `hash` today); SVG and PDF export (PNG only today); import from draw.io, Mermaid or PlantUML (draw.io import is parked in epic 0052); a narrow auto-layout for new or AI-written elements (parked in epic 0126); shapes and notation stencils (epics 0051 and 0105); no collaboration beyond git and no web view for non-technical readers; no integrations with CMDBs, cloud accounts or ticket systems; no published installers and Linux and macOS unverified.

## Related
[ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md) (scope: flexibility, not a formal metamodel), [ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md), epic 0052 (draw.io import and export), epic 0126 (auto-layout), epic 0105 (notation stencils).
