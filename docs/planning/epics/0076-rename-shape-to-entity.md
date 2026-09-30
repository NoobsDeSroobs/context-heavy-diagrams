# 0076: Rename "Shape" to "Entity"

## Status
**Name decided and the full code/`.chd` rename implemented and live-tested (2026-09-30).** See [ADR 0101](../decisions/0101-shape-to-entity-rename.md) for the rename itself (scope, alias-on-read mechanism, what's deferred). `typecheck`/`lint`/`npm test` clean (100 tests). Confirmed working by the user in the Electron renderer — pending PR/merge. Raised by the user (2026-08-24) alongside epic 0060 design work, but unrelated to it.

## Goal
The user's own framing: a Shape and a Container remain conceptually different things even if every style property is set identically between them — a Container represents grouping/boundary, a Shape represents a standalone entity. "Shape" undersells that distinction, reading as a purely geometric/visual term rather than a semantic category. Something like "Concept" (or another name capturing "a distinct thing in the system," independent of how it's styled) might fit better.

## Why this is bigger than a label change
- `'shape'` is a literal stored string in `DiagramNode.type` in every existing `.chd` file, not just a UI label — renaming it is a real file-format change, not a cosmetic one.
- Backward compatibility: [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md) requires old files to keep loading correctly — needs either an alias (`'shape'` still accepted on read, written as the new name going forward) or a real migration, not a silent breaking rename. (Less of a hard blocker than it would normally be — the user pointed out the app is pre-beta with them as the only user right now, so there's no real installed base of other people's files to protect. That removed the main objection to doing the rename *now*, but the user still chose not to.)

## Decided 2026-08-24: hold at documentation only, for now
Given three options (keep the internal name and only change the displayed label; document the distinction in the glossary without renaming anything; do the real rename now, leveraging the pre-beta/single-user situation), the user chose **documentation only**: no code or file-format change at all right now. [docs/architecture/glossary.md](../../architecture/glossary.md) now has an entry (originally "Shape vs. Container", updated 2026-09-30 to "Entity vs. Container" once the name was decided) explaining the semantic distinction independent of whatever the type ends up being called.

