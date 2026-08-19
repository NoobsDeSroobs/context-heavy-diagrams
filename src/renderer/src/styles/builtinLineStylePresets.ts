import type { EdgeStyle } from '@shared/diagram'

export interface LineStylePreset {
  id: string
  label: string
  keywords: string[]
  style: Partial<EdgeStyle>
}

// Deliberately minimal, generic entries only — see ADR 0010 and epic 0003's
// Notes. The notation-base question (which naming system(s) a *real*
// catalog should draw from — UML? ERD/crow's-foot? BPMN? something
// invented for this tool?) is explicitly deferred to a later, evidence-
// informed discussion. Do NOT add UML/ERD/BPMN-named presets here without
// that discussion happening first — these entries claim nothing beyond
// what they visually are.
export const builtinLineStylePresets: LineStylePreset[] = [
  {
    id: 'plain-line',
    label: 'Plain line',
    keywords: ['line', 'solid', 'plain'],
    style: { lineStyle: 'solid', startMarker: 'none', endMarker: 'none' }
  },
  {
    id: 'dashed-line',
    label: 'Dashed line',
    keywords: ['line', 'dashed'],
    style: { lineStyle: 'dashed', startMarker: 'none', endMarker: 'none' }
  },
  {
    id: 'dotted-line',
    label: 'Dotted line',
    keywords: ['line', 'dotted'],
    style: { lineStyle: 'dotted', startMarker: 'none', endMarker: 'none' }
  },
  {
    id: 'arrow',
    label: 'Arrow',
    keywords: ['arrow', 'directed'],
    style: { lineStyle: 'solid', startMarker: 'none', endMarker: 'arrowClosed' }
  },
  {
    id: 'open-arrow',
    label: 'Open arrow',
    keywords: ['arrow', 'open', 'directed'],
    style: { lineStyle: 'solid', startMarker: 'none', endMarker: 'arrowOpen' }
  },
  {
    id: 'dashed-arrow',
    label: 'Dashed arrow',
    keywords: ['arrow', 'dashed', 'directed'],
    style: { lineStyle: 'dashed', startMarker: 'none', endMarker: 'arrowClosed' }
  },
  {
    id: 'double-arrow',
    label: 'Double-headed arrow',
    keywords: ['arrow', 'bidirectional', 'two-way'],
    style: { lineStyle: 'solid', startMarker: 'arrowClosed', endMarker: 'arrowClosed' }
  }
]

export function searchLineStylePresets(query: string): LineStylePreset[] {
  const q = query.trim().toLowerCase()
  if (!q) return builtinLineStylePresets
  return builtinLineStylePresets.filter(
    (p) => p.label.toLowerCase().includes(q) || p.keywords.some((k) => k.includes(q))
  )
}
