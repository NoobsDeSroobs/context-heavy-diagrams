import type { DiagramSecurity } from '../threat-matrix/schema.ts'
import type { DiagramFile } from './file.ts'

// Legacy field/value names from before the Shape -> Entity rename — accepted on
// load so a file saved before the rename keeps opening
// unmodified, never written. serializeDiagram always emits the current
// names, so a loaded-then-saved file silently upgrades itself. Remove once
// no file predating the rename is expected to still be opened. Three spots
// carried 'shape': a node's own `type`, a legend entry's `kind`, and
// DiagramSecurity's matrix-membership id lists.
function normalizeLegacyFields(diagram: DiagramFile): DiagramFile {
  const hasLegacyNodeType = diagram.nodes.some((n) => (n.type as string | undefined) === 'shape')
  const nodes = hasLegacyNodeType
    ? diagram.nodes.map((n) =>
        (n.type as string | undefined) === 'shape' ? { ...n, type: 'entity' } : n
      )
    : diagram.nodes

  const hasLegacyLegendKind = diagram.legend?.some((entry) => (entry.kind as string) === 'shape')
  const legend = hasLegacyLegendKind
    ? diagram.legend!.map((entry) =>
        (entry.kind as string) === 'shape' ? { ...entry, kind: 'entity' as const } : entry
      )
    : diagram.legend

  const legacySecurity = diagram.security as
    (DiagramSecurity & { matrixShapeIds?: string[]; hiddenShapeIds?: string[] }) | undefined
  const hasLegacySecurityIds = !!(legacySecurity?.matrixShapeIds || legacySecurity?.hiddenShapeIds)
  const security = hasLegacySecurityIds
    ? (() => {
        // Destructure the legacy keys out rather than spreading them
        // through — `rest` carries only current-shape fields, so the
        // normalized object never leaks the old names back into memory.
        const { matrixShapeIds, hiddenShapeIds, ...rest } = legacySecurity!
        return {
          ...rest,
          matrixEntityIds: legacySecurity!.matrixEntityIds ?? matrixShapeIds ?? [],
          hiddenEntityIds: legacySecurity!.hiddenEntityIds ?? hiddenShapeIds
        }
      })()
    : diagram.security

  if (!hasLegacyNodeType && !hasLegacyLegendKind && !hasLegacySecurityIds) return diagram
  return {
    ...diagram,
    nodes,
    ...(legend !== undefined ? { legend } : {}),
    ...(security ? { security } : {})
  }
}

// Deliberately no metadata/requiredTags-specific validation here (see
// ADR 0022) — parseDiagram has never validated the shape of any other optional
// field either (icons, style, connectionPoints, ...), so singling out
// metadata for stricter treatment would be inconsistent rather than more
// correct. A malformed metadata value just flows through as-is; Canvas's
// own sync pass (syncElementMetadata) is what actually reconciles required
// tags against reality, on every file open.
export function parseDiagram(raw: string): DiagramFile {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
    !Array.isArray((parsed as { edges?: unknown }).edges)
  ) {
    throw new Error('Not a recognized diagram.json (expected { version: 1, nodes, edges, ... })')
  }
  return normalizeLegacyFields(parsed as DiagramFile)
}
