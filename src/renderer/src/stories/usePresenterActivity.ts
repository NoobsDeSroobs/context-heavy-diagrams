import { useEffect, useState } from 'react'

// How long the pointer must be still before the presenter's bar goes away again.
export const PRESENTER_IDLE_MS = 2500

// Whether the presenter should show its controls (ADR 0195): they stay out of the way until the mouse
// moves, and go again when it has been still for a moment. The keys never bring them up, so stepping
// with the keyboard shows the audience nothing but the diagram and the step count.
export function usePresenterActivity(presenting: boolean): boolean {
  const [awake, setAwake] = useState(false)
  useEffect(() => {
    if (!presenting) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const wake = (): void => {
      setAwake(true)
      clearTimeout(timer)
      timer = setTimeout(() => setAwake(false), PRESENTER_IDLE_MS)
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('mousedown', wake)
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
      clearTimeout(timer)
      setAwake(false)
    }
  }, [presenting])
  return presenting && awake
}
