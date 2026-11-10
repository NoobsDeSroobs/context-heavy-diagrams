import { useEffect, useMemo, useRef, useState } from 'react'
import type { RequiredTagDefinition } from '@shared/diagram'
import { detectDelimiter, looksLikeTable, parseTable } from '@shared/bulk-create/table'
import {
  buildElements,
  containerKeyOf,
  guessColumns,
  listElements,
  type ColumnRole
} from '@shared/bulk-create/elements'
import { prepareElements, type PreparedElement } from '@shared/bulk-create/prepare'

interface BulkCreateDialogProps {
  // 'entity' / 'container': which palette button was right-clicked.
  typeLabel: 'entity' | 'container'
  requiredTags: RequiredTagDefinition[]
  onConfirm: (elements: PreparedElement[]) => void
  onClose: () => void
}

type Layout = 'auto' | 'list' | 'table'

const PREVIEW_ROWS = 5
const MAX_LISTED = 5

// Right-click entry point on ItemPalette's Entity/Container buttons — see ADR 0089 for the list of
// labels and ADR 0168 for the table. Styled after ExportImageDialog's centered-overlay shell
// rather than the click-anchored popups (ColorPickerPopup/IconPicker); a multi-line paste target
// reads better centered than pinned to a small button's corner.
export default function BulkCreateDialog({
  typeLabel,
  requiredTags,
  onConfirm,
  onClose
}: BulkCreateDialogProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [layout, setLayout] = useState<Layout>('auto')
  // Roles set by hand, kept only while the header they were set for is still the header.
  const [overrides, setOverrides] = useState<{ header: string; roles: Record<number, ColumnRole> }>(
    {
      header: '',
      roles: {}
    }
  )
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const rows = useMemo(() => parseTable(text, detectDelimiter(text)), [text])
  const isTable = layout === 'table' || (layout === 'auto' && looksLikeTable(rows))
  const header = rows[0]
  const headerKey = header ? header.join('\u0001') : ''

  const columns = useMemo(() => {
    if (!isTable || !header) return []
    return guessColumns(header).map((column, index) =>
      overrides.header === headerKey && overrides.roles[index]
        ? { ...column, role: overrides.roles[index] }
        : column
    )
  }, [isTable, header, headerKey, overrides])

  const built = useMemo(
    () => (isTable ? buildElements(rows.slice(1), columns, { type: typeLabel }) : null),
    [isTable, rows, columns, typeLabel]
  )
  const prepared = useMemo(
    () =>
      prepareElements(
        built ? built.elements : listElements(text),
        requiredTags,
        built ? containerKeyOf(columns) : undefined
      ),
    [built, text, requiredTags, columns]
  )

  const warnings = [
    ...(built?.conflicts ?? []),
    ...(built && built.blankLabelRows > 0
      ? [
          `${built.blankLabelRows} row${built.blankLabelRows === 1 ? ' has' : 's have'} no label: left out`
        ]
      : []),
    ...prepared.warnings
  ]
  const count = prepared.elements.length
  const plurals = typeLabel === 'entity' ? 'entities' : 'containers'
  const plural = count === 1 ? typeLabel : plurals
  const confirm = (): void => {
    if (count === 0) return
    onConfirm(prepared.elements)
  }

  const setRole = (index: number, role: ColumnRole): void =>
    setOverrides({
      header: headerKey,
      roles: { ...(overrides.header === headerKey ? overrides.roles : {}), [index]: role }
    })

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog bulk-create-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Create multiple {plurals}</span>
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="about-dialog-body">
          <p>
            One line per {typeLabel}, each its label. Or paste a table with a header row, copied
            from a spreadsheet or comma-separated: the column named Name is the label, Description
            the note, Domain or Group the container, and any other column a tag.
          </p>
          <textarea
            ref={textareaRef}
            className="bulk-create-textarea"
            value={text}
            placeholder={'l1\nl2\nl3'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                confirm()
              }
            }}
          />
          <label className="bulk-create-layout">
            Read the paste as{' '}
            <select value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
              <option value="auto">Auto-detect</option>
              <option value="list">One label per line</option>
              <option value="table">A table with a header row</option>
            </select>
          </label>

          {isTable && header && rows.length > 1 && (
            <div className="bulk-create-preview">
              <table>
                <thead>
                  <tr>
                    {columns.map((column, index) => (
                      <th key={index}>
                        <div className="bulk-create-header">{column.header || '(no header)'}</div>
                        <select
                          value={column.role}
                          aria-label={`What column ${column.header || index + 1} is`}
                          onChange={(e) => setRole(index, e.target.value as ColumnRole)}
                        >
                          <option value="label">Label</option>
                          <option value="note">
                            {typeLabel === 'container' ? 'Description (a tag)' : 'Note'}
                          </option>
                          <option value="container">Container</option>
                          <option value="tag">Tag</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1, 1 + PREVIEW_ROWS).map((row, r) => (
                    <tr key={r}>
                      {columns.map((_, c) => (
                        <td key={c} title={row[c] ?? ''}>
                          {row[c] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length - 1 > PREVIEW_ROWS && (
                <p className="bulk-create-count">and {rows.length - 1 - PREVIEW_ROWS} more rows</p>
              )}
              {columns.some((c) => c.role === 'container') && (
                <p className="bulk-create-count">
                  A container column is kept as a tag for now; the {plurals} are not put into
                  containers yet.
                </p>
              )}
            </div>
          )}
          {layout === 'table' && !(header && rows.length > 1) && text.trim() !== '' && (
            <p className="bulk-create-count">
              A table needs a header row and at least one more row.
            </p>
          )}

          <p className="bulk-create-count">
            {isTable && built
              ? `${built.rows} row${built.rows === 1 ? '' : 's'} give ${count} ${plural}`
              : `${count} ${plural} will be created`}
            {prepared.noteCount > 0
              ? `, with ${prepared.noteCount} note${prepared.noteCount === 1 ? '' : 's'} (a file each when the diagram is saved)`
              : ''}
          </p>
          {warnings.length > 0 && (
            <ul className="bulk-create-warnings">
              {warnings.slice(0, MAX_LISTED).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {warnings.length > MAX_LISTED && <li>and {warnings.length - MAX_LISTED} more</li>}
            </ul>
          )}
          <div className="required-tag-value-confirm-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" disabled={count === 0} onClick={confirm}>
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
