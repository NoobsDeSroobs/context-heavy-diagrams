# 0022: Example diagram gallery

## Status
Not Started (but see Notes — this epic's lifecycle doesn't match the others)

## Goal
Two purposes under one epic:

1. **Dogfood the tool on itself.** Document this tool's own architecture and design using nothing but its own features — a **technical view** and a **functional view**, built as real `.chd` files that ship as examples.
2. **Build a broad gallery of generic example diagrams** — one attempt per standard architecture/IT diagram type an architect might reach for — to find out concretely where this tool's flexibility holds up and where it breaks down. These are illustrative/fictional content, not about this tool.

Per [ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md), the gallery explicitly includes enterprise-architecture-adjacent diagram types (business capability maps, motivation/goals views, application portfolios), not just software/technical diagrams — the tool is meant to take an architect most of the way toward proper EA tooling, not just software-architecture diagramming.

**Coverage target: every architect discipline, not just technical ones.** Data architect, business architect, enterprise architect, solution/technical architect, integration architect, security architect, infrastructure/cloud architect — the gallery below is organized by discipline specifically so gaps are visible per-persona. Nothing gets excluded just because it's awkward; an entry only gets dropped if it turns out to impose real, undue complexity or usability cost on the *other* use cases (e.g. a feature that would make simple diagrams harder to build in service of a niche notation). That's a judgment call for whoever's reviewing progress here, not something to pre-empt by leaving a discipline thin.

This runs **continuously alongside normal development epics**, not as a single bounded deliverable — see Notes.

## Tasks

### Self-documentation (dogfooding)
- [ ] Technical view of this tool's own architecture. Recommended shape: a C4-style Context → Container → Component drill-down using linked-diagram navigation (epic 0009) — a top-level context diagram linking down into a "process model" container diagram (main / renderer / preload), linking further down into component-level diagrams (`diagram.ts` / `icons.ts` / `details.ts` / `links.ts` and their IPC channels). This is deliberately the strongest showcase of the newest, most complex feature the tool has.
- [ ] Functional view of this tool's own architecture. A user-journey/flow diagram — open/create → add shapes/text → style → icon → link → details → save — using edges-as-sequence rather than hierarchy. Deliberately a different diagram *shape* from the technical view, to exercise a different part of the tool.
- [ ] Cross-link both views from wherever the example index/README ends up living.

### Generic diagram-type gallery
One illustrative example per row — fictional/generic content, not about this tool itself. Check off once a reasonable attempt exists. Feasibility notes will go stale as features land; update them as you go rather than trusting them blindly. Some entries naturally serve more than one discipline — listed once, under the discipline that owns it most.

**Enterprise architect**
- [ ] Business capability map (heatmap-style) — needs containers (epic 0004) + fill color (epic 0003) for maturity/investment coding
- [ ] Application portfolio / rationalization view (e.g. Tolerate/Invest/Migrate/Eliminate) — needs color coding (epic 0003); containers (epic 0004) helpful but not required
- [ ] Application-to-capability heat map (which systems support which business capabilities) — needs color (0003), containers (0004) helpful for grouping
- [ ] Solution architecture overview — a single blended business+application+technology page for one initiative; good capstone example once the pieces below exist, doable now
- [ ] Technology reference model / approved-standards catalog — table-shaped more than diagram-shaped; flag as a moderate-cost limits-test, similar to the RACI/risk-register entries below
- [ ] Motivation & goals view (drivers, goals, objectives, requirements and how they relate) — doable now with shapes + labeled edges
- [ ] As-is / to-be comparison — not a separate diagram type so much as a technique (do two versions of the same diagram, e.g. two application portfolio views) — apply it to whichever entry above is most useful, don't build it as its own checklist line

**Business architect**
- [ ] Business capability map — cross-ref Enterprise architect above
- [ ] Capability ownership map (capability → accountable owner/team, RACI-lite) — doable now with shapes + labeled edges; a real RACI grid (see Cross-cutting) is the more rigorous version
- [ ] Business Model Canvas — inherently a fixed 9-box grid; manually replicating precise grid layout is annoying without alignment/snapping (epic 0011) or containers (epic 0004), flag as moderate friction
- [ ] Value stream map — doable now
- [ ] Customer journey map — doable now, same shape as the tool's own functional view (edges-as-sequence)
- [ ] Product/service catalog map — doable now
- [ ] Organization / stakeholder chart — doable now

**Data architect**
- [ ] Conceptual data model — doable now
- [ ] Logical data model — doable now (distinct from conceptual: adds attributes, still DB-agnostic)
- [ ] Physical data model / schema diagram (tables, columns, keys) — doable approximately now (a shape per table, columns as multi-line label text, edges for FKs); better once configurable connection points (epic 0013) allow per-attribute connection lines instead of one line per table
- [ ] Data lineage diagram — doable now
- [ ] Data flow diagram (system-to-system data movement, broader than the GDPR-specific one below) — doable now
- [ ] Data governance / ownership map (data domain → owner/steward) — doable now, same shape as the business capability ownership map above
- [ ] Data warehouse / dimensional model (star or snowflake schema) — doable approximately now, same caveats as the physical data model
- [ ] Master data management architecture (golden record flow, source systems, MDM hub) — doable now, a system-landscape variant
- [ ] Data platform / pipeline architecture (ETL/ELT, batch vs. streaming) — doable now, an integration-landscape variant with directional data-flow edges
- [ ] Data classification map (public/internal/confidential/restricted) — needs color coding (epic 0003) to be legible at a glance; cross-ref Security architect

