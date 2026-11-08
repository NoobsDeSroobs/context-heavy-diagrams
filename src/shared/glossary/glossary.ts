// Help -> Glossary (ADR 0157). The single source is docs/architecture/glossary.md: each `## ` heading
// is a term, and the text under it up to its `### For developers` subheading is the plain
// definition the app ships. Everything after that subheading is for people working on the code and
// never leaves the file. No Node or DOM here, so the renderer and the tests read it the same way.

export interface GlossaryTerm {
  name: string
  // Markdown, without links or code-level detail.
  definition: string
}

const DEVELOPER_HEADING = /^###\s+For developers\s*$/i

export function parseGlossary(markdown: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = []
  let current: { name: string; lines: string[]; plain: boolean } | null = null
  const finish = (): void => {
    if (current) terms.push({ name: current.name, definition: current.lines.join('\n').trim() })
  }
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      finish()
      current = { name: heading[1], lines: [], plain: true }
    } else if (current && DEVELOPER_HEADING.test(line)) {
      current.plain = false
    } else if (current?.plain) {
      current.lines.push(line)
    }
  }
  finish()
  return terms
}

// Terms whose name or text contains the query, case-insensitively; a name that matches comes first.
// A blank query keeps every term, in the file's order.
export function filterGlossary(terms: GlossaryTerm[], query: string): GlossaryTerm[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return terms
  const byName = terms.filter((t) => t.name.toLowerCase().includes(needle))
  const byText = terms.filter(
    (t) => !byName.includes(t) && t.definition.toLowerCase().includes(needle)
  )
  return [...byName, ...byText]
}
