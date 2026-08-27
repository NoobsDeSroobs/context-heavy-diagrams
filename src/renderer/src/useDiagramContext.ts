import { useContext } from 'react'
import DiagramContext, { type DiagramContextValue } from './DiagramContext'

// Split out of DiagramContext.tsx — see that file's own
// comment on why a Context object and its accessor hook can't coexist in
// one file without tripping react-refresh/only-export-components.
export function useDiagramContext(): DiagramContextValue {
  const ctx = useContext(DiagramContext)
  if (!ctx) throw new Error('useDiagramContext must be used within a DiagramContext.Provider')
  return ctx
}
