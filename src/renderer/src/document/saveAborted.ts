// Thrown by the save path when the user backs out of the "changed outside the
// app" conflict popup (Cancel, or Reload — which replaces the editor content,
// so there's nothing left to save). Not a failure: callers swallow it instead
// of showing "Save failed". See docs/decisions/0091-external-change-detection.md.
export class SaveAbortedError extends Error {
  constructor() {
    super('Save aborted by the user')
    this.name = 'SaveAbortedError'
  }
}

export function isSaveAborted(error: unknown): boolean {
  return error instanceof SaveAbortedError
}
