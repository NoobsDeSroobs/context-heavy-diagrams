// A pasted table (ADR 0168): tab-separated, as copied from a spreadsheet, or comma-separated with
// the quoting of RFC 4180. Pure text in, rows of cells out; nothing here knows what a column means.

export type Delimiter = '\t' | ','

// A tab on the first non-blank line means a spreadsheet paste; anything else is read as commas.
export function detectDelimiter(text: string): Delimiter {
  const first = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? ''
  return first.includes('\t') ? '\t' : ','
}

// Cells are trimmed. A quote opens a quoted cell only at the start of the cell, so a stray quote in
// the middle of a word stays a letter; inside quotes a doubled quote is one quote and the
// delimiter and line breaks are text. A row of only empty cells is dropped.
export function parseTable(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const endCell = (): void => {
    row.push(cell.trim())
    cell = ''
  }
  const endRow = (): void => {
    endCell()
    if (row.some((c) => c !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
    } else if (char === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (char === delimiter) {
      endCell()
    } else if (char === '\n') {
      endRow()
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

// Whether a paste is a table rather than a list of labels: a header row with two or more columns,
// at least one more row, and no row wider than the header (a label with a comma in it makes a row
// wider than its neighbours, which a list of such labels would not survive).
export function looksLikeTable(rows: string[][]): boolean {
  if (rows.length < 2 || rows[0].length < 2) return false
  return rows.every((row) => row.length <= rows[0].length)
}
