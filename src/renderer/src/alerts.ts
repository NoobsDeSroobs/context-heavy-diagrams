// Drop-in replacement for window.alert(): shows the message in AlertDialog
// (selectable text + a Copy button) instead of the native box, whose text
// can't be selected. Callable from anywhere — components and plain modules
// alike — because it goes through this tiny pub/sub rather than React state.
// Non-blocking, unlike window.alert; every existing call site only alerts
// and then returns/continues, so nothing relied on the blocking behaviour.
export interface AlertContent {
  textToShow: string
  // What the dialog's Copy button puts on the clipboard. Same as textToShow
  // unless a caller needs them to differ (e.g. a short confirmation on screen
  // while the Copy button re-copies a longer payload, ADR 0104).
  textToCopy: string
}

type AlertListener = (alert: AlertContent) => void

const listeners = new Set<AlertListener>()

export function showAlert(textToShow: string, textToCopy: string = textToShow): void {
  // No host mounted (shouldn't happen once Canvas is up) — fall back to the
  // native box rather than swallowing the message.
  if (listeners.size === 0) {
    window.alert(textToShow)
    return
  }
  listeners.forEach((listener) => listener({ textToShow, textToCopy }))
}

export function subscribeToAlerts(listener: AlertListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
