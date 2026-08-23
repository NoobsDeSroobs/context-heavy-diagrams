// Pure math for the threat/risk matrix prototype (epic 0060) — no notion
// of "diagram" or "React" here, same dependency-free-module precedent as
// bendablePath.ts/alignment.ts, so this survives untouched regardless of
// how (or whether) the surrounding view ends up wired into the rest of
// the app.

export interface RiskCell {
  probability: number
  consequence: number
  // Free-text justification for each number — separate fields since the
  // reasoning behind "why this probability" and "why this consequence"
  // are usually unrelated. Both optional: a value can stand on its own
  // without a written rationale.
  probabilityNote?: string
  consequenceNote?: string
}

// Two independently configurable calculations (the user's own ask):
// combineMethod turns a probability/consequence pair into one number —
// used identically for a cell's own score AND the grand-total cell (the
// same combine() call, just on different inputs, per the original spec:
// "the final cell... follows the same setting that the normal cells
// [use] for combining"). aggregateMethod turns a list of cell scores
// into one row/column summary (a threat score or a vulnerability score).
export type CombineMethod = 'multiply' | 'add' | 'average'
export type AggregateMethod = 'average' | 'sum' | 'max'

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

function aggregate(values: number[], method: AggregateMethod): number {
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
  return aggregate(
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
  return aggregate(
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
    aggregate(threatScores, aggregateMethod),
    aggregate(vulnerabilityScores, aggregateMethod),
    combineMethod
  )
}
