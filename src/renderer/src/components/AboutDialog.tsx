import { useEffect, useRef, useState } from 'react'
import { PROJECT_URL } from '../projectInfo'

interface AboutDialogProps {
  onClose: () => void
}

const REPO_URL = PROJECT_URL

// See ADR 0044. A centered overlay, not one of the fixed right-dock
// panels (ADR 0013) — those are ongoing inspection tools you leave open
// alongside the canvas; an About screen is a one-off info popup you glance
// at and dismiss, closer to a native "About" box. Click-outside/Escape-to-
// close mirrors MenuBar.tsx/ContextMenu.tsx.
export default function AboutDialog({ onClose }: AboutDialogProps): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">About</span>
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="about-dialog-body">
          <p className="about-dialog-version">Version {version ?? '…'}</p>
          <p>
            Offline, local, context-heavy diagramming for IT architecture work — no cloud, no
            account, no data collection. Everything is stored as git-friendly plain files on disk.
          </p>
          <p>
            License: GPL-3.0-or-later.{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {REPO_URL}
            </a>
          </p>
          <p className="about-dialog-credits">
            Built with Electron, React, React Flow (@xyflow/react), Tabler Icons, and
            react-markdown.
          </p>
        </div>
      </div>
    </div>
  )
}
