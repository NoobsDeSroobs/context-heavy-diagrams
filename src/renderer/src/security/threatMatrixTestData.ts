import type { RiskCell } from './threatMatrixMath'

// Placeholder content for the threat-matrix prototype — plausible, not real.
// Probability/consequence are both a 1-5 scale (a common Likert-style
// risk-scoring convention), hand-picked per pair to make the rendered
// matrix look like a real one (varied, not a flat grid of identical
// numbers) rather than to model any actual company's real risk posture.
export const TEST_THREATS = [
  'DDoS',
  'Rogue employee',
  'Man-in-the-middle attack',
  'Phishing',
  'Ransomware'
]

export const TEST_SERVICES = [
  'Receipt service',
  'Email service',
  'Order flow service',
  'Customer service',
  'Payment service'
]

export const TEST_CELLS: Record<string, Record<string, RiskCell>> = {
  DDoS: {
    'Receipt service': { probability: 3, consequence: 3 },
    'Email service': { probability: 2, consequence: 2 },
    'Order flow service': { probability: 4, consequence: 5 },
    'Customer service': { probability: 3, consequence: 3 },
    'Payment service': { probability: 4, consequence: 5 }
  },
  'Rogue employee': {
    'Receipt service': { probability: 2, consequence: 2 },
    'Email service': { probability: 3, consequence: 3 },
    'Order flow service': { probability: 2, consequence: 4 },
    'Customer service': { probability: 4, consequence: 4 },
    'Payment service': { probability: 3, consequence: 5 }
  },
  'Man-in-the-middle attack': {
    'Receipt service': { probability: 2, consequence: 3 },
    'Email service': { probability: 3, consequence: 3 },
    'Order flow service': { probability: 2, consequence: 3 },
    'Customer service': { probability: 2, consequence: 4 },
    'Payment service': { probability: 3, consequence: 5 }
  },
  Phishing: {
    'Receipt service': { probability: 2, consequence: 2 },
    'Email service': { probability: 5, consequence: 4 },
    'Order flow service': { probability: 2, consequence: 3 },
    'Customer service': { probability: 3, consequence: 3 },
    'Payment service': { probability: 3, consequence: 5 }
  },
  Ransomware: {
    'Receipt service': { probability: 2, consequence: 3 },
    'Email service': { probability: 3, consequence: 3 },
    'Order flow service': { probability: 2, consequence: 5 },
    'Customer service': { probability: 2, consequence: 3 },
    'Payment service': { probability: 2, consequence: 5 }
  }
}
