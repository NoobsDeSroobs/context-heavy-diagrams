import { useCallback, useEffect, useRef } from 'react'
import { DRAG_THRESHOLD_PX, scrubSpeed, scrubValue } from './scrubValue'

export interface ScrubConfig {
  value: number | undefined
  mixed: boolean
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  onSessionStart: () => void
  onSessionEnd: () => void
}

// Dragging a number field's label sideways changes its value (the Figma and Blender gesture); a
// plain click still focuses the box, because the label forwards it. Pointer lock hides the cursor
// and keeps the drag going past the window edge. The whole drag is one undo step, through the same
// session the typed value uses. A mixed selection starts from zero (kept inside min and max) and
// sets every element to the one value, as typing does.
export function useScrub(config: ScrubConfig | undefined): {
  onMouseDown: (event: React.MouseEvent) => void
  onClick: (event: React.MouseEvent) => void
} {
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  })
  const swallowClickRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    const initial = configRef.current
    if (event.button !== 0 || !initial) return
    cleanupRef.current?.()

    const { min, max } = initial
    const lowest = Math.max(0, min ?? 0)
    const start =
      initial.mixed || initial.value == null ? Math.min(lowest, max ?? lowest) : initial.value
    const target = event.currentTarget as HTMLElement
    const startX = event.clientX
    // Movement before the threshold is crossed, applied with the first step of the drag.
    let pending = 0
    let dragging = false
    let current = start

    const finish = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', finish)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.body.classList.remove('scrubbing')
      if (document.pointerLockElement) document.exitPointerLock()
      cleanupRef.current = null
      if (dragging) {
        dragging = false
        configRef.current?.onSessionEnd()
        // The mouse-up that ends a drag is followed by a click on the label, which would focus
        // the box and start a typing session.
        swallowClickRef.current = true
        setTimeout(() => (swallowClickRef.current = false), 0)
      }
    }
    const onLockChange = (): void => {
      // Escape leaves pointer lock without a mouse-up.
      if (dragging && !document.pointerLockElement) finish()
    }
    const onMove = (move: MouseEvent): void => {
      let pixels = move.movementX
      if (!dragging) {
        pending += move.movementX
        if (Math.abs(move.clientX - startX) < DRAG_THRESHOLD_PX) return
        pixels = pending
        dragging = true
        configRef.current?.onSessionStart()
        document.body.classList.add('scrubbing')
        try {
          void Promise.resolve(target.requestPointerLock()).catch(() => {})
        } catch {
          // Without pointer lock the drag still works inside the window.
        }
      }
      const live = configRef.current
      if (!live) return
      // Each movement is scaled by the keys held now, so pressing Shift or Ctrl part-way does not
      // rescale the distance already dragged.
      const next = scrubValue({
        start: current,
        pixels,
        step: live.step,
        min: live.min,
        max: live.max,
        speed: scrubSpeed(move)
      })
      if (next !== current) {
        current = next
        live.onChange(next)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', finish)
    document.addEventListener('pointerlockchange', onLockChange)
    cleanupRef.current = finish
  }, [])

  const onClick = useCallback((event: React.MouseEvent) => {
    if (swallowClickRef.current) event.preventDefault()
  }, [])

  return { onMouseDown, onClick }
}
