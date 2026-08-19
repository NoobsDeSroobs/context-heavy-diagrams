import type { ReactNode } from 'react'

// Outer-level dock, sibling of the canvas view — see ADR 0013. Holds
// content that's *about* the diagram but not part of editing it directly:
// `DetailsPanel` today, a slot for future non-diagram-editing features to
// reuse. Zero width when empty; renders nothing (not even the wrapper div)
// so it never claims layout space it isn't using.
export default function UtilityDock({ children }: { children: ReactNode }): React.JSX.Element | null {
  if (!children) return null
  return <div className="utility-dock">{children}</div>
}
