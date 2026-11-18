import { useEffect, useState } from 'react'
import type { IconRef } from '@shared/diagram'
import { loadBuiltinIconSvg } from './builtinIcons'
import { useInstalledIcon } from './installedIcons'

interface IconSlotViewProps {
  icon: IconRef | undefined
  diagramPath: string | null
  className?: string
}

// Built-in icons render as inline SVG (trusted, bundled at build time, ADR 0006). Custom icons
// render through <img src="data:..."> and are never inlined: an arbitrary user-supplied SVG could
// embed a script, and <img> doesn't execute embedded scripts the way dangerouslySetInnerHTML would.
//
// There is no manual "reset before fetching": the caller keys this component by icon identity
// (EntityNode.tsx's iconSlotKey), so React mounts a fresh instance whenever the icon changes,
// instead of one instance having its svg/dataUrl cleared by hand mid-fetch (which needed a
// setState-in-effect the lint rules reject).
export default function IconSlotView(props: IconSlotViewProps): React.JSX.Element | null {
  const { icon } = props
  return icon?.source === 'installed' ? (
    <InstalledIconSlot pack={icon.pack} path={icon.path} className={props.className} />
  ) : (
    <StoredIconSlot {...props} />
  )
}

// An installed icon (ADR 0188) is drawn inline like a built-in one, from the pack's own SVG cleaned
// by the page, so each icon decides its colouring: a shape in `currentColor` takes the text colour
// (the slot's CSS sets it on the svg) and an icon with colours of its own keeps them. A pack that is
// not installed, or lacks the icon, leaves the empty slot; the diagnostics say which (ADR 0084).
function InstalledIconSlot({
  pack,
  path,
  className
}: {
  pack: string
  path: string
  className?: string
}): React.JSX.Element {
  const icon = useInstalledIcon(pack, path)
  if (icon.state === 'ready') {
    return <span className={className} dangerouslySetInnerHTML={{ __html: icon.markup }} />
  }
  const title =
    icon.state === 'missing'
      ? icon.reason === 'no-pack'
        ? `The icon pack "${pack}" is not installed`
        : `${path} is not in the icon pack "${pack}"`
      : undefined
  return <span className={className} title={title} />
}

function StoredIconSlot({
  icon,
  diagramPath,
  className
}: IconSlotViewProps): React.JSX.Element | null {
  const [svg, setSvg] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!icon) return undefined

    let cancelled = false
    if (icon.source === 'builtin') {
      loadBuiltinIconSvg(icon.id)?.then((s) => {
        if (!cancelled) setSvg(s)
      })
    } else if (icon.source === 'custom' && diagramPath) {
      // A missing custom-icon file just renders nothing (the fallback
      // <span> below) — the Diagnostics "missing files" section is where a
      // dead reference is surfaced (ADR 0084), not an uncaught rejection.
      window.api
        .readIconAsDataUrl(diagramPath, icon.path)
        .then((url) => {
          if (!cancelled) setDataUrl(url)
        })
        .catch(() => {})
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
