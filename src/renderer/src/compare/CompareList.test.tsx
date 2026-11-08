import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '@shared/compare/classify'
import CompareList from './CompareList'

afterEach(cleanup)

const item: ReviewItem = {
  kind: 'node',
  id: 'pay',
  label: 'Payments',
  change: {
    status: 'links',
    security: false,
    fields: [
      {
        field: 'Note file content',
        category: 'link',
        lines: ['Note file: content changed', '+ Refunds go through the same provider.'],
        before: undefined,
        after: undefined
      },
      {
        field: 'border colour',
        category: 'style',
        lines: ['border colour: #16a34a → #dc2626'],
        before: '#16a34a',
        after: '#dc2626'
      },
      {
        field: 'border width',
        category: 'style',
        lines: ['border width: 2 → 4'],
        before: 2,
        after: 4
      }
    ]
  }
}

describe('a row of the changes list', () => {
  it('lists every changed line, and draws a chip beside each colour', () => {
    const { container } = render(
      <CompareList
        items={[item]}
        currentKey={null}
        reviewed={new Set()}
        canRevert={false}
        revertStates={new Map()}
        onSelect={vi.fn()}
        onToggleReviewed={vi.fn()}
        onRevert={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const lines = [...container.querySelectorAll('.compare-row-line')].map((l) => l.textContent)
    expect(lines).toEqual([
      'Note file: content changed',
      '+ Refunds go through the same provider.',
      'border colour: #16a34a → #dc2626',
      'border width: 2 → 4'
    ])
    expect(container.querySelectorAll('.compare-chip')).toHaveLength(2)
    expect(screen.getByText('Payments')).toBeTruthy()
  })
})
