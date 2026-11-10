// A table turned into the elements it describes (ADR 0168): which column means what, and one
// element per distinct label with the tags of its rows folded together.

export type ColumnRole = 'label' | 'note' | 'container' | 'tag' | 'ignore'

export interface TableColumn {
  // The header cell: also the tag key when the column is a tag.
  header: string
  role: ColumnRole
}

const LABEL_HEADER = /^(name|label|title|element|entity)$/i
const NOTE_HEADER = /^(description|note|notes|details)$/i
const CONTAINER_HEADER = /^(container|group|domain|parent)$/i

// The role each header suggests, by its name. One column per role: a second match is a tag, so no
// cell is lost. With no label-like header the first column is the label.
export function guessColumns(header: string[]): TableColumn[] {
  const taken = new Set<ColumnRole>()
  const columns = header.map((cell): TableColumn => {
    const text = cell.trim()
    let role: ColumnRole = text === '' ? 'ignore' : 'tag'
    const wanted: ColumnRole | undefined = LABEL_HEADER.test(text)
      ? 'label'
      : NOTE_HEADER.test(text)
        ? 'note'
        : CONTAINER_HEADER.test(text)
          ? 'container'
          : undefined
    if (wanted && !taken.has(wanted)) {
      taken.add(wanted)
      role = wanted
    }
    return { header: text, role }
  })
  if (!taken.has('label') && columns.length > 0) {
    columns[0] = { ...columns[0], role: 'label' }
  }
  return columns
}

// What one element comes out as. `container` is the name of the group it belongs to: the import
// carries it from the start, so putting the elements into containers can be added without changing
// what a paste means.
export interface BulkElement {
  label: string
  note?: string
  container?: string
  tags: Record<string, string>
}

export interface BuildResult {
  elements: BulkElement[]
  // Data rows read, and those left out for having no label.
  rows: number
  blankLabelRows: number
  // Cells that disagreed with an earlier row of the same label, said as sentences.
  conflicts: string[]
}

export interface BuildOptions {
  // A container has no note in the app, so for one the note column is kept as the tag `description`.
  type: 'entity' | 'container'
}

// Only the first column of each of the roles label, note and container counts as that role; one
// more is a tag, as in guessColumns, because the roles may have been set by hand.
function effectiveColumns(columns: TableColumn[]): TableColumn[] {
  const seen = new Set<ColumnRole>()
  return columns.map((column) => {
    if (column.role === 'label' || column.role === 'note' || column.role === 'container') {
      if (seen.has(column.role)) return { ...column, role: column.header === '' ? 'ignore' : 'tag' }
      seen.add(column.role)
    }
    return column
  })
}

// One element per distinct label (trimmed, case as written). The first non-empty cell of a field
// wins; a later row that says something else is reported, not merged into a list, because a tag
// holds one value.
export function buildElements(
  rows: string[][],
  columns: TableColumn[],
  options: BuildOptions
): BuildResult {
  const cols = effectiveColumns(columns)
  const labelAt = cols.findIndex((c) => c.role === 'label')
  const byLabel = new Map<string, BulkElement>()
  const conflicts: string[] = []
  let blankLabelRows = 0

  const set = (
    element: BulkElement,
    field: string,
    value: string,
    apply: () => void,
    current: string | undefined
  ): void => {
    if (value === '') return
    if (current === undefined) apply()
    else if (current !== value) {
      conflicts.push(`${element.label}: ${field} is "${current}" and "${value}"; kept "${current}"`)
    }
  }

  for (const row of rows) {
    const label = labelAt >= 0 ? (row[labelAt] ?? '') : ''
    if (label === '') {
      blankLabelRows += 1
      continue
    }
    let element = byLabel.get(label)
    if (!element) {
      element = { label, tags: {} }
      byLabel.set(label, element)
    }
    const target = element
    cols.forEach((column, index) => {
      const value = row[index] ?? ''
      if (column.role === 'note') {
        if (options.type === 'container') {
          set(
            target,
            'description',
            value,
            () => (target.tags.description = value),
            target.tags.description
          )
        } else {
          set(target, 'note', value, () => (target.note = value), target.note)
        }
      } else if (column.role === 'container') {
        set(
          target,
          column.header || 'container',
          value,
          () => (target.container = value),
          target.container
        )
      } else if (column.role === 'tag' && column.header !== '') {
        set(
          target,
          column.header,
          value,
          () => (target.tags[column.header] = value),
          target.tags[column.header]
        )
      }
    })
  }

  return { elements: [...byLabel.values()], rows: rows.length, blankLabelRows, conflicts }
}

// A list of labels, one per line, as before tables: no merging, every line is an element.
export function listElements(text: string): BulkElement[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((label) => ({ label, tags: {} }))
}

// The header of the column that holds the container, when there is one: the tag it is kept under
// until elements are put into containers.
export function containerKeyOf(columns: TableColumn[]): string | undefined {
  const column = effectiveColumns(columns).find((c) => c.role === 'container')
  return column ? column.header || 'container' : undefined
}
