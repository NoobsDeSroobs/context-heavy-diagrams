import { useEffect, useState } from 'react'

// Native `title` attribute showing the detail file's first non-empty line —
// deliberately the simplest possible "lightweight tooltip" per the brief
// (must never open the full panel on hover). Richer, frontmatter-driven
// tooltips are epic 0021, not this.
export function useDetailsTooltip(
  diagramPath: string | null,
  detailsPath: string | undefined
): string | undefined {
  const [title, setTitle] = useState<string | undefined>(undefined)

  useEffect(() => {
    setTitle(undefined)
    if (!diagramPath || !detailsPath) return undefined
    let cancelled = false
    window.api.readDetails(diagramPath, detailsPath).then((content) => {
      if (cancelled) return
      const firstLine = content.split('\n').find((line) => line.trim().length > 0)
      setTitle(firstLine?.trim())
    })
    return () => {
      cancelled = true
    }
  }, [diagramPath, detailsPath])

  return title
}
