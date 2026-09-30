// Pure math for the threat/risk matrix — no notion of "React" here, and no
// filesystem. Lives in @shared (not the renderer) because the recursive
// rollup (ADR 0088) is walked by the main-process crawler as well as the
// view. RiskCell / CombineMethod / AggregateMethod are schema types from
// ./diagram; this module just does the arithmetic.

import type { AggregateMethod, CombineMethod, RiskCell } from './diagram'

export type { AggregateMethod, CombineMethod, RiskCell }

// The cell the editor opens on for an un-assessed pair — the scale's own
// lowest value, just so the selects have something selected. Only written
// to `data.security` once the user actually picks a value; never seeded
// eagerly (ADR 0082).
export const BLANK_RISK_CELL: RiskCell = { probability: 1, consequence: 1 }

// combineMethod turns a probability/consequence pair into one number —
// used identically for a cell's own score AND the grand-total cell (the
// same combine() call, just on different inputs). aggregateMethod turns a
// list of cell scores into one row/column summary (a threat score or a
// vulnerability score).

export const COMBINE_METHOD_LABELS: Record<CombineMethod, string> = {
  multiply: 'Multiply (P × C)',
  add: 'Add (P + C)',
  average: 'Average ((P + C) / 2)'
}

export const AGGREGATE_METHOD_LABELS: Record<AggregateMethod, string> = {
  average: 'Average',
  sum: 'Sum',
  max: 'Max (worst case)'
}

export function combine(a: number, b: number, method: CombineMethod): number {
  switch (method) {
    case 'multiply':
      return a * b
    case 'add':
      return a + b
    case 'average':
      return (a + b) / 2
  }
}

// Roll a list of scores up into one summary. Exported because the rollup
// view aggregates a mix of leaf cell scores and already-derived child
// scores in the same row/column (ADR 0088).
export function aggregateScores(values: number[], method: AggregateMethod): number {
  if (values.length === 0) return 0
  switch (method) {
    case 'average':
      return values.reduce((sum, v) => sum + v, 0) / values.length
    case 'sum':
      return values.reduce((sum, v) => sum + v, 0)
    case 'max':
      return Math.max(...values)
  }
}

// A cell's own displayed value — never the raw probability/consequence
// pair, per the user's own spec ("the cell itself does not show these
// values, but the result of... combining them").
export function cellScore(cell: RiskCell, combineMethod: CombineMethod): number {
  return combine(cell.probability, cell.consequence, combineMethod)
}

// Per-threat "threat score" — every service's cell score for that one
// threat, aggregated row-wise.
export function threatScore(
  cellsForThreat: RiskCell[],
  combineMethod: CombineMethod,
  aggregateMethod: AggregateMethod
): number {
  return aggregateScores(
    cellsForThreat.map((cell) => cellScore(cell, combineMethod)),
    aggregateMethod
  )
}

// Per-service "vulnerability score" — every threat's cell score for that
// one service, aggregated column-wise.
export function vulnerabilityScore(
  cellsForService: RiskCell[],
  combineMethod: CombineMethod,
  aggregateMethod: AggregateMethod
): number {
  return aggregateScores(
    cellsForService.map((cell) => cellScore(cell, combineMethod)),
    aggregateMethod
  )
}

// The single grand-total cell: the overall threat scores and vulnerability
// scores each aggregated down to one number (aggregateMethod again), then
// combined into one (combineMethod) — not a third, separate formula.
export function totalSecurityScore(
  threatScores: number[],
  vulnerabilityScores: number[],
  combineMethod: CombineMethod,
  aggregateMethod: AggregateMethod
): number {
  return combine(
    aggregateScores(threatScores, aggregateMethod),
    aggregateScores(vulnerabilityScores, aggregateMethod),
    combineMethod
  )
}

// --- Recursive rollup across linked diagrams (ADR 0088) ---

// Threats are matched across linked files by NAME, not id (ids are
// per-diagram). Normalize before comparing: trim, collapse internal
// whitespace, casefold. "  Phishing\tattack " and "phishing attack" match.
export function normalizeThreatName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

// One entity in a crawled subtree. A leaf (no linked diagram) carries its own
// hand-entered `cells`, keyed by normalized threat name. A non-leaf carries
// `child` instead — its own cells are never consulted, its score is entirely
// its subtree's rollup (a non-leaf entity is derived, not assessed).
// `linkBroken` marks a entity whose linked diagram didn't resolve: it can be
// neither assessed nor rolled up, so it contributes nothing.
export interface CrawledEntity {
  id: string
  label: string
  cells: Record<string, RiskCell>
  child?: CrawledMatrix
  linkBroken?: { relativePath: string }
}

// One diagram's matrix contribution in a rollup crawl — the entities in its
// own `security.matrixEntityIds`, each resolved to a leaf or a nested child.
// Produced by the main-process crawler; the tree is already acyclic (the
// crawler drops a link that revisits an ancestor).
export interface CrawledMatrix {
  entities: CrawledEntity[]
}

// One root matrix column that has a linked diagram (ADR 0088). `resolved`
// carries the crawled subtree; `broken` means the link didn't resolve — the
// view marks those cells rather than computing them.
export type CrawledColumn =
  | { kind: 'resolved'; relativePath: string; matrix: CrawledMatrix }
  | { kind: 'broken'; relativePath: string }

// The `security:crawlLinked` IPC result: one entry per root matrix entity
// that has a linked diagram, keyed by entity id, plus any non-fatal warnings
// hit while walking (deeper broken links, ancestor cycles) for Diagnostics.
export interface SecurityCrawlResult {
  columns: Record<string, CrawledColumn>
  warnings: string[]
}

// The rolled-up threat score for one normalized threat name over a crawled
// subtree, using the ACTIVE VIEW's two modes (ADR 0088 — modes flow down
// uniformly, they are not read per file). `null` when nothing downstream is
// assessed for that threat — a real "not assessed" state, distinct from a
// genuine low numeric score.
export function threatScoreFor(
  matrix: CrawledMatrix,
  normalizedThreatName: string,
  combineMethod: CombineMethod,
  aggregateMethod: AggregateMethod
): number | null {
  const contributions: number[] = []
  for (const entity of matrix.entities) {
    if (entity.linkBroken) continue // can't roll up or assess — contributes nothing
    if (entity.child) {
      const childScore = threatScoreFor(
        entity.child,
        normalizedThreatName,
        combineMethod,
        aggregateMethod
      )
      if (childScore !== null) contributions.push(childScore)
    } else {
      const cell = entity.cells[normalizedThreatName]
      if (cell) contributions.push(cellScore(cell, combineMethod))
    }
  }
  return contributions.length === 0 ? null : aggregateScores(contributions, aggregateMethod)
}

// Every normalized threat name assessed anywhere in a crawled subtree —
// the parent matrix offers a row for each (its own catalog ∪ this set).
export function threatNamesInSubtree(matrix: CrawledMatrix): Set<string> {
  const names = new Set<string>()
  const walk = (m: CrawledMatrix): void => {
    for (const entity of m.entities) {
      if (entity.linkBroken) continue
      if (entity.child) walk(entity.child)
      else for (const name of Object.keys(entity.cells)) names.add(name)
    }
  }
  walk(matrix)
  return names
}
