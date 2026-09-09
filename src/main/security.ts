import { ipcMain } from 'electron'
import { access } from 'fs/promises'
import { resolve } from 'path'
import type { DiagramFile, DiagramNode, RiskCell } from '@shared/diagram'
import {
  normalizeThreatName,
  type CrawledMatrix,
  type CrawledShape,
  type CrawledColumn,
  type SecurityCrawlResult
} from '@shared/threatMatrixMath'
import { openDiagramAtPath } from './diagram'
import { resolveLinkPath } from './linkPaths'

// Recursive security-matrix rollup (ADR 0088). Given the open diagram's path
// and the linked matrix shapes the renderer found, walk each linked subtree
// and return a CrawledMatrix per root column. Purely a reader — never
// touches recent-diagrams / last-opened (unlike diagram:openPath).

function nodeLinkedDiagram(node: DiagramNode | undefined): string | undefined {
  const link = node?.data?.linkedDiagram
  return typeof link === 'string' && link.trim() !== '' ? link : undefined
}

// Build one diagram's CrawledMatrix from its own `security.matrixShapeIds`.
// `ownPath` is this file's absolute path (for resolving its own links);
// `ancestors` is the set of resolved absolute paths already on the stack.
async function crawlDiagram(
  file: DiagramFile,
  ownPath: string,
  ancestors: Set<string>,
  warnings: string[]
): Promise<CrawledMatrix> {
  const sec = file.security
  if (!sec || sec.matrixShapeIds.length === 0) return { shapes: [] }

  const normNameByThreatId = new Map(sec.threats.map((t) => [t.id, normalizeThreatName(t.name)]))
  const nodeById = new Map(file.nodes.map((n) => [n.id, n]))

  const shapes: CrawledShape[] = []
  for (const shapeId of sec.matrixShapeIds) {
    const node = nodeById.get(shapeId)
    if (!node || node.type !== 'shape') continue
    const label = String(node.data?.label ?? shapeId)

    // Re-key this shape's own assessments by normalized threat NAME (ids are
    // per-diagram, so a parent joins on name — ADR 0088).
    const rawCells = (node.data?.security ?? {}) as Record<string, RiskCell>
    const cells: Record<string, RiskCell> = {}
    for (const [threatId, cell] of Object.entries(rawCells)) {
      const name = normNameByThreatId.get(threatId)
      if (name) cells[name] = cell
    }

    const link = nodeLinkedDiagram(node)
    if (!link) {
      shapes.push({ id: shapeId, label, cells })
      continue
    }

    const childPath = resolve(resolveLinkPath(ownPath, link))
    if (ancestors.has(childPath)) {
      warnings.push(`"${label}" links back to an ancestor diagram — treated as a leaf.`)
      shapes.push({ id: shapeId, label, cells })
      continue
    }
    try {
      await access(childPath)
    } catch {
      warnings.push(`"${label}" — linked diagram not found: ${link}`)
      shapes.push({ id: shapeId, label, cells, linkBroken: { relativePath: link } })
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
      shapes.push({ id: shapeId, label, cells, child: childMatrix })
    } catch {
      warnings.push(`"${label}" — linked diagram could not be read: ${link}`)
      shapes.push({ id: shapeId, label, cells, linkBroken: { relativePath: link } })
    }
  }
  return { shapes }
}

export function registerSecurityHandlers(): void {
  ipcMain.handle(
    'security:crawlLinked',
    async (
      _event,
      diagramPath: string,
      links: { shapeId: string; relativePath: string }[]
    ): Promise<SecurityCrawlResult> => {
      const rootPath = resolve(diagramPath)
      const warnings: string[] = []
      const columns: Record<string, CrawledColumn> = {}

      for (const { shapeId, relativePath } of links) {
        const childPath = resolve(resolveLinkPath(diagramPath, relativePath))
        try {
          await access(childPath)
        } catch {
          columns[shapeId] = { kind: 'broken', relativePath }
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
          columns[shapeId] = { kind: 'resolved', relativePath, matrix }
        } catch {
          columns[shapeId] = { kind: 'broken', relativePath }
        }
      }

      return { columns, warnings }
    }
  )
}
