import { ipcMain } from 'electron'
import { access } from 'fs/promises'
import { resolve } from 'path'
import type { DiagramFile, DiagramNode, RiskCell } from '@shared/diagram'
import {
  normalizeThreatName,
  type CrawledMatrix,
  type CrawledEntity,
  type CrawledColumn,
  type SecurityCrawlResult
} from '@shared/threatMatrixMath'
import { openDiagramAtPath } from './diagram'
import { resolveLinkPath } from './linkPaths'

// Recursive security-matrix rollup (ADR 0088). Given the open diagram's path
// and the linked matrix entities the renderer found, walk each linked subtree
// and return a CrawledMatrix per root column. Purely a reader — never
// touches recent-diagrams / last-opened (unlike diagram:openPath).

function nodeLinkedDiagram(node: DiagramNode | undefined): string | undefined {
  const link = node?.data?.linkedDiagram
  return typeof link === 'string' && link.trim() !== '' ? link : undefined
}

// Build one diagram's CrawledMatrix from its own `security.matrixEntityIds`.
// `ownPath` is this file's absolute path (for resolving its own links);
// `ancestors` is the set of resolved absolute paths already on the stack.
async function crawlDiagram(
  file: DiagramFile,
  ownPath: string,
  ancestors: Set<string>,
  warnings: string[]
): Promise<CrawledMatrix> {
  const sec = file.security
  if (!sec || sec.matrixEntityIds.length === 0) return { entities: [] }

  const normNameByThreatId = new Map(sec.threats.map((t) => [t.id, normalizeThreatName(t.name)]))
  const nodeById = new Map(file.nodes.map((n) => [n.id, n]))

  const entities: CrawledEntity[] = []
  for (const entityId of sec.matrixEntityIds) {
    const node = nodeById.get(entityId)
    if (!node || node.type !== 'entity') continue
    const label = String(node.data?.label ?? entityId)

    // Re-key this entity's own assessments by normalized threat NAME (ids are
    // per-diagram, so a parent joins on name — ADR 0088).
    const rawCells = (node.data?.security ?? {}) as Record<string, RiskCell>
    const cells: Record<string, RiskCell> = {}
    for (const [threatId, cell] of Object.entries(rawCells)) {
      const name = normNameByThreatId.get(threatId)
      if (name) cells[name] = cell
    }

    const link = nodeLinkedDiagram(node)
    if (!link) {
      entities.push({ id: entityId, label, cells })
      continue
    }

    const childPath = resolve(resolveLinkPath(ownPath, link))
    if (ancestors.has(childPath)) {
      warnings.push(`"${label}" links back to an ancestor diagram — treated as a leaf.`)
      entities.push({ id: entityId, label, cells })
      continue
    }
    try {
      await access(childPath)
    } catch {
      warnings.push(`"${label}" — linked diagram not found: ${link}`)
      entities.push({ id: entityId, label, cells, linkBroken: { relativePath: link } })
      continue
    }
    try {
      const childFile = await openDiagramAtPath(childPath)
      const childMatrix = await crawlDiagram(
        childFile,
        childPath,
        new Set([...ancestors, childPath]),
        warnings
      )
      entities.push({ id: entityId, label, cells, child: childMatrix })
    } catch {
      warnings.push(`"${label}" — linked diagram could not be read: ${link}`)
      entities.push({ id: entityId, label, cells, linkBroken: { relativePath: link } })
    }
  }
  return { entities }
}

export function registerSecurityHandlers(): void {
  ipcMain.handle(
    'security:crawlLinked',
    async (
      _event,
      diagramPath: string,
      links: { entityId: string; relativePath: string }[]
    ): Promise<SecurityCrawlResult> => {
      const rootPath = resolve(diagramPath)
      const warnings: string[] = []
      const columns: Record<string, CrawledColumn> = {}

      for (const { entityId, relativePath } of links) {
        const childPath = resolve(resolveLinkPath(diagramPath, relativePath))
        try {
          await access(childPath)
        } catch {
          columns[entityId] = { kind: 'broken', relativePath }
          continue
        }
        try {
          const childFile = await openDiagramAtPath(childPath)
          const matrix = await crawlDiagram(
            childFile,
            childPath,
            new Set([rootPath, childPath]),
            warnings
          )
          columns[entityId] = { kind: 'resolved', relativePath, matrix }
        } catch {
          columns[entityId] = { kind: 'broken', relativePath }
        }
      }

      return { columns, warnings }
    }
  )
}
