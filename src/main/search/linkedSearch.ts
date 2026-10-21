import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import {
  searchLinkedDiagrams,
  type LinkedSearchLink,
  type LinkedSearchResult
} from '@shared/search/linkedSearch'
import {
  elementMatchesCriteria,
  elementMatchesViaDetails,
  searchableFromData,
  type SearchCriteria
} from '@shared/search/search'
import { openDiagramAtPath } from '../document/diagram'
import { resolveLinkPath } from '../links/linkPaths'

// Deep search (ADR 0097). Purely a reader, like security:crawlLinked — it never
// touches recent-diagrams / last-opened. The renderer sends the open diagram's
// *in-memory* outgoing links (so an unsaved link is searched) and the parsed
// criteria; matching runs here on the same predicate the open diagram uses, so
// only "which links matched" crosses the IPC boundary.
export function registerLinkedSearchHandlers(): void {
  ipcMain.handle(
    'search:linkedDiagrams',
    (
      _event,
      diagramPath: string,
      links: LinkedSearchLink[],
      criteria: SearchCriteria
    ): Promise<LinkedSearchResult> => {
      // One diagram can be reached by several links; parse it once per search.
      const parsed = new Map<string, ReturnType<typeof openDiagramAtPath>>()
      return searchLinkedDiagrams(diagramPath, links, {
        resolve: (from, relativePath) => resolve(resolveLinkPath(from, relativePath)),
        keyOf: (path) => (process.platform === 'win32' ? path.toLowerCase() : path),
        load: (path) => {
          let file = parsed.get(path)
          if (!file) {
            file = openDiagramAtPath(path)
            parsed.set(path, file)
          }
          return file
        },
        matchNode: (node) =>
          elementMatchesCriteria(criteria, searchableFromData(node.id, node.data)),
        matchNodeNote: (node, path) =>
          elementMatchesViaDetails(
            criteria,
            searchableFromData(node.id, node.data),
            // A details path resolves from the diagram it lives in; a missing
            // file is just empty text, same as details:read.
            (relativePath) => readFile(resolveLinkPath(path, relativePath), 'utf-8').catch(() => '')
          ),
        // On disk an edge's label/tags are top-level, not under `data`.
        matchEdge: (edge) =>
          elementMatchesCriteria(criteria, {
            id: edge.id,
            label: edge.label,
            metadata: edge.metadata
          })
      })
    }
  )
}
