// One (entity, threat) risk assessment — unchanged from the earlier
// prototype, now part of the persisted schema (ADR 0082). `probability`
// and `consequence` are values on the diagram's probability/consequence
// scales (DiagramSecurity below; absent scales mean the app's built-in
// 1-5). The two notes are independent free-text rationales — the reasoning
// for "why this probability" and "why this consequence" are usually
// unrelated, and both are optional.
export interface RiskCell {
  probability: number
  consequence: number
  probabilityNote?: string
  consequenceNote?: string
}

// One threat in a diagram's threat catalog (DiagramSecurity.threats).
// Id-keyed like every other catalog in this schema, so renaming a threat
// is display-only and never touches per-element data.
export interface SecurityThreat {
  id: string
  name: string
  description?: string
}

// One level of a probability or consequence scale — supersedes the earlier
// prototype's `ScaleLevel`.
export interface SecurityScaleLevel {
  value: number
  label: string
  description: string
}

// How a probability/consequence pair becomes one cell score, and how a
// list of cell scores becomes one row/column summary — see
// threatMatrixMath.ts for the actual arithmetic. NOT persisted: since
// ADR 0088 (recursive rollup) these are renderer session state on the
// active matrix view, applied uniformly down a linked-diagram tree; a
// per-file mode would be either ignored or inconsistent once a traversal
// spans files. Defaults 'multiply' / 'average'.
export type CombineMethod = 'multiply' | 'add' | 'average'
export type AggregateMethod = 'average' | 'sum' | 'max'

// Diagram-level security/threat configuration — see ADR 0082. Absent means
// the diagram has never used the Security Matrix (no `data.security` on any
// node either). Same "absent means unused" convention as `requiredTags` /
// `highlights` / `legend` / `gravityPresets` / `edgeDirectionSets`.
export interface DiagramSecurity {
  // The threat catalog — matrix row candidates. Ordered (row order). The
  // matrix's data model spans EVERY threat here, shown or hidden.
  threats: SecurityThreat[]
  // Subset of `threats` (by id) currently not shown as a matrix row. Still
  // part of the data model — hidden threats still need assessments for the
  // completeness alert to clear. Absent/empty means all threats shown.
  hiddenThreatIds?: string[]
  // The matrix's data model on the entity axis: ids of 'entity' nodes being
  // assessed. Ordered (column order). An entity NOT listed here has no
  // `data.security` at all. Ids that no longer resolve to a Entity node are
  // pruned on load.
  matrixEntityIds: string[]
  // Subset of `matrixEntityIds` (by id) currently not shown as a matrix
  // column. Data kept, still counts toward completeness. Absent/empty
  // means all shown.
  hiddenEntityIds?: string[]
  // Per-diagram scale definitions. Absent means the app's built-in 1-5
  // scales (see threatMatrixScale.ts) — same Diagram-value-or-built-in
  // pattern as gravityPresets (ADR 0052). No in-app editor in v1; the
  // fields persist and are read.
  probabilityScale?: SecurityScaleLevel[]
  consequenceScale?: SecurityScaleLevel[]
  // combineMethod / aggregateMethod are deliberately NOT here — they are
  // renderer session state, not persisted (ADR 0088). A file written by an
  // older build may still carry them; they are ignored on read.
}