**Solution / technical architect**
- [ ] C4 context diagram — doable now
- [ ] C4 container diagram — doable now
- [ ] C4 component diagram — doable now (microservices architecture overviews are naturally covered by the container/component levels — not a separate entry)
- [ ] Deployment diagram (what runs where) — doable now; better with containers (epic 0004) for host/environment grouping
- [ ] Sequence diagram — likely a genuine limits-test. No swimlane/timeline notation exists; worth attempting anyway specifically to see how badly plain shapes+edges strain under it
- [ ] Entity-relationship diagram — cross-ref Data architect's logical/physical data model entries above
- [ ] Class / object diagram — doable approximately now; no UML notation (visibility marks, multiplicity styling), another moderate limits-test like the sequence diagram
- [ ] State machine diagram — doable approximately now (states as shapes, transitions as labeled edges)
- [ ] CI/CD pipeline diagram — doable now, a flow-diagram variant

**Integration architect**
- [ ] System/integration landscape diagram — doable now, likely a strong natural fit
- [ ] API/interface catalog diagram — doable now
- [ ] Event-driven / pub-sub topology — doable now
- [ ] Message flow / choreography diagram (which pattern — request-reply, fire-and-forget, saga — is in play between which systems) — doable now via edge labels

**Security architect**
- [ ] Threat model with trust boundaries — partial fit now (boundary as a plain shape/text label); better once containers (epic 0004) land
- [ ] GDPR / privacy data-flow diagram (Article 30 RoPA-style) — doable now; good use of the details sublayer for legal basis/retention per flow
- [ ] Regulatory/compliance control mapping, generalized beyond GDPR (SOC2, ISO 27001, HIPAA, PCI-DSS, etc.) — genuinely checklist-shaped more than diagram-shaped; cross-ref the checklist capability below
- [ ] IAM / access-control relationship diagram — doable now
- [ ] Security zones / network segmentation diagram — needs containers (epic 0004) for zone grouping
- [ ] Zero-trust architecture diagram — doable now, a variant of the network/security-zone diagrams above
- [ ] Data classification map — cross-ref Data architect above

**Infrastructure / cloud architect**
- [ ] Network topology diagram — doable now (built-in icon set should cover most cases)
- [ ] Cloud architecture diagram (AWS/Azure/GCP-style) — doable now via custom icon upload (epic 0007); easier once installable icon packs (epic 0019) land
- [ ] DR / high-availability topology — doable now
- [ ] Multi-region / multi-cloud architecture — doable now, a cloud-architecture variant
- [ ] Environment promotion pipeline (dev → test → staging → prod) — doable now, a flow-diagram variant
- [ ] Landing zone / account structure diagram — needs containers (epic 0004) for grouping accounts/subscriptions cleanly

**Process / flow (cross-cutting)**
- [ ] Business process flow — doable now, no swimlanes though
- [ ] Incident/runbook flow — doable now; pairs with the checklist capability below

**Cross-cutting limits-tests (tabular, not diagram-shaped)**
Deliberately included even though they're a poor structural fit — the point is to find out *how* poor, not to assume it. This tool is a canvas, not a spreadsheet; approximating a grid means manually positioning shapes with no row/column snapping (alignment/snapping is epic 0011, not started).
- [ ] RACI matrix — real grid data; expect this one to hurt without epic 0011
- [ ] Risk register / risk heat map — same caveats as the RACI matrix

### Checklist capability (to design toward)
Checklists are a first-class architect artifact in their own right — GDPR compliance checklists, go-live checklists, security review checklists, DR runbook checklists — not just a UI nicety, and several entries above are genuinely checklist-shaped documents rather than box-and-arrow diagrams.

- [ ] Add `remark-gfm` to the existing details-panel Markdown renderer (`ReactMarkdown` in `src/renderer/src/components/DetailsPanel.tsx`) so `- [ ] item` renders as a real checkbox list. Cheap, likely near-free — no new node type needed. (Currently plain `react-markdown` with no GFM plugin, confirmed by reading the file — `- [ ]` renders as literal text today, not a checkbox.)
- [ ] Stretch: make rendered checkboxes interactively toggleable, persisting the change back into the stored Markdown draft.
- [ ] Use it for real: at least one gallery entry above should actually be delivered as a checklist attached via the details sublayer to a node, not a conventional diagram.

## Notes
- **This epic doesn't fit the Not Started → In Progress → Done lifecycle the others use.** It's meant to run continuously alongside development epics — revisited every time a blocking feature (containers, styling, connection points, icon packs) lands, so diagram types that were previously blocked or awkward get attempted or improved. Open question, flagged rather than unilaterally decided: introduce a genuine "Ongoing" status and document it in [docs/planning/README.md](../README.md), or just leave this epic "In Progress" indefinitely and let the growing/shrinking checklist itself carry the "still going" signal? Left as "Not Started" here for now since nothing's built yet either way.
- Files this large probably don't belong in the existing flat `examples/` folder, which currently holds two minimal round-trip regression fixtures (`hello-world.chd`, `with-icons.chd`) — a different purpose from a showcase gallery. Recommend a new subfolder (e.g. `examples/gallery/`) so the two purposes don't get confused. `examples/README.md` needs a pointer once this exists.
- `examples/README.md` already promised a "details" example once epic 0008 landed, and nothing demonstrating icons+links together exists either — both predate this epic and are cheap, immediate wins independent of the bigger gallery effort.
- See [ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md) for the scope decision this epic operationalizes.
- The gallery was restructured by architect discipline (2026-08-19) specifically to audit coverage per persona — the original version was thin on data architecture and had no notion of ownership as distinct from capability. Re-audit whenever a new discipline's needs come up rather than assuming the list is complete; it almost certainly isn't.
