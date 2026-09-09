# 0076: Rename "Shape" to something like "Concept"

## Status
Not Started, and deliberately held there — the user explicitly chose glossary-only documentation over an actual rename for now, and separately wants to defer the replacement-name decision itself ("I wanna defer this decision because it is quite important"). Raised by the user (2026-08-24) alongside epic 0060 design work, but unrelated to it.

## Goal
The user's own framing: a Shape and a Container remain conceptually different things even if every style property is set identically between them — a Container represents grouping/boundary, a Shape represents a standalone entity. "Shape" undersells that distinction, reading as a purely geometric/visual term rather than a semantic category. Something like "Concept" (or another name capturing "a distinct thing in the system," independent of how it's styled) might fit better.

## Why this is bigger than a label change
- `'shape'` is a literal stored string in `DiagramNode.type` in every existing `.chd` file, not just a UI label — renaming it is a real file-format change, not a cosmetic one.
- Backward compatibility: [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md) requires old files to keep loading correctly — needs either an alias (`'shape'` still accepted on read, written as the new name going forward) or a real migration, not a silent breaking rename. (Less of a hard blocker than it would normally be — the user pointed out the app is pre-beta with them as the only user right now, so there's no real installed base of other people's files to protect. That removed the main objection to doing the rename *now*, but the user still chose not to.)

## Decided 2026-08-24: hold at documentation only, for now
Given three options (keep the internal name and only change the displayed label; document the distinction in the glossary without renaming anything; do the real rename now, leveraging the pre-beta/single-user situation), the user chose **documentation only**: no code or file-format change at all right now. [docs/architecture/glossary.md](../../architecture/glossary.md) now has a "Shape vs. Container" entry explaining the semantic distinction independent of whatever the type ends up being called.

The replacement name itself ("Concept" was only the user's first offering) is explicitly deferred as its own decision, described as "quite important" — not to be rushed alongside this smaller documentation step.

## Real open questions (deliberately not resolved here)
- The actual replacement word — see the candidate list below.
- Alias-on-read vs. a real `.chd` schema version bump for the migration, if/when the real rename happens.
- Whether this is worth doing before or after the product naming question (epic 0027) settles, given both are "what do we call things" work happening around the same time.

## Candidate names (2026-09-07, logged for later — not decided)

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

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.
