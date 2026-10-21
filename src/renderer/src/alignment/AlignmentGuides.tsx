import { useViewport } from '@xyflow/react'

interface AlignmentGuidesProps {
  guides: { x: number[]; y: number[] } | null
}

// Rendered as an overlay sibling to <ReactFlow>, not inside its own pan/
// zoom-transformed viewport (no supported way to inject arbitrary content
// into that internal group) — so flow-space guide positions are converted
// to screen pixels manually via the live viewport. useViewport re-renders
// this on every pan/zoom, so guides stay correctly positioned if the
// canvas moves mid-drag. pointer-events: none throughout — this must never
// intercept the very drag gesture it's illustrating.
export default function AlignmentGuides({
  guides
}: AlignmentGuidesProps): React.JSX.Element | null {
  const viewport = useViewport()
  if (!guides || (guides.x.length === 0 && guides.y.length === 0)) return null

  return (
    <div className="alignment-guides">
      {guides.x.map((x) => (
        <div
          key={`x-${x}`}
          className="alignment-guide alignment-guide-vertical"
          style={{ left: x * viewport.zoom + viewport.x }}
        />
      ))}
      {guides.y.map((y) => (
        <div
          key={`y-${y}`}
          className="alignment-guide alignment-guide-horizontal"
          style={{ top: y * viewport.zoom + viewport.y }}
        />
      ))}
    </div>
  )
}
