import { Children, type ReactNode } from 'react'
import { UTILITY_DOCK_WIDTH } from '@shared/preferences/panelWidth'
import { useEdgeResize } from './ui/useEdgeResize'

// Outer-level dock, sibling of the canvas view (ADR 0013). Holds content that is about the diagram
// but isn't editing it: `NotesPanel`/`RequiredTagsPanel`/`DiagnosticsPanel` today, and a slot for
// future non-editing features. Zero width when empty, and renders nothing (not even the wrapper
// div) so it never claims layout space.
//
// Canvas passes each panel as its own `{condition && <Panel/>}` sibling, so `children` is an array
// of (element | false) once there is more than one, and `!children` on a non-empty array is false
// even when every entry is `false`. Children.toArray strips the falsy entries first, so "nothing
// open" can be told from "one of several possibly open".
//
// Its left edge is a resize handle (ADR 0158); the width is handed to `onWidthChange` once, on
// release, so the preference is written once per drag.
export default function UtilityDock({
  children,
  width,
  onWidthChange
}: {
  children: ReactNode
  width: number
  onWidthChange: (width: number) => void
}): React.JSX.Element | null {
  const { shownWidth, handle } = useEdgeResize(
    width,
    UTILITY_DOCK_WIDTH,
    onWidthChange,
    'Resize the side panel'
  )
  const content = Children.toArray(children)
  if (content.length === 0) return null

  return (
    <div className="utility-dock" style={{ width: shownWidth }}>
      {handle}
      {content}
    </div>
  )
}
