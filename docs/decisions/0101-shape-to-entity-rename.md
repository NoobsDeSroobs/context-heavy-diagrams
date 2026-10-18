# 0101: Shape renamed to Entity, end to end, with an alias on read

## Status
Accepted (2026-09-30); implemented and live-tested. Follows [ADR 0100](0100-command-palette-reuses-the-menu-bar.md) (command palette, the last thing before this rename in the planned sequence).

## Context
The node type called "Shape" — a standalone entity in whatever the diagram models, as opposed to a Container's grouping/boundary role — had its replacement name decided as **Entity**, documented in the glossary's "Entity vs. Container" entry. That was a documentation-only step at the time. The actual rename — every place `'shape'` appears as a stored value, a code identifier, a CSS class, or user-visible text — turned out to have far more surface area than expected once surveyed (561 raw matches across 58 source files), enough that the user asked for it to be done as one deliberate pass rather than by hand.

## Decision
**Full rename**, not just the stored type value or just the UI labels:
- The `.chd` type value `'shape'` → `'entity'` (`DiagramNode.type`).
- Two other places a `.chd` file carried the word: a legend entry's `kind: 'shape'` → `'entity'`, and `DiagramSecurity`'s `matrixShapeIds`/`hiddenShapeIds` → `matrixEntityIds`/`hiddenEntityIds`.
- Every code identifier: the component (`ShapeNode.tsx` → `EntityNode.tsx`), constants (`SHAPE_MIN_WIDTH`/`SHAPE_MIN_HEIGHT`/`SHAPE_BASE` → `ENTITY_*`), functions (`addShapeNode` → `addEntityNode`), the `CrawledMatrix`/threat-matrix internals (`CrawledShape` → `CrawledEntity`, `matrix.shapes` → `matrix.entities`, every handler prop named after it).
- CSS classes (`.shape-node` → `.entity-node`, and everything under it — icon slots, label, hover rules, highlight/search-match variants — plus `.style-brush-shape`/`.threat-matrix-add-shape-select`/`.item-palette-icon-shape`). React Flow's own auto-generated `.react-flow__node-shape` class changes for free once the node's `type` does, but the app's own CSS selectors referencing it by name had to move too.
- Every user-visible string: button/menu labels ("Shape" → "Entity", "Attach contained shapes" → "Attach contained entities", "Select all shapes" → "Select all entities"), tooltips, dialog copy, diagnostic/notice messages, the Security Matrix panel's own copy ("+ Add a shape to assess…", "Draw a shape first.", etc.).
- A local preferences field, `defaultStyles.shape` → `defaultStyles.entity` (per-type default style, `AppPreferences`).
- Comments that genuinely describe the node type (not comments using "shape" as an ordinary English word for a data structure's *shape* — those were left alone; see Consequences).

**Backward compatibility: alias on read, rewrite on write — no `version` bump.** Per [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md)'s standing rule, an old file must keep opening. A new `normalizeLegacyFields` step inside `parseDiagram` (`src/shared/diagram.ts` — the one function both the main process and, transitively, the renderer funnel every `.chd` read through) rewrites `type: 'shape'` → `'entity'`, a legend entry's `kind: 'shape'` → `'entity'`, and folds `matrixShapeIds`/`hiddenShapeIds` into `matrixEntityIds`/`hiddenEntityIds`, all immediately on load — nothing downstream of `parseDiagram` ever sees the old names. `serializeDiagram` only ever writes the current names, so a loaded-then-saved file silently upgrades itself on its next save. The equivalent local-preferences case (`defaultStyles.shape`) gets the same treatment in `normalizePreferences`, following that function's existing precedent (it already migrates a pre-ADR-0068 single-palette shape the same way).

**Deferred, deliberately, per the user's own call:** updating the 28 example `.chd` files under `examples/` to write `"entity"` instead of `"shape"`. They kept loading unmodified via the alias; re-writing them was its own follow-up, done afterwards (2026-10-17) by targeted replacements, with each file checked to read identically to what the loader had produced from the old text.

## What a reader should take away
- `"shape"` is a synonym for `"entity"` everywhere it could appear in a `.chd` file (node `type`, legend `kind`, the two security id-list field names) — accept either on read, but a writer should only ever emit the current names. [docs/file-format.md](../file-format.md) documents this inline at each affected field, and its Versioning section logs the rename.
- No `.chd` `version` bump — this is additive in the same sense every other field addition in this format's history has been: an old file still opens, unmodified, without any reader-side migration step beyond accepting the synonym.

## Alternatives considered
- **Stored type + UI labels only, leave internal identifiers alone** — the other option offered before starting. Rejected (by the user): it would leave `ShapeNode.tsx`, `addShapeNode`, `.shape-node` etc. permanently out of step with what the type is actually called, which is exactly the kind of drift a deliberate one-pass rename exists to avoid.
- **No backward-compat alias, since there's no real installed base yet** — the same argument the original 2026-08-24 glossary-only decision considered and didn't take. Rejected again here: [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md) is a standing rule, not a per-change judgment call, and the alias cost is one small pure function, not a design burden.
- **A `.chd` schema version bump** — unnecessary. A version bump is for a *breaking* change to an existing field's meaning; this is a same-meaning rename with an accepted synonym, the same category as every additive change already logged in file-format.md's Versioning section.

## Consequences
- The examples under `examples/` were converted to `"entity"` in the follow-up; only opaque ids such as `shape-1` and ordinary prose still say "shape".
- A handful of comments that use "shape" as an ordinary English word — "the shape of this data structure," "array shape," "a node's Node shape" — were deliberately left alone; they were never about the node type, and rewriting them to avoid the word entirely would read strangely. The dividing line applied throughout: fixed wherever "shape" named the node type (an identifier, a stored value, UI copy, or a comment explicitly discussing that type); left wherever it meant literal or structural shape.
- `docs/known-issues.md` entries from before this rename describe the code as it was *at the time* (e.g. a bug found in `.shape-node`'s CSS) — left as historical record, except for "References:"-style pointers and UI-label repro steps, which were updated to the current names so the entries stay useful for relocating the relevant code today.
- Historical ADRs (including this format's own naming history, e.g. [ADR 0004](0004-shape-text-node-split.md)) are not rewritten — they record what was decided and named at the time.
