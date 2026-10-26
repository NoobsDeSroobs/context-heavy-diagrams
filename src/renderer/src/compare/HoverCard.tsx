import { createPortal } from 'react-dom'
import type { HoverCardContent } from './hoverContent'

const CARD_WIDTH = 320
const CARD_HEIGHT_GUESS = 180

// Under a node, or beside the pointer for an edge, and always inside the window.
function cardPosition(
  edge: boolean,
  rect: { left: number; bottom: number },
  pointer: { x: number; y: number }
): React.CSSProperties {
  const left = edge ? pointer.x + 12 : rect.left
  const top = edge ? pointer.y + 16 : rect.bottom + 8
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - CARD_HEIGHT_GUESS)),
    width: CARD_WIDTH
  }
}

export default function HoverCard({
  card,
  rect,
  pointer
}: {
  card: HoverCardContent
  rect: { left: number; bottom: number }
  // Where the pointer entered an edge: a long edge's own box is no place to anchor its card.
  pointer: { x: number; y: number }
}): React.JSX.Element {
  return createPortal(
    <div className="peek-card compare-peek" style={cardPosition(card.edge, rect, pointer)}>
      <div className="peek-card-title">{card.title}</div>
      <div className="compare-peek-body">
        <div>{card.status}</div>
        {card.lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>,
    document.body
  )
}
