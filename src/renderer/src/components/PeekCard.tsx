import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MetadataEntry } from '@shared/diagram'
import type { PeekTarget } from '../hooks/useDetailsPeek'

const CARD_WIDTH = 340
const CARD_MAX_HEIGHT = 260
const GAP = 8
// Raw-text cap before rendering: cheap, keeps the markdown pass small; the
// CSS max-height (with a fade) does the visual truncation.
const MAX_CHARS = 1200

interface PeekCardProps {
  target: PeekTarget
  label: string
  detailsPath: string | undefined
  linkedPath: string | undefined
  metadata: Record<string, MetadataEntry> | undefined
  diagramPath: string | null
  // The note's in-memory text when it has been opened this session (so unsaved
  // edits show); undefined = read the file.
  shadowContent: string | undefined
}

const isMac = /Mac/i.test(navigator.platform)

function formatTagValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Read-only, non-interactive card shown while Ctrl/Cmd is held over a node
// (ADR 0093). Mounted only while a peek is active (keyed by node id by the
// caller), so the details file is read on peek rather than for every node at
// load, and never goes stale.
export default function PeekCard({
  target,
  label,
  detailsPath,
  linkedPath,
  metadata,
  diagramPath,
  shadowContent
}: PeekCardProps): React.JSX.Element | null {
  const [fileContent, setFileContent] = useState<string | null>(null)

  useEffect(() => {
    if (shadowContent !== undefined || !diagramPath || !detailsPath) return undefined
    let cancelled = false
    window.api.readDetails(diagramPath, detailsPath).then((content) => {
      if (!cancelled) setFileContent(content)
    })
    return () => {
      cancelled = true
    }
  }, [shadowContent, diagramPath, detailsPath])

  const text = (shadowContent ?? fileContent ?? '').trim()
  const tags = Object.entries(metadata ?? {})
  if (!text && !linkedPath && tags.length === 0) return null

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
      className="peek-card"
      style={{ left, width: CARD_WIDTH, maxHeight: CARD_MAX_HEIGHT, ...vertical }}
    >
      {title && <div className="peek-card-title">{title}</div>}
      {tags.length > 0 && (
        <div className="peek-card-tags">
          {tags.map(([key, entry]) => (
            <span key={key} className="peek-card-tag">
              {key}: {formatTagValue(entry.value)}
            </span>
          ))}
        </div>
      )}
      {text && (
        <div className="peek-card-body details-panel-preview" dir="auto">
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
