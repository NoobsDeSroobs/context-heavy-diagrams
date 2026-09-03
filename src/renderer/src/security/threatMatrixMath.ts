// Pure math for the threat/risk matrix — no notion of "diagram" or "React"
// here, same dependency-free-module precedent as bendablePath.ts/
// alignment.ts. The data types (RiskCell, CombineMethod, AggregateMethod)
// are part of the persisted schema and live in @shared/diagram (ADR 0082);
// this module just imports them and does the arithmetic.

import type { AggregateMethod, CombineMethod, RiskCell } from '@shared/diagram'

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
