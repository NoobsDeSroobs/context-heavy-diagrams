// The text of a diagram window's title bar: the file's name, a dot in front while anything in the
// document (the diagram or a note) is not on disk yet, and the app's name. A diagram that was never
// saved is "Untitled". No Node or DOM here, so a path with either separator is read as it is.

export const APP_NAME = 'Context-Heavy Diagrams'

export function windowTitle(path: string | null, unsaved: boolean): string {
  const name = (path ? path.split(/[/\\]/).pop() : '') || 'Untitled'
  return `${unsaved ? '• ' : ''}${name} — ${APP_NAME}`
}
