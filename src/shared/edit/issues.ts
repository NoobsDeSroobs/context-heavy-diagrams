// Problems and warnings as an assistant reads them: a few of one kind are listed, many of one kind
// become one line with their number, so a diagram with a dozen tight labels does not repeat the same
// complaint a dozen times. Shared by the extension and the command line, so both say it the same way.
const EXAMPLES = 3
const IDS_SHOWN = 20

export type Problem = string | { message: string; kind?: string; ids?: string[] }

// Two warnings are alike when they differ only in names, ids and numbers.
const sameKindAs = (message: string): string =>
  message.replace(/'[^']*'|"[^"]*"/g, "'…'").replace(/\d+(?:\.\d+)?/g, 'N')

// Returns the lines, in the order the kinds first appear.
export function groupMessages(items: Problem[]): string[] {
  const groups = new Map<string, { kind?: string; messages: string[]; ids: string[] }>()
  for (const item of items) {
    const { message, kind, ids = [] } = typeof item === 'string' ? { message: item } : item
    const key = kind ?? sameKindAs(message)
    const group = groups.get(key) ?? { kind, messages: [], ids: [] }
    group.messages.push(message)
    group.ids.push(...ids)
    groups.set(key, group)
  }
  const lines: string[] = []
  for (const { kind, messages, ids } of groups.values()) {
    if (messages.length <= EXAMPLES) {
      lines.push(...messages)
      continue
    }
    const rest = messages.length - EXAMPLES
    const shownIds = [...new Set(ids)].slice(0, IDS_SHOWN)
    const named = shownIds.length > 0 ? ` (elements: ${shownIds.join(', ')})` : ''
    lines.push(
      `${kind ? `${kind} ` : ''}×${messages.length}: ${messages.slice(0, EXAMPLES).join('; ')}; and ${rest} more${named}`
    )
  }
  return lines
}
