// The words for a change, shared by the compare window and `chd diff` so the two describe it the
// same way. No I/O.

import { describeCount, type CompareStatus, type ReviewItem } from './classify.ts'
import type { CollectionChange } from './collections.ts'

export const STATUS_LABEL: Record<CompareStatus, string> = {
  added: 'Added',
  removed: 'Removed',
  links: 'Links or Details changed',
  content: 'Modified'
}

export function kindName(item: ReviewItem): string {
  return item.kind === 'node' ? 'element' : 'connection'
}

// "2 connections added with it": the connections that came or went together with an element.
export function withItNote(item: ReviewItem): string {
  const count = describeCount({ nodes: 0, edges: item.connections?.length ?? 0 })
  return `${count} ${item.change.status === 'removed' ? 'removed' : 'added'} with it`
}

// One line on what changed: the first of the lines the hover card shows.
export function summarizeItem(item: ReviewItem): string {
  const { change } = item
  if (change.status === 'added') return item.kind === 'node' ? 'Added' : 'Added connection'
  if (change.status === 'removed') return item.kind === 'node' ? 'Removed' : 'Removed connection'
  const lines = change.fields[0]?.lines ?? []
  // A line that only introduces the next ("label, further lines:") is no summary on its own.
  const first =
    (lines[0]?.endsWith(':') && lines[1] ? `${lines[0]} ${lines[1]}` : lines[0]) ??
    STATUS_LABEL[change.status]
  const more = change.fields.length - 1
  return more > 0 ? `${first} (+${more} more)` : first
}

// A catalog or setting change the canvas cannot colour: "Palette: +Teal −Red ~Blue" or
// "Grid size: 10 → 20".
export function diagramLevelText(change: CollectionChange): string {
  if (change.setting) return `${change.name}: ${change.setting.before} → ${change.setting.after}`
  const parts = [
    change.added.length > 0 && `+${change.added.join(', ')}`,
    change.removed.length > 0 && `−${change.removed.join(', ')}`,
    change.changed.length > 0 && `~${change.changed.join(', ')}`
  ].filter(Boolean)
  return `${change.name}: ${parts.join(' ')}`
}

export type ReviewSection = 'SECURITY' | 'LINKS AND NOTES' | 'MODIFIED' | 'REMOVED' | 'ADDED'

// Which heading an item sits under; the review order already keeps each heading together.
export function reviewSection(item: ReviewItem): ReviewSection {
  if (item.change.security) return 'SECURITY'
  switch (item.change.status) {
    case 'links':
      return 'LINKS AND NOTES'
    case 'content':
      return 'MODIFIED'
    case 'removed':
      return 'REMOVED'
    default:
      return 'ADDED'
  }
}

export const MAX_CONNECTIONS_LISTED = 8

// An item as indented plain text: its name, what changed, and the connections that went with it.
export function itemLines(item: ReviewItem): string[] {
  const connections = item.connections ?? []
  const withIt = connections.length > 0 ? ` (${withItNote(item)})` : ''
  const lines = [`  ${kindName(item)} "${item.label}"${withIt}`]
  for (const field of item.change.fields) {
    for (const line of field.lines) lines.push(`    ${line}`)
  }
  for (const connection of connections.slice(0, MAX_CONNECTIONS_LISTED)) {
    lines.push(`    - ${connection.label}`)
  }
  if (connections.length > MAX_CONNECTIONS_LISTED) {
    lines.push(`    - …and ${connections.length - MAX_CONNECTIONS_LISTED} more`)
  }
  return lines
}
