# 0107: Exposing a single element's security data outside the matrix

## Status
Not Started — carved out of [epic 0079](0079-security-data-as-diagram-element-property.md)
(2026-09-01) at the user's request. Blocked on 0079 landing (the data has
to exist and persist first). Needs its own design pass.

## Goal
Once a Shape carries real `data.security` (epic 0079 / [ADR 0082](../../decisions/0082-security-data-schema.md)),
let someone see and edit *one* shape's threat assessment without opening
the full Security Matrix — the motivating case from [ADR 0055](../../decisions/0055-security-data-lives-on-diagram-elements.md):
"looking at one service shouldn't require scanning a potentially long
matrix to find its row."

## Why it's deferred, not part of 0079
The user's call (2026-09-01): the Property panel is **already crowded**
(Fill / Border / Font / Transform / Connection points / Metadata /
References sections), and a naive "add a Security section" makes that
worse. How per-element security should surface on the diagram side —
Property panel section, a dedicated popup, an on-canvas badge/overlay, a
right-click summary, some combination — is a real design question, not a
mechanical add. Better to see 0079's matrix working on real data first,
then design this against actual use.

## Open questions (not yet designed)
- **Where** — a `CollapsibleSection` (collapsed by default) like Metadata/
  References? A separate floating panel opened from a context-menu item
  (like "Reference images…")? Both?
- **On-canvas signal** — should an assessed shape show a risk indicator
  (a coloured corner dot keyed to its vulnerability score), toggleable
  like highlights? That edges toward a whole "risk heatmap" overlay mode,
  which may deserve its own epic.
- **Editing parity** — does this reuse `ThreatMatrixCellEditor` per threat,
  or a compact all-threats-for-this-shape view?
- **Completeness** — should the per-shape view show its own "3 of 6
  threats assessed" the way the matrix overview does globally?
- **Non-matrix shapes** — can you start assessing a shape from here
  (adding it to `matrixShapeIds`), or only view/edit shapes already in the
  matrix?

## Notes
Keep this narrow: it's about *surfacing* existing data, not new data
model. Anything that changes `DiagramSecurity` / `data.security` belongs
back in 0079 or a schema follow-up.
