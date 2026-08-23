export interface ScaleLevel {
  value: number
  label: string
  description: string
}

// Made-up placeholder ranges (epic 0060 prototype, "you can just make up
// some ranges for now"). Needs to become configurable eventually — this
// is deliberately not that yet, just enough to make cell editing and the
// reference panel meaningful.
export const PROBABILITY_SCALE: ScaleLevel[] = [
  { value: 1, label: 'Rare', description: 'Could happen, but only in exceptional circumstances' },
  { value: 2, label: 'Unlikely', description: 'Not expected, but has happened before elsewhere' },
  { value: 3, label: 'Possible', description: 'Might happen at some point' },
  { value: 4, label: 'Likely', description: 'Will probably happen in most circumstances' },
  { value: 5, label: 'Almost certain', description: 'Expected to happen, possibly more than once' }
]

export const CONSEQUENCE_SCALE: ScaleLevel[] = [
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