The replacement name itself ("Concept" was only the user's first offering) is explicitly deferred as its own decision, described as "quite important" — not to be rushed alongside this smaller documentation step.

## Real open questions (deliberately not resolved here)
- ~~The actual replacement word~~ — **decided, see below.**
- Alias-on-read vs. a real `.chd` schema version bump for the migration — the user's own call to make while doing the code rename; [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)'s backward-compatible-loading rule still applies, softened only by the pre-beta/single-user situation noted above.
- Whether this is worth doing before or after the product naming question (epic 0027) settles, given both are "what do we call things" work happening around the same time.

## Decided 2026-09-30: the replacement name is "Entity"

Settled after weighing it directly against "Concept" (the original offering) and against "Context"/"Asset"/"Node"/"Element"/"Component" — see the candidate table below for each one's case. **Entity** won because:
- It survives concrete infrastructure ("my database is an entity" reads fine) as well as abstract ones (a trust boundary, a business capability) — Concept skews too abstract for the concrete, everyday case.
- It's already the word [the glossary](../../architecture/glossary.md) reached for in prose to explain what a Shape *is*, before any rename was even on the table.
- It aligns with the security vocabulary this tool already leans on (the security matrix's subjects are effectively assets/entities).

**The user's own resolution of the "does a Container count as an Entity" scoping question:** within one diagram, Container and Entity are two distinct, mutually exclusive roles — a Container is never itself "a thing," only a grouping of Entities. But **both are scoped to the diagram they're drawn in, not absolute**: what's a Container in one diagram (a logical grouping of several related Entities) can be drawn as a single Entity in a different, higher-level diagram. Worked example: a diagram scoped to a cross-functional team draws each of that team's services as a Container, with the compute/queues/storage making it up as the Entities inside; a diagram one level up, scoped to the whole org, draws that entire service as one Entity, linked down to the more detailed diagram it's a Container in. This isn't a new mechanic — it's exactly what linked-diagram drill-down (Shape → `linkedDiagram`) already does; the Entity/Container naming just makes that existing mechanic legible. One consequence written into the glossary entry: an Entity isn't necessarily atomic — it means "this diagram isn't modeling its internals here," not "this thing has no internals."

Two objections considered and not treated as blocking: it's visually/phonetically close to "Element" (the existing umbrella term for everything on the canvas — a real risk in conversation, worth being deliberate about in UI copy when the rename lands, but not a reason to pick a different word); and DDD's own "Entity" (identity that persists) colors how backend-literate readers approach the word — resolved as a soft *asset* rather than a liability, since the relative-scoping model above lines up with how DDD readers already think about a Bounded Context grouping Entities/Aggregates.

## Decided 2026-09-30: the code/`.chd` rename is implemented

The user's original plan was to do this part themselves, but reconsidered once the actual scope became clear (561 raw matches across 58 source files) and asked for it to be done as one pass instead. See [ADR 0101](../decisions/0101-shape-to-entity-rename.md) for the full decision record. Summary:

- **Full rename** — stored `.chd` values (`type`, legend `kind`, `DiagramSecurity`'s id-list field names), every code identifier (`ShapeNode.tsx` → `EntityNode.tsx`, constants, functions, the threat-matrix internals), CSS classes, and every user-visible string.
- **Alias on read, rewrite on write, no `version` bump** — `normalizeLegacyFields` in `parseDiagram` (`src/shared/diagram.ts`) accepts the old names and normalizes immediately on load; `serializeDiagram` only ever writes the current ones. Same treatment applied to the one local-preferences case (`defaultStyles.shape` → `.entity`) in `normalizePreferences`.
- **[docs/file-format.md](../file-format.md) updated** — canonical names throughout, the legacy synonym documented inline at each affected field, and a new Versioning-section entry logging the rename.
- **Deferred, on purpose:** the 28 example `.chd` files under `examples/` still say `"shape"` — they load fine via the alias; rewriting them to the current name is its own follow-up task, after this lands and is tested.

## Candidate names (2026-09-07, logged for context — superseded by the 2026-09-30 decision above)

The user's framing this round: each shape represents "a concept or a context boundary within the layer the diagram represents," and is also **the unit the security matrix is built from** — the matrix is scoped to shapes only, never edges ([ADR 0082](../../decisions/0082-security-data-schema.md); the user's words there, "the shapes are the concepts, and the things that can be attacked"). So the replacement word ideally reads as "a distinct thing in the system that can carry context and be assessed," not as a visual primitive.

| Candidate | For | Against |
|---|---|---|
| **Concept** | User's first and current lean. Captures abstract things and context boundaries well; clearly not geometric. | "My database is not a concept — it's a database." Concrete infrastructure (a server, a DB, a queue) resists the word; reads as slightly abstract/precious for the everyday case. |
| **Context** | Matches "context boundary"; rhymes with the app's own "high-context" identity. | (1) Collides with the product-name direction — using the same word for the tool *and* its atomic unit muddies both. (2) The user's own point: if a shape *is* a "context," then its attached Details / metadata / linked diagram read as less obviously "the stuff about this one thing" — a context already implies surroundings. (3) "Boundary" is only one of the shape's roles. |
| **Entity** | The exact word [the glossary](../../architecture/glossary.md) already reaches for to explain what a Shape *is* ("it means 'an entity'"). Reads as a semantic category. "A database is an entity" / "a team is an entity" / "a trust boundary is an entity" all sit fine. Aligns with security vocabulary. | Mild ER-diagram association; a little dry. |
| **Asset** | Security-native — "asset-based risk assessment" is exactly the matrix's job. | Over-rotates on the security facet. The shape is the core primitive and security is *one* view of it ([ADR 0054](../../decisions/0054-progressive-disclosure-for-advanced-features.md) / [ADR 0055](../../decisions/0055-security-data-lives-on-diagram-elements.md) — the diagram stays central); naming the primitive after one of its facets is backwards. |
| **Node** | — | Ruled out: React Flow's own term, already `DiagramNode` throughout the code. |
| **Element** | — | Ruled out: already the umbrella term for everything on the canvas (shapes, edges, containers, text, lines). |
| **Component** | — | Ruled out: collides with C4's "Component" level; implies software specifically. |

Claude's recommendation (sparring input, not a decision): **Entity** as the lead — it's already the word the codebase uses in prose to describe the thing, it reads as a category rather than a shape, and it survives the "…but my database is a database" test better than Concept. Keep **Concept** as the fallback if a more abstract flavour is wanted. Actively avoid **Context** for the product-name collision.

## Tasks
- [x] Replacement name decided — Entity
- [x] Glossary updated ("Entity vs. Container")
- [x] Full code rename (identifiers, CSS, UI text) — ADR 0101
- [x] `.chd` field/value rename with alias-on-read — `normalizeLegacyFields` in `src/shared/diagram.ts`, unit-tested (`diagram.test.mjs`)
- [x] `docs/file-format.md` updated (canonical names, legacy synonym documented, Versioning entry)
- [x] `typecheck` / `lint` / `npm test`
- [x] Live test in the Electron renderer (user) — confirmed working
- [ ] Follow-up (separate task, after the above is confirmed): rewrite the 28 example `.chd` files under `examples/` to the current field names

## Notes
No further documentation-only vs. real-rename tension — this entry now reflects the completed rename, not just the name decision.
