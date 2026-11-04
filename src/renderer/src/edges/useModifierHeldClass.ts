import { useEffect } from 'react'

// Puts `mod-held` on the page while Ctrl (Cmd on a Mac) is down, so a stylesheet can react to the
// key with no React state: with Animate edges off, an edge still moves while the key is held over
// it (edges.css, ADR 0141), the same hover-with-modifier idea as the note peek (ADR 0093). A class
// on <html> rather than state in the canvas, so pressing the key re-renders nothing.
export function useModifierHeldClass(): void {
  useEffect(() => {
    const root = document.documentElement
    const set = (held: boolean): void => {
      root.classList.toggle('mod-held', held)
    }
    const onKey = (event: KeyboardEvent): void => set(event.ctrlKey || event.metaKey)
    // A key that went down while the window was elsewhere is never seen, so the pointer says it too.
    const onMove = (event: MouseEvent): void => set(event.ctrlKey || event.metaKey)
    // A missed keyup (focus left the window while the key was down) must not leave it on.
    const onBlur = (): void => set(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', onBlur)
      set(false)
    }
  }, [])
}
