import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MetadataEntry } from '@shared/diagram'
import type { IconRef, IconSlot } from '@shared/icons/schema'
import { namedIcons } from '@shared/icons/names'
import { isMac } from '../commands'
import type { PeekTarget } from './useNotesPeek'

const CARD_WIDTH = 340
const CARD_MAX_HEIGHT = 260
const GAP = 8
// Raw-text cap before rendering: cheap, keeps the markdown pass small; the
// CSS max-height (with a fade) does the visual truncation.
const MAX_CHARS = 1200

interface PeekCardProps {
  target: PeekTarget
  label: string
  notesPath: string | undefined
  linkedPath: string | undefined
  metadata: Record<string, MetadataEntry> | undefined
  // The diagram's required tag keys: their tags are listed apart from the free ones.
  requiredTagKeys: ReadonlySet<string>
  // The element's icons, named so a person can read what each one means (ADR 0155).
  icons: Partial<Record<IconSlot, IconRef>> | undefined
  diagramPath: string | null
  // The note's in-memory text when it has been opened this session (so unsaved
  // edits show); undefined = read the file.
  shadowContent: string | undefined
}

// One kind of thing on the card, named and in its own colour, so a tag and an icon are not taken
// for each other (ADR 0155).
function Group({
  label,
  kind,
  items
}: {
  label: string
  kind: 'required' | 'tag' | 'icon'
  items: string[]
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div className="peek-card-tags">
      <span className="peek-card-group-label">{label}</span>
      {items.map((item) => (
        <span key={item} className={`peek-card-tag peek-card-tag-${kind}`}>
          {item}
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
  const requiredTags = tags.filter(([key]) => requiredTagKeys.has(key))
  const freeTags = tags.filter(([key]) => !requiredTagKeys.has(key))
  const iconNames = namedIcons(icons)
  if (!text && !linkedPath && tags.length === 0 && iconNames.length === 0) return null

  const title = label.split('\n')[0].trim()
  const linkName = linkedPath?.split(/[/\\]/).pop() ?? linkedPath
  const { rect } = target
  const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - CARD_WIDTH - GAP))
  const fitsBelow = rect.bottom + GAP + CARD_MAX_HEIGHT <= window.innerHeight
  const fitsAbove = rect.top - GAP - CARD_MAX_HEIGHT >= 0
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
      style={{ left, width: CARD_WIDTH, maxHeight: CARD_MAX_HEIGHT, ...vertical }}
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
      <Group
        label="Required tags"
        kind="required"
        items={requiredTags.map(([key, entry]) => `${key}: ${formatTagValue(entry.value)}`)}
      />
      <Group
        label="Tags"
        kind="tag"
        items={freeTags.map(([key, entry]) => `${key}: ${formatTagValue(entry.value)}`)}
      />
      <Group
        label="Icons"
        kind="icon"
        items={iconNames.map(({ where, name }) => `${where}: ${name}`)}
      />
      {text && (
        <div className="peek-card-body notes-panel-preview" dir="auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.slice(0, MAX_CHARS)}</ReactMarkdown>
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
