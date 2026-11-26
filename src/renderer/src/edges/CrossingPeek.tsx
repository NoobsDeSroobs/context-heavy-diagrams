import { createPortal } from 'react-dom'
import type { PeekTarget } from '../notes/useNotesPeek'

const GAP = 14

// A small card by the pointer, shown while Ctrl/Cmd is held over an edge that goes through the border of
// a container: which containers it leaves and enters, innermost first on the way out and
// outermost first on the way in, and how many borders that is. Non-interactive, like the note peek.
export default function CrossingPeek({
  target,
  route,
  borders
}: {
  target: PeekTarget
  route: string
  borders: number
}): React.JSX.Element {
  const left = Math.max(GAP, Math.min(target.pointer.x + GAP, window.innerWidth - 280 - GAP))
  const top = Math.max(GAP, Math.min(target.pointer.y + GAP, window.innerHeight - 60 - GAP))
  return createPortal(
    <div className="crossing-peek" style={{ left, top }}>
      <div className="crossing-peek-route">{route}</div>
      <div className="crossing-peek-count">
        {borders === 1 ? 'Crosses 1 container border' : `Crosses ${borders} container borders`}
      </div>
    </div>,
    document.body
  )
}
