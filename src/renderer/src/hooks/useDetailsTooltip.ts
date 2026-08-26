import { useEffect, useState } from 'react'

// Native `title` attribute showing the detail file's first non-empty line —
// deliberately the simplest possible "lightweight tooltip" per the brief
// (must never open the full panel on hover). Richer, frontmatter-driven
// tooltips are epic 0021, not this.
export function useDetailsTooltip(
  diagramPath: string | null,
  detailsPath: string | undefined
): string | undefined {
  const key = `${diagramPath ?? ''}:${detailsPath ?? ''}`
  const [state, setState] = useState<{ key: string; title: string | undefined }>({
    key: '',
    title: undefined
  })

  useEffect(() => {
    if (!diagramPath || !detailsPath) return undefined
    let cancelled = false
    window.api.readDetails(diagramPath, detailsPath).then((content) => {
      if (cancelled) return
      const firstLine = content.split('\n').find((line) => line.trim().length > 0)
      setState({ key, title: firstLine?.trim() })
    })
    return () => {
      cancelled = true
    }
  }, [diagramPath, detailsPath, key])

  // epic 0028: replaces the old setTitle(undefined) reset at the top of
  // the effect (react-hooks/set-state-in-effect) — a hook has no `key`
  // of its own to remount by (unlike IconSlotView's fix, its caller
  // can't easily remount just this hook's state without remounting the
  // whole node component). Instead, `state` carries the key it was
  // computed for; if the target has since changed, the stored title
  // belongs to the OLD target, so this returns undefined synchronously
  // during render rather than showing stale content until the new fetch
  // resolves — same end result as the reset, without setState inside
  // the effect's synchronous path.
  return state.key === key ? state.title : undefined
}
