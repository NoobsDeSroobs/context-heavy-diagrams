import { Children, type ReactNode } from 'react'

// Outer-level dock, sibling of the canvas view — see ADR 0013. Holds
// content that's *about* the diagram but not part of editing it directly:
// `DetailsPanel`/`RequiredTagsPanel`/`DiagnosticsPanel` today, a slot for
// future non-diagram-editing features to reuse. Zero width when empty,
// renders nothing (not even the wrapper div) so it never claims layout
// space it isn't using.
//
// Canvas passes each panel as its own `{condition && <Panel/>}` sibling, so
// `children` is an array of (element | false) once there's more than one —
// `!children` on a non-empty array is always false, even when every entry
// is `false`, so that check alone can't tell "nothing open" from "one of
// several possibly open." Children.toArray strips the falsy entries first.
export default function UtilityDock({
  children
}: {
  children: ReactNode
}): React.JSX.Element | null {
  const content = Children.toArray(children)
  if (content.length === 0) return null
  return <div className="utility-dock">{content}</div>
}
