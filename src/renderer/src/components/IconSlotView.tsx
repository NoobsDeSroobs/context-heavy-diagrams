import { useEffect, useState } from 'react'
import type { IconRef } from '@shared/diagram'
import { loadBuiltinIconSvg } from '../icons/builtinIcons'

interface IconSlotViewProps {
  icon: IconRef | undefined
  diagramPath: string | null
  className?: string
}

// Built-in icons render as inline SVG (trusted, bundled at build time — see
// ADR 0006). Custom icons render via <img src="data:..."> instead, never
// inlined: an arbitrary user-supplied SVG could embed a script, and <img>
// doesn't execute embedded scripts the way dangerouslySetInnerHTML would.
export default function IconSlotView({
  icon,
  diagramPath,
  className
}: IconSlotViewProps): React.JSX.Element | null {
  const [svg, setSvg] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    setSvg(null)
    setDataUrl(null)
    if (!icon) return undefined

    let cancelled = false
    if (icon.source === 'builtin') {
      loadBuiltinIconSvg(icon.id)?.then((s) => {
        if (!cancelled) setSvg(s)
      })
    } else if (diagramPath) {
      window.api.readIconAsDataUrl(diagramPath, icon.path).then((url) => {
        if (!cancelled) setDataUrl(url)
      })
    }
    return () => {
      cancelled = true
    }
  }, [icon, diagramPath])

  if (!icon) return null
  if (svg) return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
  if (dataUrl) return <img className={className} src={dataUrl} alt="" />
  return <span className={className} />
}
