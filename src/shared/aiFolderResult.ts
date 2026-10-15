// Result of "Enable AI assistance in a folder" (ADR 0105): main does the file
// work, the renderer turns this into the message the user reads.
export interface AiFolderResult {
  folder: string
  // Paths relative to `folder`, always '/'-separated for display.
  added: string[]
  updated: string[]
  // Existing files/folders the app did not create — never overwritten.
  skipped: string[]
}

export function summarizeAiFolderResult(r: AiFolderResult): string {
  const lines = [`AI assistance set up in:\n${r.folder}`]
  if (r.added.length > 0) lines.push(`Added: ${r.added.join(', ')}`)
  if (r.updated.length > 0) lines.push(`Updated: ${r.updated.join(', ')}`)
  if (r.skipped.length > 0) {
    lines.push(
      `Left alone (already there, and not created by this app): ${r.skipped.join(', ')}. ` +
        `Rename or remove them and run this again if you want them replaced.`
    )
  }
  lines.push(
    'Next: open an AI coding assistant (such as Claude Code) in that folder and ask it about your diagrams.'
  )
  return lines.join('\n\n')
}
