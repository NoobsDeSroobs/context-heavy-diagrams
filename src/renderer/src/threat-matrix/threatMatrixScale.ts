import type { DiagramSecurity, SecurityScaleLevel } from '@shared/diagram'

// This app's built-in probability/consequence scales — the fallback when a
// diagram's own `security.probabilityScale` / `.consequenceScale` are
// absent (ADR 0082, same Diagram-value-or-built-in pattern as gravity
// presets). A 1-5 Likert-style scale is the common risk-scoring
// convention; a specific org can override per diagram (no in-app editor in
// v1 — the fields persist and are read).
export const DEFAULT_PROBABILITY_SCALE: SecurityScaleLevel[] = [
  { value: 1, label: 'Rare', description: 'Could happen, but only in exceptional circumstances' },
  { value: 2, label: 'Unlikely', description: 'Not expected, but has happened before elsewhere' },
  { value: 3, label: 'Possible', description: 'Might happen at some point' },
  { value: 4, label: 'Likely', description: 'Will probably happen in most circumstances' },
  { value: 5, label: 'Almost certain', description: 'Expected to happen, possibly more than once' }
]

export const DEFAULT_CONSEQUENCE_SCALE: SecurityScaleLevel[] = [
  { value: 1, label: 'Negligible', description: 'No meaningful impact on the business' },
  { value: 2, label: 'Minor', description: 'Short, localized disruption or harm' },
  { value: 3, label: 'Moderate', description: 'Noticeable disruption or harm' },
  {
    value: 4,
    label: 'Major',
    description: 'Significant harm to operations, customers, or reputation'
  },
  { value: 5, label: 'Severe', description: 'Critical, potentially existential harm' }
]

// The scales actually in effect for a diagram — its own if defined,
// otherwise the built-ins.
export function effectiveScales(security: DiagramSecurity | undefined): {
  probabilityScale: SecurityScaleLevel[]
  consequenceScale: SecurityScaleLevel[]
} {
  return {
    probabilityScale:
      security?.probabilityScale && security.probabilityScale.length > 0
        ? security.probabilityScale
        : DEFAULT_PROBABILITY_SCALE,
    consequenceScale:
      security?.consequenceScale && security.consequenceScale.length > 0
        ? security.consequenceScale
        : DEFAULT_CONSEQUENCE_SCALE
  }
}
