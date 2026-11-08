import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { filterGlossary, parseGlossary, type GlossaryTerm } from '@shared/glossary/glossary'
import glossarySource from '../../../docs/architecture/glossary.md?raw'

// The terms come from the one glossary file (ADR 0157): only the plain part of each, read at build
// time, so the window and the file cannot disagree.
const TERMS = parseGlossary(glossarySource)

interface GlossaryDialogProps {
  onClose: () => void
  // The terms to list; the whole glossary unless a test gives its own.
  terms?: GlossaryTerm[]
}

// Help -> Glossary…. Same shell as the Keyboard shortcuts window: a filter over the terms, a
// scrolling body. The filter looks in the names and in the text, offline and instant.
export default function GlossaryDialog({
  onClose,
  terms = TERMS
}: GlossaryDialogProps): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

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

  const shown = useMemo(() => filterGlossary(terms, filter), [terms, filter])

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog shortcuts-dialog glossary-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Glossary</span>
          <input
            className="shortcuts-dialog-filter"
            type="search"
            placeholder="Filter…"
            aria-label="Filter the glossary"
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shortcuts-dialog-body">
          {shown.length === 0 && <p className="shortcuts-dialog-empty">Nothing matches.</p>}
          {shown.map((term) => (
            <section key={term.name} className="glossary-term">
              <h3 className="glossary-term-name">{term.name}</h3>
              <ReactMarkdown>{term.definition}</ReactMarkdown>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
