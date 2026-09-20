import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Node } from '@xyflow/react'

export interface PeekTarget {
  nodeId: string
  // Viewport coordinates of the hovered node, captured when the peek (re)computes.
  rect: { left: number; top: number; right: number; bottom: number }
}

export interface DetailsPeekBindings {
  onNodeMouseEnter: (event: MouseEvent, node: Node) => void
  onNodeMouseLeave: (event: MouseEvent, node: Node) => void
}

// Tracks "a node is hovered AND Ctrl/Cmd is held" (ADR 0093). Both inputs
// arrive independently — the key can go down while the pointer is already
// resting on a node, so no mouseenter fires — hence refs for each plus one
// recompute() that derives the visible target from all of them.
export function useDetailsPeek(): { peek: PeekTarget | null; bindings: DetailsPeekBindings } {
  const [peek, setPeek] = useState<PeekTarget | null>(null)
  const hoverRef = useRef<{ nodeId: string; el: HTMLElement } | null>(null)
  const modifierHeldRef = useRef(false)
  // A shortcut (Ctrl+A/C/V/Z…) or a Ctrl+click in progress; lasts until the
  // modifier is released, so the card never flashes over those gestures.
  const suppressedRef = useRef(false)
  // Any pointer button down = a drag, box-select or pan is (probably) under way.
  const buttonsDownRef = useRef(false)

  const recompute = useCallback(() => {
    const hover = hoverRef.current
    if (!hover || !modifierHeldRef.current || suppressedRef.current || buttonsDownRef.current) {
      setPeek((prev) => (prev === null ? prev : null))
      return
    }
    const r = hover.el.getBoundingClientRect()
    setPeek({
      nodeId: hover.nodeId,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const held = event.ctrlKey || event.metaKey
      modifierHeldRef.current = held
      if (held && event.key !== 'Control' && event.key !== 'Meta') suppressedRef.current = true
      recompute()
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      const held = event.ctrlKey || event.metaKey
      modifierHeldRef.current = held
      if (!held) suppressedRef.current = false
      recompute()
    }
    const onMouseDown = (): void => {
      buttonsDownRef.current = true
      if (modifierHeldRef.current) suppressedRef.current = true
      recompute()
    }
    const onMouseUp = (): void => {
      buttonsDownRef.current = false
      recompute()
    }
    // Ctrl+wheel zooms the canvas under a resting pointer, moving the node
    // out from under a card positioned from its old rect.
    const onWheel = (): void => {
      requestAnimationFrame(recompute)
    }
    // A missed keyup (focus left the window while Ctrl was down) must not
    // leave the card stuck on.
    const onBlur = (): void => {
      modifierHeldRef.current = false
      suppressedRef.current = false
      buttonsDownRef.current = false
      recompute()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
    }
  }, [recompute])

  const onNodeMouseEnter = useCallback(
    (event: MouseEvent, node: Node) => {
      hoverRef.current = { nodeId: node.id, el: event.currentTarget as HTMLElement }
      // The event itself says whether Ctrl/Cmd is down right now — covers a
      // keydown this window never saw.
      modifierHeldRef.current = event.ctrlKey || event.metaKey
      buttonsDownRef.current = event.buttons !== 0
      recompute()
    },
    [recompute]
  )

  const onNodeMouseLeave = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (hoverRef.current?.nodeId !== node.id) return
      hoverRef.current = null
      recompute()
    },
    [recompute]
  )

  return { peek, bindings: { onNodeMouseEnter, onNodeMouseLeave } }
}
