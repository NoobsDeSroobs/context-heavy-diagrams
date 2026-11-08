import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MetadataEntry } from '@shared/diagram'
import type { IconRef, IconSlot } from '@shared/icons/schema'
import { namedIcons } from '@shared/icons/names'
import { isMac } from '../commands'
import { peekNoteCharCap } from '@shared/preferences/peekCard'
import type { PeekTarget } from './useNotesPeek'

const GAP = 8
interface PeekCardProps {
  target: PeekTarget
  // The card's width and the height beyond which it is trimmed, from the preferences.
  width: number
  maxHeight: number
  label: string
  notesPath: string | undefined
  linkedPath: string | undefined
  metadata: Record<string, MetadataEntry> | undefined
  // The diagram's required tag keys: their tags come first, in their own colour.
  requiredTagKeys: ReadonlySet<string>
  // The element's icons, named so a person can read what each one means (ADR 0155).
  icons: Partial<Record<IconSlot, IconRef>> | undefined
  diagramPath: string | null
  // The note's in-memory text when it has been opened this session (so unsaved
  // edits show); undefined = read the file.
  shadowContent: string | undefined
}

type ChipKind = 'required' | 'tag' | 'icon'

// A line of the card: the name of what it lists once, then the items, each in the colour of its
// kind, so a tag and an icon are not taken for each other (ADR 0155).
function Group({
  label,
  items
}: {
  label: string
  items: { text: string; kind: ChipKind }[]
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div className="peek-card-tags">
      <span className="peek-card-group-label">{label}</span>
      {items.map(({ text, kind }) => (
        <span key={text} className={`peek-card-tag peek-card-tag-${kind}`}>
          {text}
        </span>
      ))}
    </div>
  )
}

function formatTagValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Read-only, non-interactive card shown while Ctrl/Cmd is held over a node
// (ADR 0093). Mounted only while a peek is active (keyed by node id by the
// caller), so the note is read on peek rather than for every node at
// load, and never goes stale.
export default function PeekCard({
  target,
  width,
  maxHeight,
  label,
  notesPath,
  linkedPath,
  metadata,
  requiredTagKeys,
  icons,
  diagramPath,
  shadowContent
}: PeekCardProps): React.JSX.Element | null {
  const [fileContent, setFileContent] = useState<string | null>(null)

  useEffect(() => {
    if (shadowContent !== undefined || !diagramPath || !notesPath) return undefined
    let cancelled = false
    window.api.readNotes(diagramPath, notesPath).then((content) => {
      if (!cancelled) setFileContent(content)
    })
    return () => {
      cancelled = true
    }
  }, [shadowContent, diagramPath, notesPath])

  const text = (shadowContent ?? fileContent ?? '').trim()
  const tags = Object.entries(metadata ?? {})
  // Required tags first, then the others, on one line.
  const tagChips: { text: string; kind: ChipKind }[] = [
    ...tags.filter(([key]) => requiredTagKeys.has(key)),
    ...tags.filter(([key]) => !requiredTagKeys.has(key))
  ].map(([key, entry]) => ({
    text: `${key}: ${formatTagValue(entry.value)}`,
    kind: requiredTagKeys.has(key) ? 'required' : 'tag'
  }))
  const iconNames = namedIcons(icons)
  if (!text && !linkedPath && tags.length === 0 && iconNames.length === 0) return null

  const title = label.split('\n')[0].trim()
  const linkName = linkedPath?.split(/[/\\]/).pop() ?? linkedPath
  const { rect } = target
  const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - width - GAP))
  const fitsBelow = rect.bottom + GAP + maxHeight <= window.innerHeight
  const fitsAbove = rect.top - GAP - maxHeight >= 0
  // Anchored by `bottom` when above so the card hugs the node whatever its
  // real (content-driven) height; a node too big for either falls back to the
  // top of the window.
  const vertical = fitsBelow
    ? { top: rect.bottom + GAP }
    : fitsAbove
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: GAP }

  return createPortal(
    <div
      className={`peek-card${linkedPath ? ' peek-card-linked' : ''}`}
      style={{ left, width, maxHeight, ...vertical }}
    >
      {linkedPath && (
        <svg
          className="peek-card-link-icon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Links to a diagram"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
      {title && <div className="peek-card-title">{title}</div>}
      <Group label="Tags" items={tagChips} />
      <Group
        label="Icons"
        items={iconNames.map(({ where, name }) => ({ text: `${where}: ${name}`, kind: 'icon' }))}
      />
      {text && (
        <div className="peek-card-body notes-panel-preview" dir="auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text.slice(0, peekNoteCharCap(width, maxHeight))}
          </ReactMarkdown>
        </div>
      )}
      {linkedPath && (
        <div className="peek-card-link">
          {isMac ? '⌘' : 'Ctrl'}+click to open <strong>{linkName}</strong>
        </div>
      )}
    </div>,
    document.body
  )
}
