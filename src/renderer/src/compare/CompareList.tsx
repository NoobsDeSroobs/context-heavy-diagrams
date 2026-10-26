import { useEffect, useRef } from 'react'
import {
  describeCount,
  reviewKey,
  type CompareStatus,
  type ReviewItem
} from '@shared/compare/classify'

interface CompareListProps {
  items: ReviewItem[]
  currentKey: string | null
  reviewed: ReadonlySet<string>
  onSelect: (item: ReviewItem) => void
  onToggleReviewed: (item: ReviewItem) => void
  onPrevious: () => void
  onNext: () => void
}

const STATUS_TITLE: Record<CompareStatus, string> = {
  added: 'Added',
  removed: 'Removed',
  links: 'Link or Details changed',
  content: 'Modified'
}

// One line on what changed: the first of the lines the hover card would show.
function summary(item: ReviewItem): string {
  const { change } = item
  if (change.status === 'added') return item.kind === 'node' ? 'Added' : 'Added connection'
  if (change.status === 'removed') return item.kind === 'node' ? 'Removed' : 'Removed connection'
  const first = change.fields[0]?.lines[0] ?? STATUS_TITLE[change.status]
  const more = change.fields.length - 1
  return more > 0 ? `${first} (+${more} more)` : first
}

// Everything that changed, most important first (security, links, content, removed, added): a
// list that can be worked through to the end. A click shows the element on the canvas; the ticks
// are the reviewer's own and last only as long as this window.
export default function CompareList({
  items,
  currentKey,
  reviewed,
  onSelect,
  onToggleReviewed,
  onPrevious,
  onNext
}: CompareListProps): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (currentKey === null) return
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-key]') ?? []
    for (const row of rows) {
      if (row.dataset.key === currentKey) row.scrollIntoView({ block: 'nearest' })
    }
  }, [currentKey])

  const done = items.filter((item) => reviewed.has(reviewKey(item))).length
  const elements = items.filter((i) => i.kind === 'node').length
  const connections = items.length - elements

  return (
    <aside className="compare-list" aria-label="Changes">
      <div className="compare-list-header">
        <div className="compare-list-title">
          <strong>Changes</strong>
          <span>{describeCount({ nodes: elements, edges: connections })}</span>
        </div>
        <div className="compare-list-nav">
          <button
            type="button"
            onClick={onPrevious}
            disabled={items.length === 0}
            title="Previous change (P or ↑)"
            aria-label="Previous change"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={items.length === 0}
            title="Next change (N or ↓)"
            aria-label="Next change"
          >
            ↓
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="compare-list-progress" role="status">
          {done} of {items.length} reviewed
          <progress max={items.length} value={done} />
        </div>
      )}
      {items.length === 0 ? (
        <p className="compare-list-empty">No element or connection changed.</p>
      ) : (
        <ul ref={listRef} className="compare-list-rows">
          {items.map((item) => {
            const key = reviewKey(item)
            const isReviewed = reviewed.has(key)
            return (
              <li
                key={key}
                data-key={key}
                className={`compare-row cmp-row-${item.change.status}${
                  key === currentKey ? ' compare-row-current' : ''
                }${isReviewed ? ' compare-row-reviewed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isReviewed}
                  onChange={() => onToggleReviewed(item)}
                  aria-label={`Reviewed: ${item.label}`}
                  title="Mark as reviewed (Space on the selected change)"
                />
                <button
                  type="button"
                  className="compare-row-target"
                  title={STATUS_TITLE[item.change.status]}
                  onClick={() => onSelect(item)}
                >
                  <span className="compare-row-head">
                    <span className="compare-row-dot" aria-hidden="true" />
                    <span className="compare-row-kind">
                      {item.kind === 'node' ? 'element' : 'connection'}
                    </span>
                    {item.change.security && <span className="compare-row-security">security</span>}
                    <span className="compare-row-label">{item.label}</span>
                  </span>
                  <span className="compare-row-summary">{summary(item)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
