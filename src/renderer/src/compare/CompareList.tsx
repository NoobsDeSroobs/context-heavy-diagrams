import { useEffect, useRef } from 'react'
import {
  describeCount,
  flattenReview,
  reviewKey,
  type CompareStatus,
  type ReviewItem
} from '@shared/compare/classify'
import { STATUS_LABEL, kindName, summarizeItem, withItNote } from '@shared/compare/format'

// What came of a revert asked for in the editor window.
export interface RevertState {
  ok: boolean
  message?: string
}

interface CompareListProps {
  items: ReviewItem[]
  currentKey: string | null
  reviewed: ReadonlySet<string>
  // A revert is made in the editor window of the same file, so a comparison of an unsaved diagram
  // has none to offer.
  canRevert: boolean
  revertStates: ReadonlyMap<string, RevertState>
  onSelect: (item: ReviewItem) => void
  onToggleReviewed: (item: ReviewItem) => void
  onRevert: (item: ReviewItem) => void
  onPrevious: () => void
  onNext: () => void
}

const REVERT_LABEL: Record<CompareStatus, string> = {
  added: 'Remove',
  removed: 'Restore',
  links: 'Revert',
  content: 'Revert'
}

// A note's text is a file, not part of the element, so a revert cannot put it back.
function touchesNoteText(item: ReviewItem): boolean {
  return item.change.fields.some((f) => f.field === 'Details file content')
}

function revertTitle(item: ReviewItem): string {
  const where = 'in the editor window (Ctrl+Z there undoes it)'
  const note = touchesNoteText(item) ? " The note's text is not restored." : ''
  switch (item.change.status) {
    case 'added':
      return `Remove this ${where}; it is not in the earlier version.${note}`
    case 'removed':
      return `Bring this back ${where}, with its connections where they can be drawn.${note}`
    default:
      return `Put this back as it was in the earlier version, ${where}.${note}`
  }
}

function revertDoneNote(item: ReviewItem): string {
  return touchesNoteText(item)
    ? "Done in the editor window. The note's text was not restored."
    : 'Done in the editor window.'
}

// Everything that changed, most important first (security, links, content, removed, added): a
// list that can be worked through to the end. A click shows the element on the canvas; the ticks
// are the reviewer's own and last only as long as this window.
export default function CompareList({
  items,
  currentKey,
  reviewed,
  canRevert,
  revertStates,
  onSelect,
  onToggleReviewed,
  onRevert,
  onPrevious,
  onNext
}: CompareListProps): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (currentKey === null) return
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-key]') ?? []
    for (const row of rows) {
      if (row.dataset.key !== currentKey) continue
      // A connection inside a closed group is shown by opening the group.
      row.closest('details')?.setAttribute('open', '')
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [currentKey])

  const done = items.filter((item) => reviewed.has(reviewKey(item))).length
  const everything = flattenReview(items)
  const elements = everything.filter((i) => i.kind === 'node').length
  const connections = everything.length - elements

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
      {canRevert && items.length > 0 && (
        <p className="compare-list-hint">
          A revert is made in the editor window of this diagram. If that window still shows the
          earlier version, reload it first.
        </p>
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
                className={`compare-row-item cmp-row-${item.change.status}${
                  key === currentKey ? ' compare-row-current' : ''
                }${isReviewed ? ' compare-row-reviewed' : ''}`}
              >
                <div className="compare-row">
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
                    title={STATUS_LABEL[item.change.status]}
                    onClick={() => onSelect(item)}
                  >
                    <span className="compare-row-head">
                      <span className="compare-row-dot" aria-hidden="true" />
                      <span className="compare-row-kind">{kindName(item)}</span>
                      {item.change.security && (
                        <span className="compare-row-security">security</span>
                      )}
                      <span className="compare-row-label">{item.label}</span>
                    </span>
                    <span className="compare-row-summary">{summarizeItem(item)}</span>
                  </button>
                  {canRevert && (
                    <button
                      type="button"
                      className="compare-row-revert"
                      title={revertTitle(item)}
                      disabled={revertStates.get(key)?.ok === true}
                      onClick={() => onRevert(item)}
                    >
                      {revertStates.get(key)?.ok === true
                        ? 'Done'
                        : REVERT_LABEL[item.change.status]}
                    </button>
                  )}
                </div>
                {revertStates.get(key) && (
                  <p
                    className={`compare-row-revert-note${
                      revertStates.get(key)?.ok ? '' : ' compare-row-revert-error'
                    }`}
                  >
                    {revertStates.get(key)?.ok
                      ? revertDoneNote(item)
                      : (revertStates.get(key)?.message ?? 'It could not be reverted.')}
                  </p>
                )}
                {item.connections && item.connections.length > 0 && (
                  <details className="compare-row-connections">
                    <summary>{withItNote(item)}</summary>
                    <ul>
                      {item.connections.map((connection) => {
                        const connectionKey = reviewKey(connection)
                        return (
                          <li
                            key={connectionKey}
                            data-key={connectionKey}
                            className={connectionKey === currentKey ? 'compare-row-current' : ''}
                          >
                            <button
                              type="button"
                              className="compare-row-target"
                              onClick={() => onSelect(connection)}
                            >
                              {connection.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
