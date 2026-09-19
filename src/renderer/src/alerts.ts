// Drop-in replacement for window.alert(): shows the message in AlertDialog
// (selectable text + a Copy button) instead of the native box, whose text
// can't be selected. Callable from anywhere — components and plain modules
// alike — because it goes through this tiny pub/sub rather than React state.
// Non-blocking, unlike window.alert; every existing call site only alerts
// and then returns/continues, so nothing relied on the blocking behaviour.
type AlertListener = (message: string) => void

const listeners = new Set<AlertListener>()

export function showAlert(message: string): void {
  // No host mounted (shouldn't happen once Canvas is up) — fall back to the
  // native box rather than swallowing the message.
  if (listeners.size === 0) {
    window.alert(message)
    return
  }
  listeners.forEach((listener) => listener(message))
}

export function subscribeToAlerts(listener: AlertListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
