// A few lines showing what changed between two versions of a text (a Details note): the lines
// that differ once the shared start and end are set aside. A preview to see that something
// changed and roughly what, not a diff; git does the real one.

const MAX_LINES = 6
const MAX_WIDTH = 80

function clip(line: string): string {
  const text = line.trim()
  return text.length > MAX_WIDTH ? `${text.slice(0, MAX_WIDTH - 1)}…` : text
}

function lines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

// Same text apart from line endings: not a change (git may have converted them).
export function sameText(before: string, after: string): boolean {
  return lines(before).join('\n') === lines(after).join('\n')
}

// `− old` lines then `+ new` lines, at most `max` of them, then how many more there were.
export function previewTextChange(before: string, after: string, max = MAX_LINES): string[] {
  const was = lines(before)
  const now = lines(after)
  let start = 0
  while (start < was.length && start < now.length && was[start] === now[start]) start += 1
  let endWas = was.length
  let endNow = now.length
  while (endWas > start && endNow > start && was[endWas - 1] === now[endNow - 1]) {
    endWas -= 1
    endNow -= 1
  }
  const removed = was.slice(start, endWas).filter((l) => l.trim() !== '')
  const added = now.slice(start, endNow).filter((l) => l.trim() !== '')
  const half = Math.ceil(max / 2)
  // Whichever side is short leaves its room to the other.
  const removedShown = removed.slice(0, Math.max(half, max - added.length))
  const addedShown = added.slice(0, Math.max(half, max - removedShown.length))
  const preview = [
    ...removedShown.map((l) => `− ${clip(l)}`),
    ...addedShown.map((l) => `+ ${clip(l)}`)
  ]
  const hidden = removed.length - removedShown.length + (added.length - addedShown.length)
  if (hidden > 0) preview.push(`… ${hidden} more changed line${hidden === 1 ? '' : 's'}`)
  return preview
}
