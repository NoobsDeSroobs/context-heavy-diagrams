// What the main process holds for a compare window, and what the editor window hands over to open
// one: two whole versions of a diagram. A version cannot travel in the window's URL, so the window
// asks for it by id.

import type { DiagramFile } from '../diagram'
import type { NotesContent } from './classify.ts'

export interface CompareSession {
  // The earlier and the later version.
  base: DiagramFile
  next: DiagramFile
  // The diagram's file, so a custom icon or a Note resolves beside it; null when it was
  // never saved.
  diagramPath: string | null
  // What the window is called.
  title: string
  // Notes whose content differs between the two versions, by node id. Only a baseline
  // that can read the old notes (a git revision) has this.
  notesContent?: Record<string, NotesContent>
}
