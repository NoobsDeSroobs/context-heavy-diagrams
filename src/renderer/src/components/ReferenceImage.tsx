import { useEffect, useState } from 'react'

interface ReferenceImageProps {
  diagramPath: string | null
  path: string
  className?: string
  style?: React.CSSProperties
  // Fired once the bitmap is decoded, with its natural pixel size.
  onNaturalSize?: (width: number, height: number) => void
}

// Reference images (see ADR 0069) always render via <img src="data:…">
// — never inline SVG, same script-injection guard as custom icons
// (IconSlotView). Callers key this by `path` so a path change remounts a
// fresh instance rather than this component resetting its own state
// mid-fetch (the setState-synchronously-in-effect pattern lint flags —
// see IconSlotView's own note).
export default function ReferenceImage({
  diagramPath,
  path,
  className,
  style,
  onNaturalSize
}: ReferenceImageProps): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!diagramPath) return undefined
    let cancelled = false
    window.api
      .readReferenceAsDataUrl(diagramPath, path)
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [diagramPath, path])

  if (!diagramPath || failed) {
    return (
      <span className={`reference-image-missing ${className ?? ''}`} style={style}>
        Image not found
      </span>
    )
  }
  if (!dataUrl)
    return <span className={`reference-image-loading ${className ?? ''}`} style={style} />
  return (
    <img
      className={className}
      style={style}
      src={dataUrl}
      alt=""
      draggable={false}
      onLoad={(e) =>
        onNaturalSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
      }
    />
  )
}
