// Problems and warnings as the assistant reads them: a few of one kind are listed, many of one kind
// become one line with their number, so a diagram with a dozen tight labels does not repeat the same
// complaint a dozen times.
const EXAMPLES = 3
const IDS_SHOWN = 20

// Two warnings are alike when they differ only in names, ids and numbers.
const sameKindAs = (message) =>
  message.replace(/'[^']*'|"[^"]*"/g, "'…'").replace(/\d+(?:\.\d+)?/g, 'N')

// `items` are strings, or { message, kind?, ids? }. Returns strings, in the order the kinds first appear.
export function groupMessages(items) {
  const groups = new Map()
  for (const item of items) {
    const { message, kind, ids = [] } = typeof item === 'string' ? { message: item } : item
    const key = kind ?? sameKindAs(message)
    const group = groups.get(key) ?? { kind, messages: [], ids: [] }
    group.messages.push(message)
    group.ids.push(...ids)
    groups.set(key, group)
  }
  const lines = []
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
