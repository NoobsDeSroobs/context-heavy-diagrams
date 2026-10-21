import { useEffect } from 'react'

// The one modifier that turns a node drag into a duplicate-drag (ADR 0099).
// Deliberately a single key: Alt matches Figma, but many Linux window
// managers grab Alt+drag to move the whole window, so the app never sees it —
// switching to 'ctrlKey' (Ctrl/Cmd) here is the whole change if that bites.
const DUPLICATE_DRAG_MODIFIER = 'altKey' as 'altKey' | 'ctrlKey'

// Pointer travel before a modifier+press counts as a drag rather than a click.
const DRAG_THRESHOLD_PX = 4

// Things inside a node that own their own mouse-down (label editing, handles).
const NO_DUPLICATE_SELECTOR =
  '.nodrag, .react-flow__handle, .react-flow__resize-control, input, textarea, button'

interface Options {
  enabled: boolean
  // Spawns the copy (selection-aware) and returns the id of the copy of the
  // node that was grabbed, or null if nothing should be duplicated (locked).
  // It opens the undo step, which the drag then continues.
  duplicate: (grabbedNodeId: string) => string | null
  // Closes that undo step if the drag never actually started.
  cancelGesture: () => void
}

// Modifier+drag on a node leaves the original untouched (same id, same edges)
// and drags a fresh copy instead. React Flow binds a drag to the node it was
// pressed on, so we swallow the modifier mouse-down (capture phase, before
// React Flow's own listener), wait for the pointer to travel past a small
// threshold, spawn the copy in place, then replay the mouse-down on the copy
// so React Flow starts a normal drag on it. A press-and-release without
// travel is left as a plain click (the browser still fires `click`, which
// selects the node).
export function useModifierDragDuplicate({ enabled, duplicate, cancelGesture }: Options): void {
  useEffect(() => {
    if (!enabled) return

    const onDown = (down: MouseEvent): void => {
      if (down.button !== 0 || !down[DUPLICATE_DRAG_MODIFIER]) return
      // Shift is multi-select; with Alt, Ctrl/Cmd also means something else (AltGr
      // arrives as Ctrl+Alt on Windows).
      if (down.shiftKey || (DUPLICATE_DRAG_MODIFIER === 'altKey' && (down.ctrlKey || down.metaKey)))
        return
      const target = down.target instanceof Element ? down.target : null
      const nodeEl = target?.closest<HTMLElement>('.react-flow__node')
      if (!target || !nodeEl || target.closest(NO_DUPLICATE_SELECTOR)) return
      const grabbedId = nodeEl.dataset.id
      if (!grabbedId) return

      down.stopPropagation()
      down.preventDefault()
      const start = { x: down.clientX, y: down.clientY }
      let released = false

      const cleanup = (): void => {
        window.removeEventListener('mousemove', onMove, true)
        window.removeEventListener('mouseup', onUp, true)
      }
      const onUp = (): void => {
        released = true
        cleanup()
      }
      const onMove = (move: MouseEvent): void => {
        if (Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD_PX) return
        window.removeEventListener('mousemove', onMove, true)
        const copyId = duplicate(grabbedId)
        if (!copyId) {
          cleanup()
          return
        }
        // The copy mounts on the next render; replay the press on it then.
        const replay = (tries: number): void => {
          if (released) {
            cancelGesture()
            return
          }
          const copyEl = document.querySelector<HTMLElement>(
            `.react-flow__node[data-id="${CSS.escape(copyId)}"]`
          )
          if (!copyEl) {
            if (tries < 30) requestAnimationFrame(() => replay(tries + 1))
            else {
              cleanup()
              cancelGesture()
            }
            return
          }
          copyEl.dispatchEvent(
            new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0,
              buttons: 1,
              clientX: start.x,
              clientY: start.y
            })
          )
          // A drag that ends normally closes the undo step itself; this only
          // covers "pressed the copy and let go without moving".
          window.addEventListener('mouseup', () => setTimeout(cancelGesture, 50), {
            once: true,
            capture: true
          })
          cleanup()
        }
        requestAnimationFrame(() => replay(0))
      }
      window.addEventListener('mousemove', onMove, true)
      window.addEventListener('mouseup', onUp, true)
    }

    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [enabled, duplicate, cancelGesture])
}
